export class ModerationError extends Error {
  constructor(
    public code: 'account_suspended' | 'provider_suspended' | 'user_not_found' | 'deprecated' | string,
    public status?: string,        // moderationStatus.state — 'blocked_with_review' | 'feature_limited' | 'permanently_banned'
    public reasonCategory?: string,
    public note?: string,
    public httpStatus?: number,
  ) {
    super(`ModerationError: ${code}`);
    this.name = 'ModerationError';
  }
}

// Sibling to ModerationError. SEPARATE class by design — Phase 4 D-07 scoped
// ModerationError to user-suspension audit codes; Phase 10 must NOT widen it.
// Listing-domain errors get their own discriminator so user-domain and
// listing-domain audit boundaries stay independently grep-able for Phase 11
// LQUAL-03 security review (D-14 + RESEARCH §Pattern S7).
export class ListingModerationError extends Error {
  constructor(
    public code:
      | 'listing_not_available'
      | 'listing_not_found'
      | 'cannot_moderate_own_listing'
      | 'already_in_state'
      | 'not_moderated'
      | 'invalid_field'
      | 'no_changes'
      | 'invalid_payload'
      | 'invalid_make'
      | 'invalid_model'
      | string,                                                       // Future codes pass through
    public listingStatus?: 'suspended' | 'archived' | 'deleted',
    public reasonCategory?: string,
    public banner?: {
      titleKey: string;
      bodyKey: string;
      severity: 'warning' | 'neutral' | 'destructive';
    },
    public refundId?: string,
    public refundFailed?: boolean,
    public httpStatus?: number,
  ) {
    super(`ListingModerationError: ${code}`);
    this.name = 'ListingModerationError';
  }
}
