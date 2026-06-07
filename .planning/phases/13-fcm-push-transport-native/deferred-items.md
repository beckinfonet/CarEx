# Phase 13 — Deferred / Out-of-Scope Items

## Pre-existing test failure (NOT caused by 13-02)

**File (backend repo):** `__tests__/moderation/ServiceOrder.providerSnapshot.test.js`
**Failing tests (2):**
- `providerSnapshot is captured from the Broker/Logistics profile at order time` (companyName "Acme Brokerage")
- `providerSnapshot ... (companyName "FastShip")`

**Symptom:** Both expect `res.status === 201` but receive `410`.

**Verified pre-existing:** Reproduced identically on the plan's base commit `89a6e2d`
(`feat(12-05): confirmBooking booked emit ...`) BEFORE any 13-02 work. This is a
Phase-12 moderation/order test, unrelated to FCM push transport. Out of scope per
the executor SCOPE BOUNDARY rule (only auto-fix issues directly caused by the
current task's changes). Not investigated or modified here.

**Recommendation:** Triage separately (likely a moderation ServiceOrder route
returning 410 Gone — possibly a guard/feature-flag or seed-data drift in the
order-creation path). Track under Phase 12 moderation, not Phase 13.

## Pre-existing lint errors (NOT caused by 13-05)

Found while linting files touched by 13-05; present at HEAD before the plan,
unrelated to the pre-prompt / recovery work. Out of scope per the executor
SCOPE BOUNDARY rule.

- `src/screens/NotificationSettingsScreen.tsx:95` — `updateSubscription`
  destructured from `useNotifications()` but never used (was line 92 at HEAD).
  `@typescript-eslint/no-unused-vars`.
- `src/screens/NotificationSettingsScreen.tsx:99` — `prefs` render-scope const
  triggers `react-hooks/exhaustive-deps` on the `persistPrefs` useCallback (was
  line 96 at HEAD). Fix: wrap in `useMemo`.
- `src/screens/__tests__/NotificationSettingsScreen.test.tsx:3` —
  `TouchableOpacity` imported but never used (present at HEAD).
