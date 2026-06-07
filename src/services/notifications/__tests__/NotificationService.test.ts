/**
 * Phase 12 — Wave 0 scaffold (NotificationService).
 *
 * Mirrors the Phase 5 Wave-0 scaffold pattern (Plan 05-01): this file imports
 * the not-yet-built target module so that:
 *   1. `npx jest --listTests` discovers it as a real <automated> verify target
 *      for the Wave-2/Wave-3 plans that will fill these bodies, AND
 *   2. the `import { NotificationService } from '../NotificationService'` line
 *      acts as a compile/run-time WIRING CHECK — it stays red until the service
 *      module exists, then goes green when Wave 2 ships NotificationService.
 *
 * Bodies are `test.todo` on purpose. The load-bearing artifact at this wave is
 * the import + the enumerated VALIDATION behaviors, NOT executable assertions.
 *
 * Contract notes:
 *   - NotificationService is its OWN domain module (mirrors ModerationService
 *     split, PROJECT DEBT-01 precedent). MOB-01 guardrail: notification HTTP
 *     must NOT be glued onto AuthService — there is an explicit todo locking
 *     that intent so a later plan cannot silently regress.
 *   - Methods exercised: getFeed (cursor passthrough), getUnreadCount, markRead,
 *     markAllRead, createSubscription, deleteSubscription.
 */

// WIRING CHECK (Wave-0): imports the future module so this scaffold turns green
// the moment Wave 2 lands src/services/notifications/NotificationService.ts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { NotificationService } from '../NotificationService';

describe('NotificationService (Wave 0 scaffold)', () => {
  // Keep the import referenced so it is not tree-shaken / lint-stripped.
  void NotificationService;

  // -------------------- Feed + unread count --------------------
  test.todo(
    'getFeed passes the opaque base64 cursor through to GET /api/notifications and returns { rows, nextCursor }',
  );
  test.todo('getUnreadCount GETs /api/notifications/unread-count and returns the numeric count');

  // -------------------- Mutations --------------------
  test.todo('markRead PATCHes /api/notifications/:id/read and returns response.data');
  test.todo('markAllRead PATCHes /api/notifications/read-all and returns response.data');

  // -------------------- Subscriptions --------------------
  test.todo(
    'createSubscription POSTs /api/notifications/subscriptions (Saved Search + Watch) and returns the created subscription',
  );
  test.todo('deleteSubscription DELETEs /api/notifications/subscriptions/:id and returns response.data');

  // -------------------- MOB-01 guardrail (T-12-02-02 mitigation) --------------------
  test.todo(
    'MOB-01 guardrail: notification HTTP lives ONLY on NotificationService — AuthService has zero notification methods (no auth-client bloat / accidental exposure)',
  );
});
