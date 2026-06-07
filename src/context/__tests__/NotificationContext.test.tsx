/**
 * Phase 12 — Wave 0 scaffold (NotificationContext).
 *
 * Mirrors the Phase 5 Wave-0 scaffold pattern (Plan 05-01) + the existing
 * AuthContext.test.tsx harness shape (react-test-renderer, jest preset already
 * configured). This file imports the not-yet-built NotificationProvider +
 * useNotifications so:
 *   1. `npx jest --listTests` discovers it as a real <automated> verify target
 *      for the Wave-2 plan that ships NotificationContext, AND
 *   2. the import line is the load-bearing WIRING CHECK — it stays red until
 *      NotificationContext exists, then goes green when the context lands.
 *
 * Bodies are `test.todo`. The context mirrors CartContext / FavoritesContext:
 * provider + `use*` hook that throws if used outside its provider; per-user
 * auto-clear via a prevUidRef sentinel on `user.localId` transition
 * (FavoritesContext.tsx:55-63).
 */

import React from 'react';
// WIRING CHECK (Wave-0): imports the future provider + hook so this scaffold
// turns green the moment Wave 2 lands src/context/NotificationContext.tsx.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { NotificationProvider, useNotifications } from '../NotificationContext';

describe('NotificationContext (Wave 0 scaffold)', () => {
  // Keep imports referenced so they are not tree-shaken / lint-stripped.
  void React;
  void NotificationProvider;
  void useNotifications;

  // -------------------- NCEN-01: unread badge derives from context --------------------
  test.todo(
    'NCEN-01: unreadCount derives the bell badge state from the context — badge reflects the context unread count, not a separate fetch',
  );

  // -------------------- NPRF-07: in-app functional with no-op push --------------------
  test.todo(
    'NPRF-07: feed renders from the context even when push is a no-op stub (in-app center is the guaranteed denied-permission fallback)',
  );

  // -------------------- Auto-clear on uid change (mirrors FavoritesContext prevUidRef) --------------------
  test.todo(
    'auto-clears feed + unreadCount on user.localId transition (prevUidRef sentinel, skip-on-mount) so the next user never sees the previous user notifications',
  );

  // -------------------- Hook-outside-provider guard (Cart/Favorites pattern) --------------------
  test.todo('useNotifications throws when used outside a NotificationProvider');
});
