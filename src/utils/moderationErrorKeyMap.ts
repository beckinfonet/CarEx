/**
 * Maps every ModerationError `.code` (defined by the backend in Phase 2 + the
 * apiClient interceptor in Plan 04-01) to a translation key in
 * src/constants/translations.ts (Plan 05-02). UI catch blocks lookup the key,
 * then resolve via `useLanguage().t[key]`.
 *
 * If a future backend code is not in this map, the screen falls back to
 * `t.errGeneric`. Keep this map exhaustive — every new code added in the
 * backend MUST land here at the same time as its translation pair.
 */
export const MODERATION_ERROR_KEY_MAP = {
  cannot_moderate_self: 'errCannotModerateSelf',
  last_admin_protected: 'errLastAdmin',
  role_not_assigned: 'errRoleNotAssigned',
  invalid_field: 'errInvalidField',
  no_changes: 'errNoChanges',
  invalid_role_for_delete: 'errInvalidRoleForDelete',
  user_not_found: 'errUserNotFound',
  rate_limited: 'errRateLimited',
  already_at_severity: 'errAlreadyAtSeverity',
  not_suspended: 'errNotSuspended',
  account_suspended: 'errAccountSuspended',
} as const;

export type ModerationErrorCode = keyof typeof MODERATION_ERROR_KEY_MAP;
