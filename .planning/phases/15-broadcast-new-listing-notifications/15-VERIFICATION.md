---
phase: 15-broadcast-new-listing-notifications
verified: 2026-06-10T14:00:00Z
status: human_needed
score: 7/7
overrides_applied: 0
human_verification:
  - test: "End-to-end on a real device: create an active listing from Account A, verify that Account B (with a registered device token, not the seller) receives exactly one OS push and one bell entry; tap the push and confirm it opens carex://search (browse/newest-first), NOT the single car detail"
    expected: "One push notification delivered to Account B; tapping opens the search/browse surface; one unread bell entry visible in Account B's notification center"
    why_human: "Real FCM delivery and OS push surface cannot be verified programmatically; deep-link routing requires a live device session"
  - test: "Daily-cap rollover: drive Account B to its dailyCap limit (default 3) of broadcast pushes within one Bishkek day by triggering multiple new-listing creates; verify that further broadcasts show in the bell list but produce no push; after 08:00 Asia/Bishkek the next day, verify pushes resume"
    expected: "In-app bell receives rows for every broadcast; OS push is absent for listings beyond the cap; cap resets after the Bishkek 08:00 boundary"
    why_human: "Requires a real wall-clock rollover across the Asia/Bishkek 08:00 boundary; cannot be automated without manipulating production time"
deploy_note: "OPERATIONAL FOLLOW-UP — NOT a phase failure: all 9 Phase-15 backend commits (5d4673d..b824168) are committed on backend `main` but are local-ahead of origin/main (9 commits unpushed). Railway deploys backend `main` (MEMORY: notifications_branch_topology). Broadcast delivery does NOT reach production until `git push origin main` is run in carEx-services. Mobile commits 9318741 + 7c90bb8 are in carEx/main and already local; they also need a push if not yet pushed."
---

# Phase 15: Broadcast New-Listing Notifications — Verification Report

**Phase Goal:** When a new active car listing is created, every push-enabled user (except the seller and except users who already received a saved-search match for that listing) receives exactly one OS push and one in-app feed entry — gated by a per-user daily cap — without the user having created any saved search or watch.

**Verified:** 2026-06-10T14:00:00Z
**Status:** HUMAN_NEEDED (all automated checks pass; 2 end-to-end behaviors require device testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Broadcast audience = all token-holder uids except the actor (seller); actor never receives a broadcast row or push | VERIFIED | `notificationService.js:299-300` — `DeviceToken.distinct('uid')` filtered by `u !== event.actorUid`; `broadcast.test.js` "audience excludes actor" GREEN 1/1 |
| 2 | A user who received a saved-search match (new_match) for a listing gets exactly one notification for it — the saved-search row wins, no broadcast row | VERIFIED | `notificationService.js:295` — `ssUids = new Set(written.map(r => r.uid))` excludes saved-search recipients from broadcast `candidate` set; `broadcast.test.js` "saved-search wins dedup" GREEN 1/1 |
| 3 | Each eligible, non-capped recipient gets exactly one in-app Notification row and exactly one OS push (`carex://search` deeplink, PII-free) | VERIFIED | `notificationService.js:342-358` — row always written; `fcm.send({ titleKey:'new_listing', lang:u.language, data:{deeplink:'carex://search'} })` when `!suppress`; `broadcast.test.js` "row + push per recipient" GREEN 1/1 |
| 4 | A user at or over their daily push cap gets the in-app row (pushSuppressed:true) but no OS push | VERIFIED | `notificationService.js:337-357` — `suppress = sentToday >= cap`; row created with `pushSuppressed:suppress`; `fcm.send` skipped when `suppress`; `broadcast.test.js` "over cap suppresses push not row" GREEN 1/1 |
| 5 | Cap is per-user dailyCap (default 3), counted only since the Asia/Bishkek 08:00 boundary; in-app row is never capped | VERIFIED | `notificationService.js:330-336` — `cap = (u.notificationPrefs && u.notificationPrefs.dailyCap) ?? 3`; `countDocuments` with `pushSuppressed:{$ne:true}` + `createdAt:{$gte:boundary}` where `boundary = bishkekMorningBoundary(now)`; `DIGEST_HOUR=8` imported from `digest.js:48`; `broadcast.test.js` "cap counts since bishkek boundary" GREEN with exact `2026-06-10T02:00:00.000Z` boundary assertion |
| 6 | `newListingEnabled:false` or `muteAll:true` suppresses both push and in-app row; absent field (legacy doc) is treated as enabled | VERIFIED | `notificationService.js:307-313` — `User.find({'notificationPrefs.muteAll':{$ne:true},'notificationPrefs.newListingEnabled':{$ne:false}})`; `broadcast.test.js` "opt-out suppresses; legacy doc enabled" GREEN 1/1; `User.js:32` — `newListingEnabled:{type:Boolean,default:true}` |
| 7 | A listing hidden/suspended/sold between create and send produces zero broadcast rows and zero pushes | VERIFIED | `notificationService.js:220-221` — `if (!visible \|\| visible.status !== 'active') return []` runs before broadcast branch; broadcast branch at line 280 reuses `visible` already-hide-hook'd Car without re-fetch or bypass flags; `guards.test.js` "hidden/non-active car → 0 broadcast rows AND 0 fcm.send" GREEN; grep gate (`.setOptions(` = 0, `{ includeAll` = 0) GREEN |

**Score: 7/7 truths verified**

---

### Required Artifacts

| Artifact | Role | Status | Evidence |
|----------|------|--------|----------|
| `carEx-services/src/notifications/notificationService.js` | Core broadcast branch (`new_listing` → audience resolve, cap, dedup, row+push) | VERIFIED | Lines 273-363 implement the complete branch; all 7 broadcast tests pass |
| `carEx-services/src/models/User.js` | `newListingEnabled: {type:Boolean,default:true}` | VERIFIED | Line 32-34 confirmed; `dailyCap` default 3 (R-01) at line 37 |
| `carEx-services/src/models/Notification.js` | `pushSuppressed: {type:Boolean,default:false}` | VERIFIED | Lines 34-39 confirmed; existing `{uid,createdAt:-1}` index serves cap count |
| `carEx-services/src/notifications/translations.js` | `new_listing` + `push_new_listing` RU/EN, PII-free | VERIFIED | Lines 53-55 (RU in-app), 73 (RU push), 118-120 (EN in-app), 130 (EN push); zero `{param}` tokens |
| `carEx-services/server.js` | R-02: `PUT /api/users/:uid` persists `notificationPrefs` via allowlisted dot-path `$set` | VERIFIED | Lines 542-598: `buildNotificationPrefUpdate()` + `{ $set: update }` + IDOR guard on `req.params.uid` |
| `carEx-services/src/notifications/__tests__/broadcast.test.js` | 7 DI unit tests covering all broadcast behaviors | VERIFIED | All 7 tests GREEN (run confirmed) |
| `carEx-services/src/notifications/__tests__/guards.test.js` | Req 6 hide-hook + grep gate (6 tests total) | VERIFIED | All 6 tests GREEN (run confirmed) |
| `carEx-services/__tests__/users-prefs.test.js` | R-02 persistence, no-clobber, allowlist, IDOR (4 tests) | VERIFIED | All 4 tests GREEN (run confirmed) |
| `carEx/src/screens/NotificationSettingsScreen.tsx` | "New Listings" toggle, default ON, persists `newListingEnabled` | VERIFIED | Lines 69/108-109/239-242/429-433 confirmed |
| `carEx/src/constants/translations.ts` | `categoryNewListings` RU + EN | VERIFIED | Lines 1024 (RU `'Новые объявления'`) + 2092 (EN `'New listings'`) confirmed |
| `carEx/src/screens/__tests__/NotificationSettingsScreen.test.tsx` | Default-ON + persist-on-toggle (2 new tests) | VERIFIED | Both new tests GREEN in 9/9 total suite run |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `server.js` new listing create | `notificationService.emit()` | `server.js:948` — `notificationService.emit({type:'new_listing',carId,actorUid})` after-commit, wrapped in try/catch | WIRED | Lines 942-955 confirmed |
| `notificationService.emit` broadcast branch | `DeviceToken.distinct('uid')` | `notificationService.js:299` | WIRED | Confirmed |
| `notificationService.emit` broadcast branch | `User.find({...$ne filters...}).select('firebaseUid notificationPrefs.dailyCap language')` | `notificationService.js:307-313` | WIRED | Confirmed; `language` selection ensures per-recipient RU/EN push |
| Broadcast branch | `fcm.send({uid,titleKey:'new_listing',lang:u.language,data})` | `notificationService.js:357` | WIRED | `fcm.js:174-177` accepts `titleKey`, auto-prefixes to `push_new_listing`, calls `renderGenericPush` |
| `fcm.send('new_listing')` | `translations.js push_new_listing` | `fcm.js:176-177` — `renderGenericPush(categoryKey, lang)` prefixes `push_` | WIRED | `push_new_listing` present in both RU (line 73) and EN (line 130) |
| `NotificationSettingsScreen` toggle | `AuthService.updateBackendUser({notificationPrefs:{newListingEnabled}})` | `onToggleNewListing` → `persistPrefs` | WIRED | Lines 239-242 in screen; `persistPrefs` delegates to existing `AuthService.updateBackendUser` path |
| `AuthService.updateBackendUser` | `PUT /api/users/:uid` R-02 handler | HTTP PUT — existing mobile service method | WIRED | `server.js:572-598` now persists `notificationPrefs` via `buildNotificationPrefUpdate()` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `notificationService.js` broadcast branch | `tokenUids` (broadcast audience) | `DeviceToken.distinct('uid')` — live DB query | Yes — indexed on `uid` | FLOWING |
| `notificationService.js` broadcast branch | `recipients` (pref-filtered users) | `User.find({...}).select(...)` — live DB query with `$ne` filters | Yes — Mongoose model registered; `$ne` so legacy docs pass | FLOWING |
| `notificationService.js` broadcast branch | `sentToday` (cap count) | `Notification.countDocuments({uid,kind:'new_listing',pushSuppressed:{$ne:true},createdAt:{$gte:boundary}})` | Yes — existing `{uid,createdAt:-1}` index serves this | FLOWING |
| `NotificationSettingsScreen` | `newListingEnabled` state | `prefs.newListingEnabled ?? true` from `user.notificationPrefs` (AuthContext merge of backendUser) | Yes — `User.js` schema default `true` flows through `getBackendUser` response | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| broadcast.test.js 7/7 pass | `npx jest src/notifications/__tests__/broadcast.test.js` | 7 passed, 0 failed | PASS |
| guards.test.js 6/6 pass (incl. Phase 15 additions) | `npx jest src/notifications/__tests__/guards.test.js` | 6 passed, 0 failed | PASS |
| users-prefs.test.js 4/4 pass | `npx jest __tests__/users-prefs.test.js` | 4 passed, 0 failed | PASS |
| Mobile NotificationSettingsScreen 9/9 pass | `npx jest src/screens/__tests__/NotificationSettingsScreen.test.tsx` | 9 passed, 0 failed | PASS |
| Full backend suite — no new regressions | `npm test` (carEx-services) | 479 passed, 2 failed (both pre-existing ServiceOrder.providerSnapshot) | PASS |
| Grep gate: no `.setOptions(` in notificationService.js | `grep -c '.setOptions(' notificationService.js` | 0 matches | PASS |
| Grep gate: no `{ includeAll` bypass flag | `grep -cP '\{\s*includeAll' notificationService.js` | 0 matches | PASS |
| `new_listing_broadcast` literal present in notificationService.js | grep count | 2 matches (dedupeKey string + KEYS_BY_EVENT entry) | PASS |
| `DeviceToken.distinct` call present | grep count | 1 match | PASS |

---

### Requirements Coverage

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| Req 1 | Broadcast audience = token-holders, actor excluded | SATISFIED | `notificationService.js:285-300`; broadcast.test.js "audience excludes actor" GREEN |
| Req 2 | Saved-search-matched uid gets new_match only, not broadcast | SATISFIED | `notificationService.js:295`; broadcast.test.js "saved-search wins dedup" GREEN |
| Req 3 | Each eligible non-capped recipient → 1 row + 1 push; deeplink `carex://search` | SATISFIED | `notificationService.js:341-358`; broadcast.test.js "row + push per recipient" GREEN; `data.deeplink:'carex://search'` verified |
| Req 4 | At cap → row with `pushSuppressed:true`, no push; cap = dailyCap (default 3), counted since Bishkek 08:00 | SATISFIED | `notificationService.js:330-337`; `Notification.pushSuppressed` field (Notification.js:39); broadcast.test.js "over cap suppresses push not row" + "cap counts since bishkek boundary" GREEN |
| Req 5 | `newListingEnabled` toggle default ON (opt-out); muting stops push + feed entry; absent field = enabled | SATISFIED | `User.js:32` (default true); `notificationService.js:307-313` (`$ne:false`); mobile toggle `?? true`; broadcast.test.js "opt-out suppresses; legacy doc enabled" GREEN; `NotificationSettingsScreen.test.tsx` 2 new tests GREEN |
| Req 5 (R-02) | `PUT /api/users/:uid` persists `notificationPrefs` (allowlist, dot-path $set, IDOR-safe) | SATISFIED | `server.js:542-598` `buildNotificationPrefUpdate()`; users-prefs.test.js 4/4 GREEN |
| Req 6 | Hidden/non-active car → 0 broadcast rows + 0 pushes; no bypass flag | SATISFIED | `notificationService.js:220-221` (hide-hook before broadcast branch); guards.test.js "hidden/non-active car → 0 broadcast rows" GREEN; grep gate GREEN |
| Req 7 | `push_new_listing` + in-app `new_listing` RU/EN, PII-free, zero `{param}` tokens | SATISFIED | `translations.js:53-55,73,118-120,130`; parity tests GREEN (17/17 in 15-03 run); zero interpolation tokens in all 4 entries |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/HACK markers found in Phase-15-modified files | — | None |

No debt markers, no placeholder returns, no hardcoded empty props, no stubs. The `safeModel()` no-op is correctly scoped to DB-less unit tests only and documented as such; production always has both models registered.

---

### Human Verification Required

#### 1. End-to-End Push Delivery and Tap Target

**Test:** On two devices (or one device + simulator), log in as Account B (not the seller). From Account A, create a new active car listing via the sell flow. Within a few seconds, check Account B's device.

**Expected:** Account B receives one OS push notification with title "Новые объявления" (if language=RU) or "New listings" (EN), body matching the generic copy. Tapping the push opens the search/browse results screen (carex://search — newest-first listing browse), NOT a single car detail page. Account B's notification bell shows one new unread entry.

**Why human:** Real FCM delivery requires a live registered device token, an active server connection, and Railway-deployed backend. Neither the DI unit tests nor offline code analysis can verify the FCM → APNS/FCM → OS push delivery chain, or that the deep-link navigation in the React Native app correctly routes `carex://search` to the browse screen.

#### 2. Daily Cap Rollover Across the Bishkek 08:00 Boundary

**Test:** Using an account with `dailyCap = 3` (default), trigger 4+ new-listing broadcasts within the same Bishkek day (create 4 active listings from a different seller account). After the 3rd broadcast, confirm Account B's bell shows a 4th entry but no 4th OS push was delivered. After 08:00 Asia/Bishkek (02:00 UTC) the following calendar day, trigger one more listing and confirm the push resumes.

**Expected:** Pushes 1-3 delivered; push 4 absent but in-app bell entry present (`pushSuppressed:true` in the DB row); push 5 (post-boundary) delivered.

**Why human:** Wall-clock Asia/Bishkek rollover requires real time passage (or server-side clock manipulation). The unit test asserts the boundary math is correct for a fixed timestamp; actual cross-midnight delivery behavior requires a live session.

---

### Gaps Summary

No gaps. All 7 must-have truths are VERIFIED by code evidence and passing tests. The phase is implementation-complete.

---

### Operational Follow-Up (NOT a phase failure)

**Backend commits are local-ahead of origin/main.** All 9 Phase-15 backend commits (`5d4673d` through `b824168`) are on backend `main` but have not been pushed to `origin/main`. Railway deploys backend `main` (per project MEMORY `notifications_branch_topology`). Broadcast delivery will NOT reach production until:

```
cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services
git push origin main
```

The mobile commits (`9318741`, `7c90bb8`) are in carEx/main and similarly need to be pushed if not yet pushed. This is a deployment action, not an implementation deficiency.

---

*Verified: 2026-06-10T14:00:00Z*
*Verifier: Claude (gsd-verifier)*
