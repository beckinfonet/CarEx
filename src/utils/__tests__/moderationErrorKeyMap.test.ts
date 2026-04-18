import { MODERATION_ERROR_KEY_MAP } from '../moderationErrorKeyMap';

describe('MODERATION_ERROR_KEY_MAP', () => {
  test('maps every backend error code to a translation key', () => {
    expect(MODERATION_ERROR_KEY_MAP.cannot_moderate_self).toBe('errCannotModerateSelf');
    expect(MODERATION_ERROR_KEY_MAP.last_admin_protected).toBe('errLastAdmin');
    expect(MODERATION_ERROR_KEY_MAP.role_not_assigned).toBe('errRoleNotAssigned');
    expect(MODERATION_ERROR_KEY_MAP.invalid_field).toBe('errInvalidField');
    expect(MODERATION_ERROR_KEY_MAP.no_changes).toBe('errNoChanges');
    expect(MODERATION_ERROR_KEY_MAP.invalid_role_for_delete).toBe(
      'errInvalidRoleForDelete',
    );
    expect(MODERATION_ERROR_KEY_MAP.user_not_found).toBe('errUserNotFound');
    expect(MODERATION_ERROR_KEY_MAP.rate_limited).toBe('errRateLimited');
    expect(MODERATION_ERROR_KEY_MAP.already_at_severity).toBe('errAlreadyAtSeverity');
    expect(MODERATION_ERROR_KEY_MAP.not_suspended).toBe('errNotSuspended');
    expect(MODERATION_ERROR_KEY_MAP.account_suspended).toBe('errAccountSuspended');
  });

  test('contains exactly 11 keys (backend-defined error codes)', () => {
    expect(Object.keys(MODERATION_ERROR_KEY_MAP).length).toBe(11);
  });

  test('all values are non-empty strings starting with "err"', () => {
    Object.values(MODERATION_ERROR_KEY_MAP).forEach((v) => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(3);
      expect(v.startsWith('err')).toBe(true);
    });
  });
});
