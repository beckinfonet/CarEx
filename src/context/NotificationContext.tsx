import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  NotificationService,
  NotificationItem,
  CreateSubscriptionBody,
  UpdateSubscriptionBody,
} from '../services/notifications/NotificationService';

/**
 * NotificationContext — single source of truth for the in-app notification
 * center (NCEN-01..04, NPRF-07).
 *
 * Data source: NotificationService (pure REST against /api/notifications/*).
 * Works regardless of push transport — the in-app center is the guaranteed
 * denied-permission fallback (NPRF-07); `fcm.send` being a no-op stub never
 * dead-ends this surface.
 *
 * Per-user reset mirrors FavoritesContext.tsx:55-63 — when `user.localId`
 * transitions from one value to another, in-memory unreadCount + feed are
 * cleared so the next user never sees the previous user's notifications
 * (T-12-06-01 cross-user cache leak mitigation). The prevUidRef sentinel makes
 * the clear skip-on-mount (it only fires on an actual transition).
 *
 * The badge (BottomBar dot / MoreMenu "9+" count) derives from `unreadCount`
 * here — NOT a separate fetch (NCEN-01 / CTX D-07).
 */

interface NotificationContextType {
  unreadCount: number;
  feed: NotificationItem[];
  loading: boolean;
  /** Fetch unread count + first feed page (pull-to-refresh). */
  refresh: () => Promise<void>;
  /** Append the next cursor page to the feed. */
  loadMore: () => Promise<void>;
  /** Mark one notification read; decrements unreadCount. */
  markRead: (id: string) => Promise<void>;
  /** Mark all read; zeroes unreadCount. */
  markAllRead: () => Promise<void>;
  // Subscription CRUD passthroughs (consumed by WatchButton / save-search bar
  // / settings screen in later Wave-4/Wave-5 plans).
  createSubscription: (body: CreateSubscriptionBody) => Promise<any>;
  listSubscriptions: () => Promise<any>;
  updateSubscription: (id: string, body: UpdateSubscriptionBody) => Promise<any>;
  deleteSubscription: (id: string) => Promise<any>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const prevUidRef = useRef<string | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [feed, setFeed] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Per-user reset: clear in-memory feed + unreadCount on user.localId
  // transition. Mirrors FavoritesContext.tsx:55-63 (skip-on-mount via
  // prevUidRef sentinel). T-12-06-01 mitigation.
  useEffect(() => {
    const currentUid = user?.localId || null;
    if (prevUidRef.current !== null && prevUidRef.current !== currentUid) {
      setUnreadCount(0);
      setFeed([]);
      setNextCursor(null);
    }
    prevUidRef.current = currentUid;
  }, [user?.localId]);

  // WR-01 (NCEN-01): seed the unread badge at launch / on login WITHOUT the user
  // having to open the center. The bell dot (BottomBar) + MoreMenu "9+" derive
  // from unreadCount, which previously only moved when NotificationsScreen called
  // refresh() — so a freshly launched app showed a clean badge despite unread
  // rows. Fetch just the count (cheap) on mount and on every uid transition where
  // a uid is present; logged-out users get nothing (the clear effect above wipes
  // a prior user's count on logout). The feed itself still loads lazily via
  // refresh() when the center mounts.
  useEffect(() => {
    if (!user?.localId) return;
    let cancelled = false;
    NotificationService.getUnreadCount()
      .then(({ count }) => {
        if (!cancelled) setUnreadCount(count);
      })
      .catch((e) => {
        // Non-blocking: a failed count fetch just leaves the badge as-is.
        console.error('Failed to fetch initial unread count', e);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.localId]);

  const refresh = useCallback(async () => {
    if (!user?.localId) return;
    setLoading(true);
    try {
      const [{ count }, { items, nextCursor: cursor }] = await Promise.all([
        NotificationService.getUnreadCount(),
        NotificationService.getFeed(),
      ]);
      setUnreadCount(count);
      setFeed(items);
      setNextCursor(cursor);
    } catch (e) {
      // Feed-load failure is non-blocking (NPRF-07): the surface stays mounted
      // and the screen renders the pull-to-refresh error line. Don't dead-end.
      console.error('Failed to refresh notifications', e);
    } finally {
      setLoading(false);
    }
  }, [user?.localId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const { items, nextCursor: cursor } = await NotificationService.getFeed(
        nextCursor,
      );
      setFeed((prev) => [...prev, ...items]);
      setNextCursor(cursor);
    } catch (e) {
      console.error('Failed to load more notifications', e);
    }
  }, [nextCursor]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic: flip the row + decrement the badge, then sync the server.
    setFeed((prev) =>
      prev.map((n) => (n._id === id && !n.read ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await NotificationService.markRead(id);
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setFeed((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    setUnreadCount(0);
    try {
      await NotificationService.markAllRead();
    } catch (e) {
      console.error('Failed to mark all notifications read', e);
    }
  }, []);

  const createSubscription = useCallback(
    (body: CreateSubscriptionBody) => NotificationService.createSubscription(body),
    [],
  );
  const listSubscriptions = useCallback(
    () => NotificationService.listSubscriptions(),
    [],
  );
  const updateSubscription = useCallback(
    (id: string, body: UpdateSubscriptionBody) =>
      NotificationService.updateSubscription(id, body),
    [],
  );
  const deleteSubscription = useCallback(
    (id: string) => NotificationService.deleteSubscription(id),
    [],
  );

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        feed,
        loading,
        refresh,
        loadMore,
        markRead,
        markAllRead,
        createSubscription,
        listSubscriptions,
        updateSubscription,
        deleteSubscription,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
