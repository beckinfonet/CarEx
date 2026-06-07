/**
 * Phase 12 — NotificationContext (Wave 2 fill of the 12-02 scaffold).
 *
 * Mirrors the PersonalityContext.test.tsx harness (react-test-renderer + a Probe
 * component that captures the hook result). useAuth is mocked so we can drive
 * `user.localId` transitions; NotificationService is mocked so the provider's
 * REST calls are deterministic.
 *
 * Proves:
 *   - NCEN-01: unreadCount drives the badge state (single context-derived count).
 *   - prevUidRef auto-clear: feed + unreadCount reset on user.localId change,
 *     but NOT on first mount (T-12-06-01 cross-user cache-leak mitigation).
 *   - useNotifications throws when used outside a NotificationProvider.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Mock useAuth so the test controls the logged-in user.
let mockUser: { localId: string } | null = null;
jest.mock('../AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock the data source.
jest.mock('../../services/notifications/NotificationService', () => ({
  NotificationService: {
    getUnreadCount: jest.fn(),
    getFeed: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    createSubscription: jest.fn(),
    listSubscriptions: jest.fn(),
    updateSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
  },
}));

import { NotificationService } from '../../services/notifications/NotificationService';
import { NotificationProvider, useNotifications } from '../NotificationContext';

const svc = NotificationService as unknown as {
  getUnreadCount: jest.Mock;
  getFeed: jest.Mock;
  markRead: jest.Mock;
  markAllRead: jest.Mock;
};

let hookResult: ReturnType<typeof useNotifications>;
function Probe() {
  hookResult = useNotifications();
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { localId: 'user-A' };
  svc.getUnreadCount.mockResolvedValue({ count: 0 });
  svc.getFeed.mockResolvedValue({ items: [], nextCursor: null });
});

describe('NotificationContext', () => {
  test('NCEN-01: unreadCount drives the badge state from refresh()', async () => {
    svc.getUnreadCount.mockResolvedValue({ count: 5 });
    svc.getFeed.mockResolvedValue({
      items: [{ _id: 'n1', read: false }],
      nextCursor: null,
    });

    await act(async () => {
      TestRenderer.create(
        <NotificationProvider>
          <Probe />
        </NotificationProvider>,
      );
    });
    await flush();

    await act(async () => {
      await hookResult.refresh();
    });
    await flush();

    expect(hookResult.unreadCount).toBe(5);
    expect(hookResult.feed).toHaveLength(1);
  });

  test('markRead decrements unreadCount (NCEN-04)', async () => {
    svc.getUnreadCount.mockResolvedValue({ count: 2 });
    svc.getFeed.mockResolvedValue({
      items: [{ _id: 'n1', read: false }],
      nextCursor: null,
    });
    (svc.markRead as jest.Mock).mockResolvedValue({ updated: 1 });

    await act(async () => {
      TestRenderer.create(
        <NotificationProvider>
          <Probe />
        </NotificationProvider>,
      );
    });
    await flush();
    await act(async () => {
      await hookResult.refresh();
    });
    await flush();
    expect(hookResult.unreadCount).toBe(2);

    await act(async () => {
      await hookResult.markRead('n1');
    });
    await flush();

    expect(hookResult.unreadCount).toBe(1);
    expect(svc.markRead).toHaveBeenCalledWith('n1');
  });

  test('auto-clears feed + unreadCount on user.localId transition (prevUidRef, skip-on-mount)', async () => {
    svc.getUnreadCount.mockResolvedValue({ count: 3 });
    svc.getFeed.mockResolvedValue({
      items: [{ _id: 'n1', read: false }],
      nextCursor: null,
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <Probe />
        </NotificationProvider>,
      );
    });
    await flush();
    await act(async () => {
      await hookResult.refresh();
    });
    await flush();
    expect(hookResult.unreadCount).toBe(3);
    expect(hookResult.feed).toHaveLength(1);

    // Simulate a user switch: change the mocked uid and re-render.
    mockUser = { localId: 'user-B' };
    await act(async () => {
      renderer!.update(
        <NotificationProvider>
          <Probe />
        </NotificationProvider>,
      );
    });
    await flush();

    // The prevUidRef sentinel fires on the A→B transition, wiping prior state.
    expect(hookResult.unreadCount).toBe(0);
    expect(hookResult.feed).toEqual([]);
  });

  test('useNotifications throws when used outside a NotificationProvider', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      act(() => {
        TestRenderer.create(<Probe />);
      }),
    ).toThrow('useNotifications must be used within a NotificationProvider');
    errSpy.mockRestore();
  });
});
