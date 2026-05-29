/**
 * Phase 11 — shared mock listing fixtures (LBUY-01..04).
 * Single source of truth for the F1..F9 matrix in `11-VALIDATION.md`.
 * Types mirror the Phase 9 D-05 thin non-admin payload + Phase 10 admin
 * extension. No imports from `src/` — pure data so jest pulls this without
 * touching the runtime module graph.
 */

// ---- Types: Phase 9 D-05 (non-admin thin) + Phase 10 admin extension ----
export type ListingStatus = 'active' | 'suspended' | 'archived' | 'deleted';
export type ReasonCategory =
  | 'spam'
  | 'policy_violation'
  | 'fraud'
  | 'inactive_seller'
  | 'other';
export type BannerSeverity = 'warning' | 'neutral' | 'destructive';

export interface BannerShape {
  titleKey: string;
  bodyKey: string;
  severity: BannerSeverity;
}

export interface ThinPayload {
  id: string;
  status: Exclude<ListingStatus, 'active'>;
  reasonCategory: ReasonCategory | null;
  statusChangedAt: string | null;
  banner: BannerShape;
  note?: string | null;
}

export interface ActivePayload {
  id: string;
  status: 'active';
  reasonCategory: null;
  statusChangedAt: null;
  year: number;
  makeName: string;
  modelName: string;
  sellerId: string;
}

export interface AdminPayload extends ThinPayload {
  moderationBadge: { status: ListingStatus; banner: BannerShape };
  sellerId: string;
  year: number;
  makeName: string;
  modelName: string;
}

export interface NotFoundSentinel { kind: '404' }

// ---- Fixtures F1..F9 per 11-VALIDATION.md §Minimum required fixture set ----

// LBUY-01 baseline negative case — banner MUST NOT render for active listings.
export const F1_active: ActivePayload = {
  id: 'car_active_1',
  status: 'active',
  reasonCategory: null,
  statusChangedAt: null,
  year: 2022,
  makeName: 'Toyota',
  modelName: 'Camry',
  sellerId: 'seller_uid_1',
};

// LBUY-01 + LBUY-04 warning tone — suspended with reason + visible note.
export const F2_suspendedSpam: ThinPayload = {
  id: 'car_suspended_spam_2',
  status: 'suspended',
  reasonCategory: 'spam',
  statusChangedAt: '2026-05-20T10:00:00Z',
  banner: { titleKey: 'listingStatusBannerSuspendedTitle', bodyKey: 'listingStatusBannerSuspendedBody', severity: 'warning' },
  note: 'Multiple flag reports filed by buyers.',
};

// LBUY-04 neutral tone — archived inactive seller, null-note branch.
export const F3_archivedInactiveSeller: ThinPayload = {
  id: 'car_archived_inactive_3',
  status: 'archived',
  reasonCategory: 'inactive_seller',
  statusChangedAt: '2026-05-15T09:30:00Z',
  banner: { titleKey: 'listingStatusBannerArchivedTitle', bodyKey: 'listingStatusBannerArchivedBody', severity: 'neutral' },
  note: null,
};

// LBUY-04 destructive tone — deleted policy violation (Pitfall 1: treat as 200+banner).
export const F4_deletedPolicyViolation: ThinPayload = {
  id: 'car_deleted_policy_4',
  status: 'deleted',
  reasonCategory: 'policy_violation',
  statusChangedAt: '2026-05-22T14:10:00Z',
  banner: { titleKey: 'listingStatusBannerDeletedTitle', bodyKey: 'listingStatusBannerDeletedBody', severity: 'destructive' },
  note: 'Listing violated content policy §3.2.',
};

// Empty-note branch on suspended warning tone.
export const F5_suspendedFraud: ThinPayload = {
  id: 'car_suspended_fraud_5',
  status: 'suspended',
  reasonCategory: 'fraud',
  statusChangedAt: '2026-05-21T11:45:00Z',
  banner: { titleKey: 'listingStatusBannerSuspendedTitle', bodyKey: 'listingStatusBannerSuspendedBody', severity: 'warning' },
  note: null,
};

// Empty-string-note (distinct from null) on archived neutral tone.
export const F6_archivedOther: ThinPayload = {
  id: 'car_archived_other_6',
  status: 'archived',
  reasonCategory: 'other',
  statusChangedAt: '2026-05-18T08:00:00Z',
  banner: { titleKey: 'listingStatusBannerArchivedTitle', bodyKey: 'listingStatusBannerArchivedBody', severity: 'neutral' },
  note: '',
};

// 404 sentinel — tests mock apiClient.get to reject with AxiosError (status=404).
// Not a payload — the `errorContainer` empty-state path consumes the rejection.
export const F7_404: NotFoundSentinel = { kind: '404' as const };

// Admin viewing F2 — full Car + moderationBadge per Phase 10 D-17.
// Asserts the NON-admin banner does NOT render on the admin path.
export const F8_adminViewingF2: AdminPayload = {
  id: 'car_suspended_spam_2',
  status: 'suspended',
  reasonCategory: 'spam',
  statusChangedAt: '2026-05-20T10:00:00Z',
  banner: { titleKey: 'listingStatusBannerSuspendedTitle', bodyKey: 'listingStatusBannerSuspendedBody', severity: 'warning' },
  note: 'Multiple flag reports filed by buyers.',
  moderationBadge: {
    status: 'suspended',
    banner: { titleKey: 'listingStatusBannerSuspendedTitle', bodyKey: 'listingStatusBannerSuspendedBody', severity: 'warning' },
  },
  sellerId: 'seller_uid_2',
  year: 2019,
  makeName: 'BMW',
  modelName: 'X5',
};

// Phase 10 D-15 regression — admin acting on their own listing
// (error: 'cannot_moderate_own_listing'). F4-shape destructive tone.
export const F9_adminOwnListing: AdminPayload & { error: 'cannot_moderate_own_listing' } = {
  id: 'car_admin_own_4',
  status: 'deleted',
  reasonCategory: 'policy_violation',
  statusChangedAt: '2026-05-22T14:10:00Z',
  banner: { titleKey: 'listingStatusBannerDeletedTitle', bodyKey: 'listingStatusBannerDeletedBody', severity: 'destructive' },
  note: 'Listing violated content policy §3.2.',
  moderationBadge: {
    status: 'deleted',
    banner: { titleKey: 'listingStatusBannerDeletedTitle', bodyKey: 'listingStatusBannerDeletedBody', severity: 'destructive' },
  },
  sellerId: 'admin_uid_self',
  year: 2021,
  makeName: 'Mercedes',
  modelName: 'GLE',
  error: 'cannot_moderate_own_listing',
};

// Aggregated map — Object.values(ALL_FIXTURES) gives parametric F1..F9 coverage.
export const ALL_FIXTURES = {
  F1_active,
  F2_suspendedSpam,
  F3_archivedInactiveSeller,
  F4_deletedPolicyViolation,
  F5_suspendedFraud,
  F6_archivedOther,
  F7_404,
  F8_adminViewingF2,
  F9_adminOwnListing,
} as const;
