/**
 * Phase 12 — NotificationService (Wave 2 fill of the 12-02 scaffold).
 *
 * Mirrors the ModerationService.test.ts harness: mock the shared apiClient
 * BEFORE importing the service so its `import { apiClient } from '../http/client'`
 * binds to the mock. Each method is a thin verb+path wrapper — we assert the
 * verb, path, params/body, AbortSignal passthrough, and the MOB-01 guardrail
 * intent (notification HTTP lives ONLY on NotificationService, never on
 * AuthService).
 */

jest.mock('../../http/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import { apiClient } from '../../http/client';
import { NotificationService } from '../NotificationService';

const mockedApiClient = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

describe('NotificationService', () => {
  beforeEach(() => {
    mockedApiClient.get.mockReset();
    mockedApiClient.post.mockReset();
    mockedApiClient.patch.mockReset();
    mockedApiClient.delete.mockReset();
  });

  // -------------------- Feed + unread count --------------------

  it('getFeed GETs /api/notifications with the cursor param and returns { items, nextCursor }', async () => {
    mockedApiClient.get.mockResolvedValueOnce({
      data: { items: [{ _id: 'n1', read: false }], nextCursor: 'CUR2' },
    });

    const result = await NotificationService.getFeed('CUR1');

    expect(mockedApiClient.get).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/notifications', {
      params: { cursor: 'CUR1' },
      signal: undefined,
    });
    expect(result).toEqual({
      items: [{ _id: 'n1', read: false }],
      nextCursor: 'CUR2',
    });
  });

  it('getFeed with no cursor sends empty params (first page)', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: { items: [], nextCursor: null } });

    await NotificationService.getFeed();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/notifications', {
      params: {},
      signal: undefined,
    });
  });

  it('getFeed forwards the AbortSignal to apiClient', async () => {
    const controller = new AbortController();
    mockedApiClient.get.mockResolvedValueOnce({ data: { items: [], nextCursor: null } });

    await NotificationService.getFeed('CUR1', { signal: controller.signal });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/notifications', {
      params: { cursor: 'CUR1' },
      signal: controller.signal,
    });
  });

  it('getFeed re-throws an abort error without logging (isAbortError suppression)', async () => {
    const abortErr = Object.assign(new Error('canceled'), { name: 'CanceledError' });
    mockedApiClient.get.mockRejectedValueOnce(abortErr);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(NotificationService.getFeed('CUR1')).rejects.toBe(abortErr);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('getUnreadCount GETs /api/notifications/unread-count and returns the numeric count', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: { count: 7 } });

    const result = await NotificationService.getUnreadCount();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/notifications/unread-count');
    expect(result).toEqual({ count: 7 });
  });

  // -------------------- Read state --------------------

  it('markRead PATCHes /api/notifications/:id/read and returns response.data', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ data: { updated: 1 } });

    const result = await NotificationService.markRead('n9');

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/notifications/n9/read');
    expect(result).toEqual({ updated: 1 });
  });

  it('markAllRead PATCHes /api/notifications/read-all and returns response.data', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ data: { updated: 4 } });

    const result = await NotificationService.markAllRead();

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/notifications/read-all');
    expect(result).toEqual({ updated: 4 });
  });

  // -------------------- Subscriptions --------------------

  it('createSubscription POSTs /api/notifications/subscriptions with the body and returns the created subscription', async () => {
    const body = { kind: 'watch' as const, carId: 'car-1' };
    mockedApiClient.post.mockResolvedValueOnce({ data: { _id: 'sub-1', ...body } });

    const result = await NotificationService.createSubscription(body);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/notifications/subscriptions',
      body,
    );
    expect(result).toEqual({ _id: 'sub-1', ...body });
  });

  it('listSubscriptions GETs /api/notifications/subscriptions and unwraps the { items } envelope', async () => {
    // Backend router responds `{ items: [...] }` (router.js:238) — CR-02.
    mockedApiClient.get.mockResolvedValueOnce({ data: { items: [{ _id: 'sub-1' }] } });

    const result = await NotificationService.listSubscriptions();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/notifications/subscriptions');
    expect(result).toEqual([{ _id: 'sub-1' }]);
  });

  it('listSubscriptions returns [] when the payload is not the { items } envelope', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: [{ _id: 'sub-legacy' }] });

    const result = await NotificationService.listSubscriptions();

    expect(result).toEqual([]);
  });

  it('updateSubscription PATCHes /api/notifications/subscriptions/:id with the body', async () => {
    const body = { cadence: 'instant' as const };
    mockedApiClient.patch.mockResolvedValueOnce({ data: { _id: 'sub-1', ...body } });

    const result = await NotificationService.updateSubscription('sub-1', body);

    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/api/notifications/subscriptions/sub-1',
      body,
    );
    expect(result).toEqual({ _id: 'sub-1', ...body });
  });

  it('deleteSubscription DELETEs /api/notifications/subscriptions/:id and returns response.data', async () => {
    mockedApiClient.delete.mockResolvedValueOnce({ data: { deleted: 1 } });

    const result = await NotificationService.deleteSubscription('sub-1');

    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      '/api/notifications/subscriptions/sub-1',
    );
    expect(result).toEqual({ deleted: 1 });
  });

  // -------------------- MOB-01 guardrail (T-12-06-02 mitigation) --------------------

  it('MOB-01 guardrail: notification HTTP lives ONLY on NotificationService — AuthService has zero notification methods', () => {
    const authSource = fs.readFileSync(
      path.resolve(__dirname, '../../AuthService.ts'),
      'utf8',
    );
    expect(authSource).not.toMatch(/notification/i);
    expect(authSource).not.toMatch(/subscription/i);
    expect(authSource).not.toMatch(/\bwatch\b/i);
  });
});
