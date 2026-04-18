import { ModerationService } from '../ModerationService';
import { apiClient } from '../../http/client';

jest.mock('../../http/client');

describe('ModerationService.searchUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.todo('calls GET /api/admin/users/search with the q query param when only q is provided');
  test.todo('forwards role + state filter params verbatim');
  test.todo('forwards cursor + limit pagination params verbatim');
  test.todo('returns the response.data envelope { users, nextCursor }');
  test.todo('passes signal config when AbortSignal is provided');
  test.todo('rethrows raw axios errors so caller can branch on err.response');
  test.todo('rethrows ModerationError unchanged when interceptor wraps a 403');
});
