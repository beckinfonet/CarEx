// ModerationService — mobile wrapper around Phase 2's admin moderation
// HTTP endpoints.
//
// MOB-01 guardrail: these methods live in a NEW module, not in AuthService.
// The grep `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts`
// must return 0 during and after this milestone.
//
// Every method delegates to `apiClient` from `../http/client`, which owns:
//   - Bearer idToken injection (request interceptor, Plan 04-01 D-02/D-04)
//   - 403 account_suspended → ModerationError normalization (response
//     interceptor, Plan 04-01 D-09/D-10/D-11)
// So method bodies stay as thin "verb + path + body" wrappers. The catch
// blocks re-throw whatever the interceptor produced — ModerationError for
// moderation-specific 403s, raw axios errors for everything else.
//
// DELETE with body: axios DELETE takes config as the second argument; the
// request body must be passed via `config.data` (per 02-CONTEXT D-14,
// deleteProviderProfile needs `{ role }` to disambiguate broker vs logistics).

import axios from 'axios';
import { apiClient } from '../http/client';
import { ListingModerationError } from './errors';

/**
 * True when `err` is an axios cancellation produced by AbortController.
 * Used by searchUsers + getHistory (the only methods that accept an
 * AbortSignal) to suppress the noisy `console.error` on aborted in-flight
 * requests. Aborts are intended flow control (the caller superseded the
 * request) — they should not surface as red LogBox overlays in dev.
 *
 * Belt-and-braces: checks all three signatures axios 1.x can produce
 * (`isCancel`, `CanceledError`, `AbortError`) — mirrors the screen-level
 * pattern at AdminModerationScreen.tsx (~line 136-139).
 */
function isAbortError(err: unknown): boolean {
  if (axios.isCancel?.(err)) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'CanceledError' || name === 'AbortError';
}

/**
 * Map an axios-shaped error to a typed `ListingModerationError`. Used by every
 * listing-domain WRITE method (Plan 10-04 / RESEARCH §Code Examples lines
 * 810-820) so 4xx responses from `/api/admin/moderation/listings/:carId/*`
 * surface as a single class with a code, listing status, banner hint, and
 * any cart-domain refund context preserved verbatim. `searchListings`
 * deliberately does NOT use this helper — read-side 500-class errors are
 * infra/dev bugs and surface raw to the screen's EmptyState (T-10-06 +
 * RESEARCH lines 916-921).
 */
function toListingModerationError(error: unknown): ListingModerationError {
  const axiosErr = error as { response?: { status?: number; data?: any } };
  const data = axiosErr.response?.data;
  return new ListingModerationError(
    data?.error ?? 'unknown',
    data?.listingStatus,
    data?.reasonCategory,
    data?.banner,
    data?.refundId,
    data?.refundFailed,
    axiosErr.response?.status,
  );
}

// --- Types (exported for consumers in Plan 05 admin screens) ---

export type Severity =
  | 'feature_limited'
  | 'blocked_with_review'
  | 'permanently_banned';

export type ReasonCategory =
  | 'spam'
  | 'policy_violation'
  | 'fraud'
  | 'other';

export type ProviderRole = 'broker' | 'logistics';

export type RevokableRole = 'seller' | 'broker' | 'logistics';

export interface SuspendBody {
  severity: Severity;
  reasonCategory: ReasonCategory;
  note?: string;
}

export interface RevokeRoleBody {
  role: RevokableRole;
  reasonCategory: ReasonCategory;
  note?: string;
}

export interface RestoreRoleBody {
  role: RevokableRole;
  reasonCategory?: ReasonCategory;
  note?: string;
}

// Broker + logistics edits share the phoneNumber / companyName /
// telegramUsername whitelist; logistics additionally supports coverageAreas
// and timelines per 02-CONTEXT D-03.
export interface EditProfileBody {
  role: ProviderRole;
  fields: Partial<{
    companyName: string;
    phoneNumber: string;
    telegramUsername: string;
    coverageAreas: string[]; // logistics only
    timelines: string[]; // logistics only
  }>;
}

export interface DeleteProfileBody {
  // Backend rejects role==='seller' with 400 invalid_role_for_delete
  // (02-CONTEXT D-14). Type narrows to broker/logistics at the mobile layer.
  role: ProviderRole;
}

export interface UnsuspendBody {
  note?: string;
}

// --- Plan 05-03 additions: read-side types ---

/** Single row returned by GET /api/admin/users/search */
export interface SearchUserItem {
  localId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  createdAt?: string;
  sellerStatus?: string;
  brokerStatus?: string;
  logisticsStatus?: string;
  isAdmin?: boolean;
  adminRole?: string | null;
  moderationStatus: {
    state: 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
    reasonCategory?: ReasonCategory | null;
    note?: string | null;
    setAt?: string;
    setByAdminUid?: string | null;
    restrictedFeatures?: string[];
  };
}

export interface SearchUsersQuery {
  q?: string;
  role?: 'buyer' | 'seller' | 'broker' | 'logistics' | 'admin';
  state?: 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
  cursor?: string;
  limit?: number;
}

export interface SearchUsersResult {
  users: SearchUserItem[];
  nextCursor: string | null;
}

/** Single row returned by GET /api/admin/moderation/:uid/history */
export interface ModerationActionRow {
  _id: string;
  action:
    | 'suspend'
    | 'unsuspend'
    | 'revoke_role'
    | 'restore_role'
    | 'edit_profile'
    | 'delete_provider_profile';
  severity?: Severity | 'none';
  roleAffected?: RevokableRole;
  reasonCategory?: ReasonCategory;
  note?: string | null;
  adminUid: string;
  adminEmail: string;
  targetUid: string;
  fieldDiff?: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
}

export interface GetHistoryQuery {
  limit?: number;
  cursor?: string;
}

export interface GetHistoryResult {
  rows: ModerationActionRow[];
  nextCursor: string | null;
}

// --- Plan 10-04 additions: listing-domain types (LMOB-01) ---
// The listing-domain reason taxonomy is INTENTIONALLY distinct from the
// user-domain `ReasonCategory` above — listings add `inactive_seller` (an
// Archive-typical reason) and drop nothing; both unions share `spam`,
// `policy_violation`, `fraud`, `other` by design. Keep them separate so a
// listing-mod modal cannot accidentally render `inactive_seller` for a user
// moderation surface (and vice versa).
export type ListingReasonCategory =
  | 'spam'
  | 'policy_violation'
  | 'fraud'
  | 'inactive_seller'
  | 'other';

export interface SuspendListingBody {
  reasonCategory: ListingReasonCategory;
  note?: string;
}

export interface ArchiveListingBody {
  reasonCategory: ListingReasonCategory;
  note?: string;
}

export interface DeleteListingBody {
  reasonCategory: ListingReasonCategory;
  note?: string;
}

export interface RestoreListingBody {
  note?: string;
}

/**
 * Structured input shape for `adminEditListing`. The service is the single
 * place that assembles multipart FormData — call sites (Plan 09 SellCarScreen
 * admin-edit branch) pass a plain object and stay readable (CONTEXT
 * §Claude's Discretion recommendation). Field whitelist mirrors the seller
 * PUT /api/cars/:id shape (Phase 8 D-D); backend re-validates via the
 * `.strict()` Zod schema in `listingSchemas.js`.
 */
export interface AdminEditListingInput {
  fields: {
    makeId?: string;
    modelId?: string;
    trimLevel?: string;
    wheelbase?: string;
    fuel?: string;
    currency?: string;
    description?: string;
    bodyType?: string;
    engine?: string;
    transmission?: string;
    drivetrain?: string;
    mpg?: string;
    condition?: string;
    exteriorColor?: string;
    interiorColor?: string;
    interiorMaterial?: string;
    phoneNumber?: string;
    telegramUsername?: string;
    year?: number;
    price?: number;
    mileage?: number;
    seats?: number;
    doors?: number;
    knownIssues?: string[];
  };
  existingImageUrls?: string[];
  newFiles?: Array<{ uri: string; type?: string; name?: string }>;
}

export interface ListingActionResponse {
  ok: true;
  listing: {
    _id: string;
    status: 'active' | 'suspended' | 'archived' | 'deleted';
    moderatedBy?: string;
    moderatedAt?: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
  };
  action: {
    _id: string;
    action: 'suspend' | 'archive' | 'delete' | 'restore' | 'edit';
    fromStatus: string;
    toStatus: string;
    createdAt: string;
  };
}

export interface ListingSearchItem {
  _id: string;
  status: 'active' | 'suspended' | 'archived' | 'deleted';
  makeName?: string;
  modelName?: string;
  year?: number;
  price?: number;
  firstPhotoUrl?: string | null;
  sellerId: string;
  createdAt: string;
  moderatedAt?: string | null;
  moderationReason?: string | null;
  listingId?: string;
}

export interface SearchListingsQuery {
  status?: 'active' | 'suspended' | 'archived' | 'deleted';
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface SearchListingsResult {
  rows: ListingSearchItem[];
  nextCursor: string | null;
}

export const ModerationService = {
  // --- Admin writes ---

  suspend: async (targetUid: string, body: SuspendBody) => {
    try {
      // Backend dispatches on body.action at POST /:targetUid (Phase 2 D-01).
      // There is no dedicated /:targetUid/suspend route — use the dispatcher.
      const response = await apiClient.post(
        `/api/admin/moderation/${targetUid}`,
        { action: 'suspend', ...body },
      );
      return response.data;
    } catch (error) {
      console.error('Failed to suspend user', error);
      throw error;
    }
  },

  unsuspend: async (targetUid: string, body: UnsuspendBody = {}) => {
    try {
      const response = await apiClient.patch(
        `/api/admin/moderation/${targetUid}/unsuspend`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to unsuspend user', error);
      throw error;
    }
  },

  revokeRole: async (targetUid: string, body: RevokeRoleBody) => {
    try {
      // Backend dispatches on body.action at POST /:targetUid (Phase 2 D-01).
      // There is no dedicated /:targetUid/revoke-role route — use the dispatcher.
      const response = await apiClient.post(
        `/api/admin/moderation/${targetUid}`,
        { action: 'revoke_role', ...body },
      );
      return response.data;
    } catch (error) {
      console.error('Failed to revoke role', error);
      throw error;
    }
  },

  restoreRole: async (targetUid: string, body: RestoreRoleBody) => {
    try {
      const response = await apiClient.post(
        `/api/admin/moderation/${targetUid}/restore-role`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to restore role', error);
      throw error;
    }
  },

  editProviderProfile: async (targetUid: string, body: EditProfileBody) => {
    try {
      const response = await apiClient.post(
        `/api/admin/moderation/${targetUid}/edit-profile`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to edit provider profile', error);
      throw error;
    }
  },

  deleteProviderProfile: async (
    targetUid: string,
    body: DeleteProfileBody,
  ) => {
    try {
      // DELETE with body: axios passes the request body via config.data
      // (per 02-CONTEXT D-14 — backend reads `role` off the body).
      const response = await apiClient.delete(
        `/api/admin/moderation/${targetUid}/provider-profile`,
        { data: body },
      );
      return response.data;
    } catch (error) {
      console.error('Failed to delete provider profile', error);
      throw error;
    }
  },

  // --- Plan 05-03: read-side queries ---

  searchUsers: async (
    query: SearchUsersQuery,
    config?: { signal?: AbortSignal },
  ): Promise<SearchUsersResult> => {
    try {
      const response = await apiClient.get('/api/admin/users/search', {
        params: query,
        signal: config?.signal,
      });
      return response.data;
    } catch (error) {
      if (isAbortError(error)) {
        // Aborted by AbortController — intended flow control, not a failure.
        // Re-throw so callers' isCancel guards still trigger; suppress the log.
        throw error;
      }
      console.error('Failed to search users', error);
      throw error;
    }
  },

  // --- Reads ---

  getHistory: async (
    targetUid: string,
    query: GetHistoryQuery = {},
    config?: { signal?: AbortSignal },
  ): Promise<GetHistoryResult> => {
    try {
      const response = await apiClient.get(
        `/api/admin/moderation/${targetUid}/history`,
        {
          params: query,
          signal: config?.signal,
        },
      );
      // Backend envelope is { items, nextCursor } per Plan 05-0a; mobile
      // screens consume `rows`. Rename here so GetHistoryResult and every
      // caller can stay stable even though the two plans disagreed on the
      // field name. `|| []` guards against a malformed response — callers
      // rely on `rows` being an array (e.g. dependency arrays reading
      // history.length would otherwise crash with "Cannot read property
      // 'length' of undefined").
      const data = response.data ?? {};
      return {
        rows: Array.isArray(data.rows)
          ? data.rows
          : Array.isArray(data.items)
          ? data.items
          : [],
        nextCursor: data.nextCursor ?? null,
      };
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.error('Failed to fetch moderation history', error);
      throw error;
    }
  },

  // --- Listing moderation writes (Plan 10-04 / LMOB-01) ---
  //
  // All 5 write methods PATCH `/api/admin/moderation/listings/:carId[/<action>]`
  // (Phase 8 D-01). On 4xx the axios error is wrapped via
  // `toListingModerationError` so callers branch on a typed
  // `ListingModerationError` (D-14). Errors are NOT routed through the 403
  // user-suspension interceptor (T-10-02) — listing 403
  // `cannot_moderate_own_listing` is a domain rejection, not an auth gate.

  adminEditListing: async (
    carId: string,
    input: AdminEditListingInput,
  ): Promise<ListingActionResponse> => {
    const formData = new FormData();
    Object.entries(input.fields).forEach(([k, v]) => {
      if (v === undefined) return;
      if (k === 'knownIssues') {
        formData.append(k, JSON.stringify(v));
      } else {
        formData.append(k, typeof v === 'number' ? String(v) : (v as string));
      }
    });
    if (input.existingImageUrls) {
      formData.append(
        'existingImageUrls',
        JSON.stringify(input.existingImageUrls),
      );
    }
    (input.newFiles ?? []).forEach((file, idx) => {
      // @ts-ignore RN FormData accepts { uri, type, name }
      formData.append('images', {
        uri: file.uri,
        type: file.type,
        name: file.name ?? `image_${idx}.jpg`,
      });
    });
    try {
      // Pitfall 9: axios + the RN FormData polyfill require an EXPLICIT
      // multipart content-type header on the patch config — otherwise axios
      // serializes the body as JSON and multer on the backend rejects it.
      const response = await apiClient.patch(
        `/api/admin/moderation/listings/${carId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data;
    } catch (error) {
      console.error('Failed to admin-edit listing', error);
      throw toListingModerationError(error);
    }
  },

  suspendListing: async (
    carId: string,
    body: SuspendListingBody,
  ): Promise<ListingActionResponse> => {
    try {
      const response = await apiClient.patch(
        `/api/admin/moderation/listings/${carId}/suspend`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to suspend listing', error);
      throw toListingModerationError(error);
    }
  },

  archiveListing: async (
    carId: string,
    body: ArchiveListingBody,
  ): Promise<ListingActionResponse> => {
    try {
      const response = await apiClient.patch(
        `/api/admin/moderation/listings/${carId}/archive`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to archive listing', error);
      throw toListingModerationError(error);
    }
  },

  deleteListing: async (
    carId: string,
    body: DeleteListingBody,
  ): Promise<ListingActionResponse> => {
    try {
      const response = await apiClient.patch(
        `/api/admin/moderation/listings/${carId}/delete`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to delete listing', error);
      throw toListingModerationError(error);
    }
  },

  restoreListing: async (
    carId: string,
    body: RestoreListingBody = {},
  ): Promise<ListingActionResponse> => {
    try {
      const response = await apiClient.patch(
        `/api/admin/moderation/listings/${carId}/restore`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to restore listing', error);
      throw toListingModerationError(error);
    }
  },

  // --- Listing moderation reads (Plan 10-04 / LMOB-01) ---

  searchListings: async (
    query: SearchListingsQuery,
    config?: { signal?: AbortSignal },
  ): Promise<SearchListingsResult> => {
    try {
      const response = await apiClient.get(
        '/api/admin/moderation/listings',
        {
          params: query,
          signal: config?.signal,
        },
      );
      // Defensive: backend Plan 10-03 returns `{ rows, nextCursor }`. If the
      // shape drifts (or a future field is added) preserve the contract for
      // screen consumers and only project rows + nextCursor.
      const data = response.data ?? {};
      return {
        rows: Array.isArray(data.rows) ? data.rows : [],
        nextCursor: data.nextCursor ?? null,
      };
    } catch (error) {
      if (isAbortError(error)) {
        // Aborted by AbortController — intended flow control, not a failure.
        // Re-throw so caller's isCancel guard suppresses the screen-side
        // .catch handler. No console.error.
        throw error;
      }
      // Deliberately raw: searchListings does NOT wrap into
      // ListingModerationError. 500-class / `invalid_q` errors are infra/dev
      // bugs, not listing-domain rejections, and surface to the screen's
      // EmptyState (RESEARCH lines 916-921).
      console.error('Failed to search listings', error);
      throw error;
    }
  },
};
