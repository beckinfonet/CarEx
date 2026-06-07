/**
 * Phase 12 — Wave 0 scaffold (WatchButton).
 *
 * Mirrors the Phase 5 Wave-0 scaffold pattern (Plan 05-01). Imports the
 * not-yet-built WatchButton so:
 *   1. `npx jest --listTests` discovers it as a real <automated> verify target
 *      for the Wave-3 plan that ships WatchButton, AND
 *   2. the `import WatchButton from '../WatchButton'` line is the load-bearing
 *      WIRING CHECK — red until the component lands, then green.
 *
 * Bodies are `test.todo`. The single MOST load-bearing contract locked here is
 * the watch-subscription KEY: it MUST resolve as `car._id || car.id || carId`
 * and NEVER bare `car.id` (NSUB-04, D-04, project memory `car_id_field_unreliable`
 * — bare `car.id` caused a silent prod booking-status bug). The fallback order is
 * written verbatim in a test.todo string so the contract is grep-visible
 * (T-12-02-01 mitigation) before any implementation can regress it.
 */

import React from 'react';
// WIRING CHECK (Wave-0): imports the future component so this scaffold turns
// green the moment Wave 3 lands src/components/notifications/WatchButton.tsx.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WatchButton from '../WatchButton';

describe('WatchButton (Wave 0 scaffold)', () => {
  // Keep imports referenced so they are not tree-shaken / lint-stripped.
  void React;
  void WatchButton;

  // -------------------- D-01: sibling discipline (Bell, not Heart) --------------------
  test.todo(
    'renders a labeled Bell pill (the Watch affordance) — NOT a Heart/favorite variant (D-01 sibling discipline: Watch != Favorite)',
  );

  // -------------------- D-03: one tap opts into all 4 events --------------------
  test.todo(
    'one tap creates a Watch subscription opting into all 4 events (price drop / booked / sold / back-available) (D-03)',
  );

  // -------------------- NSUB-04 / D-04: watch-key contract (LOAD-BEARING) --------------------
  // The subscription key MUST be `car._id || car.id || carId` and NEVER bare
  // `car.id`. Fallback order is spelled out so the contract is grep-visible.
  test.todo(
    'the Watch subscription keys on `car._id || car.id || carId` and NEVER bare `car.id` (NSUB-04 / D-04 — prevents the prod booking-status class of bug from car_id_field_unreliable)',
  );
});
