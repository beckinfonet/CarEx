import { ModerationService } from '../ModerationService';
import { apiClient } from '../../http/client';

jest.mock('../../http/client');

describe('ModerationService.getHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls GET /api/admin/moderation/{uid}/history with the targetUid in the path', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { rows: [], nextCursor: null },
    });
    await ModerationService.getHistory('user-7');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/moderation/user-7/history',
      { params: {}, signal: undefined },
    );
  });

  test('forwards limit + cursor query params when provided', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { rows: [], nextCursor: null },
    });
    await ModerationService.getHistory('user-7', { limit: 25, cursor: 'h-cursor-1' });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/moderation/user-7/history',
      { params: { limit: 25, cursor: 'h-cursor-1' }, signal: undefined },
    );
  });

  test('returns the response.data envelope { rows, nextCursor }', async () => {
    const fakeData = {
      rows: [
        {
          _id: 'a1',
          action: 'suspend',
          adminUid: 'admin-1',
          adminEmail: 'a@x',
          targetUid: 'user-7',
          createdAt: '2026-04-18T12:00:00Z',
        },
      ],
      nextCursor: 'next-h-1',
    };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: fakeData });
    const result = await ModerationService.getHistory('user-7', { limit: 25 });
    expect(result).toEqual(fakeData);
  });

  test('rethrows raw axios errors', async () => {
    const axiosErr = { response: { status: 500 } };
    (apiClient.get as jest.Mock).mockRejectedValue(axiosErr);
    await expect(ModerationService.getHistory('user-7')).rejects.toBe(axiosErr);
  });

  test('no longer throws the Phase-4 stub sentinel — resolves on success', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { rows: [], nextCursor: null },
    });
    await expect(ModerationService.getHistory('user-7')).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });
});
