---
phase: quick-260603-hjg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/CarDetailsScreen.tsx
autonomous: false
requirements:
  - SELLER-STATUS-FIX
must_haves:
  truths:
    - "Tapping Mark as booked / sold / available sends a PATCH and persists, even on navigation paths where car.id is undefined"
    - "The button reflects the new status immediately (optimistic), and reverts if the PATCH fails"
    - "A failed status update shows a visible Alert with HTTP status and backend message, not a silent console.error"
  artifacts:
    - path: "src/screens/CarDetailsScreen.tsx"
      provides: "updateListingStatus with resilient id resolution, optimistic update + rollback, and visible error Alert"
      contains: "car?._id || car?.id || carId"
  key_links:
    - from: "updateListingStatus"
      to: "PATCH /api/cars/:id/status"
      via: "axios.patch with docId in URL"
      pattern: "api/cars/\\$\\{docId\\}/status"
---

<objective>
Fix the seller "Mark as booked / sold / available" controls doing nothing on prod.

Root cause: `updateListingStatus` in `src/screens/CarDetailsScreen.tsx` early-returns when `car?.id`
is undefined. On several navigation paths the car object carries `_id` but not `id`, so the guard
`if (!user?.localId || !car?.id) return;` aborts before the PATCH fires — no error, never persists.
The sibling buyer flow already resolves the id resiliently (`car._id || car.id || ''`, ~line 371),
proving `id` is unreliable across paths.

Purpose: Sellers can change listing status reliably, with instant feedback and visible failures.
Output: A corrected `updateListingStatus` (lines 326-341) — no backend changes, no other refactors.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# The single file to modify. Relevant in-scope identifiers (already in the component closure):
#   - route param `carId` at line 42
#   - state `statusUpdating` (51) and `localListingStatus` (52)
#   - derived `listingStatus` (86) — the current status, used as the rollback baseline
#   - derived `car` (85) — may have `_id` but not `id` on some paths
#   - `setLocalListingStatus` (52), `setStatusUpdating` (51)
#   - buyer-flow id resolution to mirror: `const carId = car._id || car.id || '';` (~line 371)
@src/screens/CarDetailsScreen.tsx

<interfaces>
<!-- Current implementation to replace (lines 326-341). Executor edits ONLY this function. -->
```typescript
const updateListingStatus = async (newStatus: 'active' | 'booked' | 'sold') => {
  if (!user?.localId || !car?.id) return;
  setStatusUpdating(true);
  try {
    await axios.patch(`${API_URL}/api/cars/${car.id}/status`, {
      sellerId: user.localId,
      listingStatus: newStatus,
    });
    setLocalListingStatus(newStatus);
  } catch (err) {
    console.error('Update status failed', err);
    Alert.alert(t.error || 'Error', 'Failed to update listing status.');
  } finally {
    setStatusUpdating(false);
  }
};
```

Available in scope (do not re-declare): `user`, `car`, `carId`, `listingStatus`,
`setLocalListingStatus`, `setStatusUpdating`, `API_URL`, `axios`, `Alert`, `t`.
Backend contract (verified, do not change): `PATCH /api/cars/:id/status`
body `{ sellerId, listingStatus }` → 200 on correct seller, 403 on wrong seller.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix updateListingStatus — resilient id, optimistic update with rollback, visible error</name>
  <files>src/screens/CarDetailsScreen.tsx</files>
  <action>
Rewrite ONLY the `updateListingStatus` function body (lines 326-341). Make exactly these three changes; touch nothing else in the file:

1. Root cause — resilient id resolution. At the top of the function compute
   `const docId = car?._id || car?.id || carId;` (mirroring the buyer flow at ~line 371; `carId`
   is the route param from line 42). Change the early-return guard to test `docId` instead of
   `car?.id`: `if (!user?.localId || !docId) return;`. Use `docId` in the PATCH URL:
   `axios.patch(`${API_URL}/api/cars/${docId}/status`, ...)`.

2. Optimistic update with rollback. Before the try block, capture the current status as the
   rollback baseline: `const previousStatus = listingStatus;` (the derived value at line 86).
   Immediately set `setLocalListingStatus(newStatus);` for instant visual feedback. Keep
   `setStatusUpdating(true)` before the try and `setStatusUpdating(false)` in `finally` as-is.
   On success, no extra state write is needed (the optimistic value already reflects newStatus).
   In `catch`, revert with `setLocalListingStatus(previousStatus);`.

3. Visible error with detail. Replace the swallowed `console.error` failure path. In `catch`,
   read `err?.response?.status` and `err?.response?.data?.message` and surface them via
   `Alert.alert`. Keep the existing i18n style consistent with the file — reuse the existing
   translated title `t.error || 'Error'` and append the failure detail to the message string
   (e.g. base message plus `` `(${status}${message ? `: ${message}` : ''})` `` when a status is
   present). Do NOT add new translation keys; a fallback English base string is acceptable, matching
   the file's existing `t.error || 'Error'` pattern.

Do not add dependencies, do not change the status buttons (lines 719-751), do not change the backend,
and do not refactor any other function. `setStatusUpdating(true/false)` stays in try/finally.
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "CarDetailsScreen" || echo "no CarDetailsScreen type errors"</automated>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx && grep -n "car?._id || car?.id || carId" src/screens/CarDetailsScreen.tsx && grep -n "api/cars/\${docId}/status" src/screens/CarDetailsScreen.tsx && grep -n "setLocalListingStatus(previousStatus)" src/screens/CarDetailsScreen.tsx</automated>
  </verify>
  <done>
`updateListingStatus` resolves `docId = car?._id || car?.id || carId`, guards on `docId`, PATCHes
`/api/cars/${docId}/status`, optimistically sets `setLocalListingStatus(newStatus)` before the
request, reverts to `previousStatus` on failure, and surfaces an `Alert.alert` including
`err?.response?.status` / `err?.response?.data?.message`. `setStatusUpdating` remains in try/finally.
No other code changed; the grep checks above pass and tsc shows no new CarDetailsScreen errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Resilient id resolution + optimistic update/rollback + visible error in `updateListingStatus`.
The change targets the prod bug where status buttons silently did nothing on navigation paths
carrying `_id` but not `id`.
  </what-built>
  <how-to-verify>
1. Sign in as a seller who owns a listing. Open the listing from a path that previously failed
   (e.g. via SellerListings / a deep link / the carData nav param) so the car object carries `_id`.
2. Tap "Mark as booked". The button state should change immediately (optimistic), and the badge
   should reflect "booked". Pull-to-refresh or re-open the listing to confirm it persisted (status
   stays booked — proves the PATCH reached the backend).
3. Tap "Mark as available", then "Mark as sold" to confirm each transition persists.
4. (Optional failure check) If you can reproduce a 403 (e.g. an account that isn't the seller),
   confirm an Alert appears with the HTTP status / message and the button reverts to its prior state
   instead of silently sticking on the new value.
  </how-to-verify>
  <resume-signal>Type "approved" if status changes persist and feedback/errors behave, or describe what you saw.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` reports no new errors in CarDetailsScreen.tsx.
- The PATCH URL uses `docId` (not `car.id`), and the guard tests `docId`.
- Optimistic write + rollback present; failure path uses `Alert.alert` (no swallowed console-only error).
- No edits outside `updateListingStatus`; backend untouched.
</verification>

<success_criteria>
Seller status changes ("booked" / "sold" / "available") send the PATCH and persist on all navigation
paths, give instant visual feedback, revert on failure, and report failures with status + message.
</success_criteria>

<output>
After completion, create `.planning/quick/260603-hjg-seller-status-update-fix/260603-hjg-SUMMARY.md`
</output>
