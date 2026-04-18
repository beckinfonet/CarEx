import { ModerationService } from '../ModerationService';
import { apiClient } from '../../http/client';

jest.mock('../../http/client');

describe('ModerationService.searchUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls GET /api/admin/users/search with the q query param when only q is provided', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { users: [], nextCursor: null },
    });
    await ModerationService.searchUsers({ q: 'alice' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/users/search', {
      params: { q: 'alice' },
      signal: undefined,
    });
  });

  test('forwards role + state filter params verbatim', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { users: [], nextCursor: null },
    });
    await ModerationService.searchUsers({ role: 'broker', state: 'feature_limited' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/users/search', {
      params: { role: 'broker', state: 'feature_limited' },
      signal: undefined,
    });
  });

  test('forwards cursor + limit pagination params verbatim', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { users: [], nextCursor: null },
    });
    await ModerationService.searchUsers({ cursor: 'abc123', limit: 25 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/users/search', {
      params: { cursor: 'abc123', limit: 25 },
      signal: undefined,
    });
  });

  test('returns the response.data envelope { users, nextCursor }', async () => {
    const fakeData = {
      users: [
        {
          localId: 'u1',
          email: 'a@b.com',
          moderationStatus: { state: 'active' },
        },
      ],
      nextCursor: 'next-1',
    };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: fakeData });
    const result = await ModerationService.searchUsers({ q: 'a' });
    expect(result).toEqual(fakeData);
  });

  test('passes signal config when AbortSignal is provided', async () => {
    const controller = new AbortController();
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { users: [], nextCursor: null },
    });
    await ModerationService.searchUsers({ q: 'a' }, { signal: controller.signal });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/users/search',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  test('rethrows raw axios errors so caller can branch on err.response', async () => {
    const axiosErr = { response: { status: 500, data: { error: 'internal' } } };
    (apiClient.get as jest.Mock).mockRejectedValue(axiosErr);
    await expect(ModerationService.searchUsers({ q: 'a' })).rejects.toBe(axiosErr);
  });
});
