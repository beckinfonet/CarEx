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
