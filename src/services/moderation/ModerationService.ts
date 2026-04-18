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

import { apiClient } from '../http/client';

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

export const ModerationService = {
  // --- Admin writes ---

  suspend: async (targetUid: string, body: SuspendBody) => {
    try {
      const response = await apiClient.post(
        `/api/admin/moderation/${targetUid}/suspend`,
        body,
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
      const response = await apiClient.post(
        `/api/admin/moderation/${targetUid}/revoke-role`,
        body,
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

  // --- Reads ---

  // Stub until Phase 5 adds GET /api/admin/moderation/:targetUid/history.
  // Post-Phase-5 replacement:
  //   const response = await apiClient.get(`/api/admin/moderation/${_targetUid}/history`);
  //   return response.data;
  // The stub exists now so that admin screens in Plan 05 can type-check
  // against the full ModerationService surface; any accidental call before
  // Phase 5 ships fails loudly with this exact error message.
  getHistory: async (_targetUid: string): Promise<never> => {
    throw new Error('Not implemented — Phase 5 adds the /history route');
  },
};
