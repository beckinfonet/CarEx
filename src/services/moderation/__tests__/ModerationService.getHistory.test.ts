import { ModerationService } from '../ModerationService';
import { apiClient } from '../../http/client';

jest.mock('../../http/client');

describe('ModerationService.getHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.todo('calls GET /api/admin/moderation/{uid}/history with the targetUid in the path');
  test.todo('forwards limit + cursor query params when provided');
  test.todo('returns the response.data envelope { rows, nextCursor }');
  test.todo('omits query params from the request when query arg is undefined');
  test.todo('rethrows raw axios errors');
  test.todo('no longer throws the Phase-4 stub sentinel "Not implemented — Phase 5 adds the /history route"');
});
