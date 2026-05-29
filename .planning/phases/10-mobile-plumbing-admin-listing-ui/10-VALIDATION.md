---
phase: 10
slug: mobile-plumbing-admin-listing-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: derived from `10-RESEARCH.md` § Validation Architecture (Section 12).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.6.3 (react-native preset) |
| **Config file** | `package.json` (`"jest": { "preset": "react-native" }`) |
| **Quick run command** | `npx jest --testPathPattern=moderation --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s quick / ~60s full |
| **Backend framework** | jest (in `../backend-services/carEx-services`) |
| **Backend quick run** | `cd ../backend-services/carEx-services && npx jest --testPathPattern=listingModeration --bail` |
| **Backend full run** | `cd ../backend-services/carEx-services && npm test` |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=moderation --bail`
- **After every plan wave:** Run `npm test` (mobile) + backend full suite if backend slice modified
- **Before `/gsd-verify-work`:** Both suites green + manual UAT checklist below
- **Max feedback latency:** ~15s for unit/component; ~60s for full suites

---

## Per-Task Verification Map

> Plan + Task IDs are placeholders (`{plan}-{task}`); planner backfills in PLAN.md frontmatter. Each row maps to a verification scenario from `10-RESEARCH.md` §12.

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 (errors) | 1 | LMOB-02 | `ListingModerationError` extends Error with all 8 code-union members | unit | `npx jest src/services/moderation/__tests__/listingErrors.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 (errors) | 1 | LMOB-02 | Constructed error preserves `httpStatus`, `listingStatus`, `reasonCategory`, `banner`, `refundId`, `refundFailed` | unit | same as above | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 (service) | 2 | LMOB-01 | `ModerationService.adminEditListing(carId, input)` POSTs/PUTs to `/api/admin/moderation/listings/:carId` with multipart and re-throws as `ListingModerationError` on 4xx | integration (mocked apiClient) | `npx jest src/services/moderation/__tests__/listingMethods.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 (service) | 2 | LMOB-01 | `suspendListing` / `archiveListing` / `deleteListing` each send `{ reasonCategory, note? }` to the matching `/<action>` path | integration | same | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 (service) | 2 | LMOB-01 | `restoreListing(carId, { note? })` sends body without `reasonCategory` | integration | same | ❌ W0 | ⬜ pending |
| 10-02-04 | 02 (service) | 2 | LMOB-01 | `searchListings({ status, q, cursor, limit })` GETs the new admin listings endpoint and returns `{ rows, nextCursor }` | integration | same | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 (interceptor proof) | 2 | LMOB-02 | `src/services/http/client.ts` line ~103 still guards on `error === 'account_suspended'` ONLY (source assertion + grep) | source | `grep -n "account_suspended" src/services/http/client.ts` | ✅ existing | ⬜ pending |
| 10-03-02 | 03 (interceptor proof) | 2 | LMOB-02 | A 409 `listing_not_available` response does NOT trigger logout (mock 409 → assert AuthContext.user remains) | integration | `npx jest src/services/http/__tests__/clientListing409.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-03 | 03 (interceptor proof) | 2 | LMOB-02 | A 403 `cannot_moderate_own_listing` response does NOT trigger logout (mock 403 → assert AuthContext.user remains) | integration | same | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 (sentinel helper) | 2 | LUI-02 | `buildListingTitle(car)` returns `${year} ${makeName} ${modelName}` trimmed; falls back to id strings when names missing | unit | `npx jest src/utils/__tests__/listingTitle.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-02 | 04 (sentinel helper) | 2 | LUI-02 | Case-insensitive + whitespace-trimmed match returns true for `"2018 toyota CAMRY "` vs canonical `"2018 Toyota Camry"` | unit | same | ❌ W0 | ⬜ pending |
| 10-05-01 | 05 (bottom sheet) | 3 | LUI-01, LUI-02 | `ListingModerationBottomSheet` renders 4 rows (Edit/Suspend/Archive/Delete) when `moderationBadge.status === 'active'` | component | `npx jest src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx` | ❌ W0 | ⬜ pending |
| 10-05-02 | 05 (bottom sheet) | 3 | LUI-03 | Sheet swaps to single Restore button + reason-category chip when `status !== 'active'` | component | same | ❌ W0 | ⬜ pending |
| 10-05-03 | 05 (bottom sheet) | 3 | LUI-02 | Each action row uses the spec'd severity color (pencil-neutral / orange-warning / gray-neutral / red-destructive) | component | same | ❌ W0 | ⬜ pending |
| 10-06-01 | 06 (reason modal) | 3 | LUI-02 | `ListingModerationReasonModal` rejects submit unless `reasonCategory ∈ {spam, policy_violation, fraud, inactive_seller, other}` | component | `npx jest src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx` | ❌ W0 | ⬜ pending |
| 10-06-02 | 06 (reason modal) | 3 | LUI-02 | Delete action escalates to `TypedConfirmationModal` and only fires `onSubmit` when sentinel match succeeds | component | same | ❌ W0 | ⬜ pending |
| 10-06-03 | 06 (restore modal) | 3 | LUI-03 | `ListingRestoreModal` accepts optional note (max 2000) and submits `{ note? }` only | component | `npx jest src/components/moderation/__tests__/ListingRestoreModal.test.tsx` | ❌ W0 | ⬜ pending |
| 10-07-01 | 07 (CarDetails wiring) | 4 | LUI-01 | "Moderate" badge renders only when `useAuth().isAdmin === true` (`render with isAdmin=false → query→null`) | component | `npx jest src/screens/__tests__/CarDetailsScreen.admin.test.tsx` | ❌ W0 | ⬜ pending |
| 10-07-02 | 07 (CarDetails wiring) | 4 | LUI-01 | Status banner renders `moderationBadge.banner.severity` color + reasonCategory chip + setBy admin info when present | component | same | ❌ W0 | ⬜ pending |
| 10-07-03 | 07 (CarDetails wiring) | 4 | LMOB-02 | `ListingModerationError.code === 'cannot_moderate_own_listing'` surfaces as inline banner (NOT Alert) | component | same | ❌ W0 | ⬜ pending |
| 10-07-04 | 07 (CarDetails wiring) | 4 | LMOB-01 | Optimistic flip + rollback on error (mock service throws → badge reverts + Alert shown) | component | same | ❌ W0 | ⬜ pending |
| 10-07-05 | 07 (axios migration) | 4 | LUI-01 | `CarDetailsScreen.tsx` uses `apiClient.get(...)` not bare `axios.get(...)` (source assertion — load-bearing for admin flow per RESEARCH A6) | source | `! grep -nE "axios\\.get\\(" src/screens/CarDetailsScreen.tsx` | ✅ failing today | ⬜ pending |
| 10-08-01 | 08 (SellCar adminEdit) | 4 | LUI-02 | `route.params?.adminEdit === true` bypasses all 4 `sellerStatus === 'APPROVED'` gates in SellCarScreen | component | `npx jest src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` | ❌ W0 | ⬜ pending |
| 10-08-02 | 08 (SellCar adminEdit) | 4 | LUI-02 | Submit swaps to `ModerationService.adminEditListing(carId, ...)` when `adminEdit` is true | component | same | ❌ W0 | ⬜ pending |
| 10-08-03 | 08 (SellCar adminEdit) | 4 | LUI-02 | OTP / phone-verification gate also bypassed when `adminEdit === true` | component | same | ❌ W0 | ⬜ pending |
| 10-09-01 | 09 (AdminMod tabs) | 5 | LUI-04 | `AdminModerationScreen` renders `Users | Listings` tab control; default tab = Users (preserves muscle memory) | component | `npx jest src/screens/__tests__/AdminModerationScreen.tabs.test.tsx` | ❌ W0 | ⬜ pending |
| 10-09-02 | 09 (AdminMod tabs) | 5 | LUI-04 | Listings tab renders search bar + chip row (`All\|Active\|Suspended\|Archived\|Deleted`) + paginated FlatList | component | same | ❌ W0 | ⬜ pending |
| 10-09-03 | 09 (AdminMod listings) | 5 | LUI-04 | Per-row Recover button visible ONLY when row `status === 'deleted'`; tap → `ModerationService.restoreListing(carId)` → optimistic row update | component | same | ❌ W0 | ⬜ pending |
| 10-09-04 | 09 (AdminMod listings) | 5 | LUI-04 | Row tap pushes `CarDetailsScreen` (admin variant) | component | same | ❌ W0 | ⬜ pending |
| 10-10-01 | 10 (backend GET) | 1 (parallel to mobile substrate) | LUI-04 | `GET /api/admin/moderation/listings?status=&q=&cursor=&limit=` returns 200 + `{ rows, nextCursor }` for admin caller | integration | `cd ../backend-services/carEx-services && npx jest src/moderation/__tests__/listingRouter.search.test.js` | ❌ W0 | ⬜ pending |
| 10-10-02 | 10 (backend GET) | 1 | LUI-04 | Endpoint passes `setOptions({ includeAllListingStatuses: true })` so deleted/suspended/archived rows are NOT filtered by Phase 9 hide hook | integration | same | ❌ W0 | ⬜ pending |
| 10-10-03 | 10 (backend GET) | 1 | LUI-04 | `q` substring search matches `title` (year+makeName+modelName), `makeName`, `modelName`, and `_id` prefix — explicitly NOT `description` / `phoneNumber` / `telegramUsername` (PII guard from RESEARCH §13) | integration | same | ❌ W0 | ⬜ pending |
| 10-10-04 | 10 (backend GET) | 1 | LUI-04 | Non-admin caller returns 403 (verifyIdToken + requireAdmin chain) | integration | same | ❌ W0 | ⬜ pending |
| 10-10-05 | 10 (backend GET) | 1 | LUI-04 | Cursor pagination keys on `{ moderatedAt, _id }` for non-active filters, `{ createdAt, _id }` for `status=active` | integration | same | ❌ W0 | ⬜ pending |
| 10-11-01 | 11 (anti-patterns) | 5 | LMOB-01 | `grep -c 'suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing' src/services/AuthService.ts` returns 0 | source | `! grep -E "suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing" src/services/AuthService.ts` | ✅ today | ⬜ pending |
| 10-11-02 | 11 (anti-patterns) | 5 | LMOB-02 | `src/services/http/client.ts` has exactly 2 response interceptors (403 user-suspension + 401 refresh); no third interceptor added | source | grep + line count assertion | ✅ today | ⬜ pending |
| 10-11-03 | 11 (anti-patterns) | 5 | LMOB-01 | `ListingModerationError` is a SEPARATE class from `ModerationError` (no widening of original union) | source | `grep -A2 "class ModerationError" src/services/moderation/errors.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/services/moderation/__tests__/listingErrors.test.ts` — stubs for LMOB-02 (`ListingModerationError` shape + code union)
- [ ] `src/services/moderation/__tests__/listingMethods.test.ts` — stubs for LMOB-01 (5 new service methods + `searchListings`)
- [ ] `src/services/http/__tests__/clientListing409.test.ts` — stubs for LMOB-02 (interceptor non-firing on 403/409 listing errors)
- [ ] `src/utils/__tests__/listingTitle.test.ts` — stubs for LUI-02 (canonical title helper + case-insensitive match)
- [ ] `src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx` — stubs for LUI-01 / LUI-02 / LUI-03
- [ ] `src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx` — stubs for LUI-02 (reason categories + Delete typed-confirmation flow)
- [ ] `src/components/moderation/__tests__/ListingRestoreModal.test.tsx` — stubs for LUI-03
- [ ] `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` — stubs for LUI-01 (admin badge gate, banner, optimistic+rollback, error surfacing, axios→apiClient migration)
- [ ] `src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` — stubs for LUI-02 (4 seller-gate bypasses + endpoint swap + OTP bypass)
- [ ] `src/screens/__tests__/AdminModerationScreen.tabs.test.tsx` — stubs for LUI-04 (Users|Listings tabs + search + filter chips + Recover row action)
- [ ] `../backend-services/carEx-services/src/moderation/__tests__/listingRouter.search.test.js` — stubs for LUI-04 (admin GET endpoint shape, hide-hook bypass, PII guard on `q`, cursor pagination, 403 for non-admin)
- [ ] Shared mock fixtures: `__mocks__/apiClient.ts` (mock 403/409/400/404 listing error responses), `__fixtures__/moderationBadge.ts` (sample badges per status: active / suspended / archived / deleted)

*Note: jest infra exists at root + backend; no new framework installs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom-sheet slide-up animation looks/feels right on physical iOS device | LUI-01 | RN `Modal animationType="slide"` rendering varies across simulator vs device | Build dev iOS, log in as admin, open any listing → tap Moderate badge → confirm sheet slides from bottom with no jank |
| Typed sentinel keyboard shows spacebar (NOT email layout) on iOS | LUI-02 | TypedConfirmationModal uses `keyboardType="email-address"` today (per RESEARCH Pitfall #1); listing-title sentinel "2018 Toyota Camry" needs spaces | Build dev iOS, log in as admin → tap Delete → assert keyboard has visible spacebar |
| Severity colors render correctly on Android (where COLORS.moderation.* may need theme extension) | LUI-01, LUI-04 | Android theming subtle differences from iOS | Build dev Android, log in as admin → suspend a listing → confirm orange-warning banner / Listings-tab status badge |
| Pull-to-refresh on Listings tab updates the row set | LUI-04 | RefreshControl + FlatList behavior is gestural | Manual: pull-down on Listings tab → confirm spinner + new rows arrive |
| Optimistic flip + rollback feels smooth (no double-render flicker) | LUI-01, LUI-03 | UX feel | Manual: trigger Suspend → confirm immediate banner update → trigger backend error scenario (e.g., disable backend) → confirm rollback + Alert |
| RU translation strings render correctly (Phase 11 LQUAL-01 audits parity; Phase 10 dev with EN placeholders) | LUI-01..04 | i18n parity audit deferred | Manual: switch app to RU → confirm no obvious key-leakage (placeholder keys visible to user) — log any missing strings for Phase 11 |
| Cart 409 `listing_not_available` surfaces visibly | LMOB-02 | Phase 11 lands buyer-side banner; Phase 10 just ensures the error reaches a visible surface | Manual: as buyer add to cart → admin suspends listing → buyer confirm-booking → assert visible error (placeholder copy OK) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (12 stub files listed above)
- [ ] No watch-mode flags (all commands use `--bail` or single-run mode)
- [ ] Feedback latency < 15s for quick / < 60s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter after planner backfills task IDs

**Approval:** pending
