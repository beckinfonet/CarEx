// Mock the shared apiClient BEFORE importing ModerationService so the
// service's `import { apiClient } from '../http/client'` binds to the mock.
jest.mock('../../http/client', () => ({
  apiClient: {
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
  },
}));

import { apiClient } from '../../http/client';
import { ModerationError } from '../errors';
import { ModerationService } from '../ModerationService';

const mockedApiClient = apiClient as unknown as {
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
  get: jest.Mock;
};

describe('ModerationService', () => {
  beforeEach(() => {
    mockedApiClient.post.mockReset();
    mockedApiClient.patch.mockReset();
    mockedApiClient.delete.mockReset();
    mockedApiClient.get.mockReset();
  });

  // -------------------- Test 1: suspend --------------------

  it('Test 1: suspend POSTs to /api/admin/moderation/:uid/suspend and returns response.data', async () => {
    const body = {
      severity: 'blocked_with_review' as const,
      reasonCategory: 'spam' as const,
      note: 'abuse',
    };
    mockedApiClient.post.mockResolvedValueOnce({ data: { ok: true, id: 'audit-1' } });

    const result = await ModerationService.suspend('uid-123', body);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/suspend',
      body,
    );
    expect(result).toEqual({ ok: true, id: 'audit-1' });
  });

  // -------------------- Test 2: unsuspend with body --------------------

  it('Test 2: unsuspend PATCHes to /api/admin/moderation/:uid/unsuspend with the provided body', async () => {
    const body = { note: 'false positive' };
    mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });

    const result = await ModerationService.unsuspend('uid-123', body);

    expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/unsuspend',
      body,
    );
    expect(result).toEqual({ ok: true });
  });

  // -------------------- Test 3: unsuspend with no body --------------------

  it('Test 3: unsuspend called with no body defaults to empty object (02 D-21)', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });

    const result = await ModerationService.unsuspend('uid-123');

    expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/unsuspend',
      {},
    );
    expect(result).toEqual({ ok: true });
  });

  // -------------------- Test 4: revokeRole --------------------

  it('Test 4: revokeRole POSTs to /api/admin/moderation/:uid/revoke-role', async () => {
    const body = {
      role: 'broker' as const,
      reasonCategory: 'policy_violation' as const,
    };
    mockedApiClient.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await ModerationService.revokeRole('uid-123', body);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/revoke-role',
      body,
    );
    expect(result).toEqual({ ok: true });
  });

  // -------------------- Test 5: restoreRole --------------------

  it('Test 5: restoreRole POSTs to /api/admin/moderation/:uid/restore-role', async () => {
    const body = { role: 'seller' as const };
    mockedApiClient.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await ModerationService.restoreRole('uid-123', body);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/restore-role',
      body,
    );
    expect(result).toEqual({ ok: true });
  });

  // -------------------- Test 6: editProviderProfile --------------------

  it('Test 6: editProviderProfile POSTs to /api/admin/moderation/:uid/edit-profile', async () => {
    const body = {
      role: 'broker' as const,
      fields: { companyName: 'New Co' },
    };
    mockedApiClient.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await ModerationService.editProviderProfile('uid-123', body);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/edit-profile',
      body,
    );
    expect(result).toEqual({ ok: true });
  });

  // -------------------- Test 7: deleteProviderProfile with DELETE+body --------------------

  it('Test 7: deleteProviderProfile DELETEs /:uid/provider-profile with body in axios config.data', async () => {
    const body = { role: 'broker' as const };
    mockedApiClient.delete.mockResolvedValueOnce({ data: { ok: true } });

    const result = await ModerationService.deleteProviderProfile('uid-123', body);

    expect(mockedApiClient.delete).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      '/api/admin/moderation/uid-123/provider-profile',
      { data: body },
    );
    expect(result).toEqual({ ok: true });
  });

  // -------------------- Test 8: getHistory stub --------------------

  it('Test 8: getHistory rejects with "Not implemented — Phase 5 adds the /history route"', async () => {
    await expect(ModerationService.getHistory('uid-123')).rejects.toThrow(
      'Not implemented — Phase 5 adds the /history route',
    );
    // Must NOT have called apiClient.get — it's a pure stub.
    expect(mockedApiClient.get).not.toHaveBeenCalled();
  });

  // -------------------- Test 9: ModerationError passthrough --------------------

  it('Test 9: re-throws ModerationError unchanged (instance identity preserved)', async () => {
    const modErr = new ModerationError(
      'account_suspended',
      'blocked_with_review',
      'spam',
      'abuse',
      403,
    );
    mockedApiClient.post.mockRejectedValueOnce(modErr);

    let caught: unknown;
    try {
      await ModerationService.suspend('uid-123', {
        severity: 'blocked_with_review',
        reasonCategory: 'spam',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(modErr); // same instance — NOT wrapped
    expect(caught).toBeInstanceOf(ModerationError);
  });

  // -------------------- Test 10: raw axios error passthrough --------------------

  it('Test 10: logs and re-throws the original axios error on non-moderation failures', async () => {
    const axiosErr: any = new Error('Request failed with status code 500');
    axiosErr.isAxiosError = true;
    axiosErr.response = { status: 500, data: { error: 'server_error' } };
    mockedApiClient.post.mockRejectedValueOnce(axiosErr);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let caught: unknown;
    try {
      await ModerationService.suspend('uid-123', {
        severity: 'blocked_with_review',
        reasonCategory: 'spam',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(axiosErr); // same instance — original error surfaced
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
