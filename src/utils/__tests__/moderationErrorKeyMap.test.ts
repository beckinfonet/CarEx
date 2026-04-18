import { MODERATION_ERROR_KEY_MAP, ModerationErrorCode } from '../moderationErrorKeyMap';

describe('MODERATION_ERROR_KEY_MAP', () => {
  test.todo('exports a frozen/as-const map of error codes to translation keys');
  test.todo('maps cannot_moderate_self to errCannotModerateSelf');
  test.todo('maps last_admin_protected to errLastAdmin');
  test.todo('maps role_not_assigned to errRoleNotAssigned');
  test.todo('maps invalid_field to errInvalidField');
  test.todo('maps no_changes to errNoChanges');
  test.todo('maps invalid_role_for_delete to errInvalidRoleForDelete');
  test.todo('maps user_not_found to errUserNotFound');
  test.todo('maps rate_limited to errRateLimited');
  test.todo('exports ModerationErrorCode type union of all keys');
});
