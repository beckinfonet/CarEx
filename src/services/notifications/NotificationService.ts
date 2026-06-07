// NotificationService — mobile wrapper around Phase 12's notification REST
// surface (the /api/notifications/* router shipped in 12-04, mounted in 12-05).
//
// MOB-01 guardrail (CLAUDE.md / PROJECT DEBT-01): these methods live in a NEW
// domain module, NOT in AuthService. The grep
//   grep -c 'notification\|subscription\|watch' src/services/AuthService.ts
// must return 0 during and after this milestone. This module mirrors the
// ModerationService split precedent exactly.
//
// Every method delegates to `apiClient` from `../http/client`, which owns:
//   - Bearer idToken injection (request interceptor, Plan 04-01 D-02/D-04) —
//     the backend derives the caller uid from the verified token, so the client
//     never sends a uid in the body or params (IDOR mitigation, T-12-06-03).
//   - 401 idToken refresh + single retry (Plan 05-12).
// So method bodies stay as thin "verb + path + body" wrappers. The catch
// blocks log + re-throw whatever the interceptor produced.
//
// AbortSignal: getFeed accepts an optional signal so a stale in-flight feed
// fetch can be cancelled. Aborts are intended flow control, not failures —
// isAbortError suppresses the noisy console.error and re-throws so callers'
// isCancel guards still trigger.
//
// DELETE with body: axios DELETE takes config as the second argument; if a
// request body is ever needed it must be passed via `config.data`.

import axios from 'axios';
import { apiClient } from '../http/client';

/**
 * True when `err` is an axios cancellation produced by AbortController. Used by
 * getFeed (the only method that accepts an AbortSignal) to suppress the noisy
 * console.error on aborted in-flight requests. Mirrors ModerationService's
 * isAbortError — checks all three signatures axios 1.x can produce.
 */
function isAbortError(err: unknown): boolean {
  if (axios.isCancel?.(err)) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'CanceledError' || name === 'AbortError';
}

// --- Types (exported for context + screen consumers) ---

// Canonical watch-event names (Phase 12 CTX D-03 / NSUB-02). The four
// load-bearing values created by WatchButton (12-09) are:
//   price_drop · booked · sold · back_available
// The legacy `back_in_stock` / `new_photos` spellings are kept in the union so
// the feed-item renderer (12-08) — which already handles both `back_available`
// and `back_in_stock` defensively — and any in-flight rows continue to type.
export type NotificationEvent =
  | 'price_drop'
  | 'booked'
  | 'sold'
  | 'back_available'
  | 'back_in_stock'
  | 'new_photos';

export type SubscriptionKind = 'watch' | 'saved_search';

export type Cadence = 'instant' | 'daily';

/** A single notification row from GET /api/notifications. */
export interface NotificationItem {
  _id: string;
  uid: string;
  kind: SubscriptionKind;
  event?: NotificationEvent;
  title?: string;
  body?: string;
  read: boolean;
  // Server-built deep link (carex://... or https://www.carexmarket.com/...)
  // — routed only through App.tsx's whitelisted linking.config paths.
  data?: { deeplink?: string; [key: string]: unknown };
  createdAt: string;
}

export interface FeedResult {
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface UnreadCountResult {
  count: number;
}

/** Create-subscription body (POST /api/notifications/subscriptions). */
export interface CreateSubscriptionBody {
  kind: SubscriptionKind;
  // watch: carId target. The backend defaults events to all four (D-03).
  carId?: string;
  // saved_search: the filter criteria captured from activeFilters.
  criteria?: Record<string, unknown>;
  events?: NotificationEvent[];
  cadence?: Cadence;
}

/** Edit-subscription body (PATCH /api/notifications/subscriptions/:id). */
export interface UpdateSubscriptionBody {
  cadence?: Cadence;
  events?: NotificationEvent[];
}

export interface Subscription {
  _id: string;
  uid: string;
  kind: SubscriptionKind;
  carId?: string;
  criteria?: Record<string, unknown>;
  events?: NotificationEvent[];
  cadence: Cadence;
  active: boolean;
  createdAt: string;
}

export const NotificationService = {
  // --- Feed + unread count ---

  /**
   * GET /api/notifications?cursor=<opaque base64>. Forwards the AbortSignal so
   * a superseded refresh can be cancelled; aborts re-throw (not logged).
   */
  getFeed: async (
    cursor?: string,
    config?: { signal?: AbortSignal },
  ): Promise<FeedResult> => {
    try {
      const response = await apiClient.get('/api/notifications', {
        params: cursor ? { cursor } : {},
        signal: config?.signal,
      });
      const data = response.data ?? {};
      return {
        items: Array.isArray(data.items) ? data.items : [],
        nextCursor: data.nextCursor ?? null,
      };
    } catch (error) {
      if (isAbortError(error)) {
        // Aborted by AbortController — intended flow control, not a failure.
        throw error;
      }
      console.error('Failed to fetch notification feed', error);
      throw error;
    }
  },

  getUnreadCount: async (): Promise<UnreadCountResult> => {
    try {
      const response = await apiClient.get('/api/notifications/unread-count');
      return { count: response.data?.count ?? 0 };
    } catch (error) {
      console.error('Failed to fetch unread count', error);
      throw error;
    }
  },

  // --- Read state ---

  markRead: async (id: string) => {
    try {
      const response = await apiClient.patch(`/api/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      console.error('Failed to mark notification read', error);
      throw error;
    }
  },

  markAllRead: async () => {
    try {
      const response = await apiClient.patch('/api/notifications/read-all');
      return response.data;
    } catch (error) {
      console.error('Failed to mark all notifications read', error);
      throw error;
    }
  },

  // --- Subscription CRUD ---

  createSubscription: async (body: CreateSubscriptionBody) => {
    try {
      const response = await apiClient.post(
        '/api/notifications/subscriptions',
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to create subscription', error);
      throw error;
    }
  },

  listSubscriptions: async (): Promise<Subscription[]> => {
    try {
      const response = await apiClient.get('/api/notifications/subscriptions');
      // Router responds `{ items: [...] }` (router.js:238) — unwrap the envelope
      // just like getFeed does. The bare-array guard here always returned []
      // against the shipped backend shape (CR-02).
      const items = response.data?.items;
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.error('Failed to list subscriptions', error);
      throw error;
    }
  },

  updateSubscription: async (id: string, body: UpdateSubscriptionBody) => {
    try {
      const response = await apiClient.patch(
        `/api/notifications/subscriptions/${id}`,
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to update subscription', error);
      throw error;
    }
  },

  deleteSubscription: async (id: string) => {
    try {
      const response = await apiClient.delete(
        `/api/notifications/subscriptions/${id}`,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to delete subscription', error);
      throw error;
    }
  },
};
