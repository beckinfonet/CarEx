---
slug: list-car-failed-upload
status: awaiting_deploy_verification
trigger: after recent moderation milestone changes, pressing "List Car" on the sell-car form shows "Failed to upload car listing." error — every attempt fails
created: 2026-04-29
updated: 2026-04-29
platform: android
---

# Symptoms

- **Expected:** User fills out sell-car form (uploads pictures + vehicle info), presses "Разместить объявление" / "List Car" → listing is created and saved.
- **Actual:** Generic alert appears: title "Ошибка" / body "Failed to upload car listing." User taps OK and returns to the form.
- **Error message:** Exact alert text: `Failed to upload car listing.` (RU title: `Ошибка`). Visible in screenshot at /Users/beckmaldinVL/Downloads/PHOTO-2026-04-28-03-48-13.jpg.
- **Timeline:** Started after the admin moderation milestone work (Phase 6 — suspend/revoke/edit endpoints). Did not occur before.
- **Reproduction:** Every attempt fails. Reliably reproducible. Form is filled out completely; user has filled exterior/interior color, additional description, etc.
- **Platform observed:** Android (Samsung-style nav bar visible).
- **User's investigation preference:** Mobile-side first — start with `SellCarScreen.tsx` + `AuthService` listing-create call; verify request shape/payload before blaming the backend.

# Hypotheses

1. ~~Mobile-side gate (`GatedScreenWrapper`) blocks the submit~~ — eliminated.
2. ~~Mobile-side axios interceptor injects bad header~~ — eliminated (SellCarScreen uses bare `axios`, not `apiClient`).
3. **Backend middleware ordering bug** on `POST /api/cars` — multer parses multipart body AFTER `requireNotSuspended` runs, so the body-fallback `req.body?.sellerId` is empty when the middleware needs it. With no Bearer header from mobile (SellCarScreen doesn't attach one), `callerUid` cannot be resolved and the middleware returns 404 `{ error: 'user_not_found' }`. Confirmed.

# Eliminated

- Mobile UI gate. `GatedScreenWrapper` (commit 19e6f40) is presentational only — wraps SafeAreaView body, doesn't intercept axios. Render path can't return early before user presses submit.
- 401 idToken refresh interceptor (commit be69e9f). It's installed on `apiClient` only. SellCarScreen imports bare `axios` (line 3), so interceptors never run on this POST.

# Evidence

- timestamp: 2026-04-29; source: src/screens/SellCarScreen.tsx:444; finding: `axios.post(${API_URL}/api/cars, data, { headers: { 'Content-Type': 'multipart/form-data' } })` — no Authorization header attached.
- timestamp: 2026-04-29; source: src/screens/SellCarScreen.tsx:3; finding: `import axios from 'axios'` — uses default global axios, not `apiClient` from services/http/client.ts. Interceptors registered on `apiClient` never see this request.
- timestamp: 2026-04-29; source: backend-services/carEx-services/server.js:666; finding: `app.post('/api/cars', attachAuthIfPresent, requireNotSuspended('create_listing'), upload.array('images', 25), handler)` — middleware order puts multer LAST, so `req.body` is empty when `requireNotSuspended` reads it.
- timestamp: 2026-04-29; source: backend-services/carEx-services/src/security/requireNotSuspended.js:56; finding: dual-accept fallback reads `req.body?.sellerId || req.body?.buyerUid || req.params?.uid`. When body is unparsed (multipart, before multer runs), this resolves to undefined → middleware returns 404 `user_not_found` at line 68.
- timestamp: 2026-04-29; source: backend-services/carEx-services git log; finding: commit `0012256 feat(03-03): gate five user-write routes` introduced the regression on `/api/cars` (and identical pattern on `/api/payments/create-payment-intent` + `/api/payments/confirm-booking`, but those are JSON bodies so `express.json()` parses them before the middleware — only multipart routes are broken).
- timestamp: 2026-04-29; source: live prod probe; finding: `curl -X POST -F "sellerId=nope" -F "makeId=nope" https://carex-services-production.up.railway.app/api/cars` → HTTP 404 `{"error":"user_not_found"}`. Reproduces the symptom with no real auth at the network boundary.
- timestamp: 2026-04-29; source: src/constants/config.ts:13; finding: `currentEnv = 'prod'` — Android device hits Railway prod, which is currently serving the moderation-gated handler.

# Current Focus

```
hypothesis: Backend middleware ordering on POST /api/cars puts multer AFTER requireNotSuspended, so multipart body fields (notably sellerId) are never visible to the dual-accept uid fallback. Mobile sends no Bearer (bare axios on SellCarScreen) → callerUid undefined → 404 user_not_found → "Failed to upload car listing." alert.
test: live curl reproduction against Railway prod confirms 404 user_not_found for multipart POST /api/cars without Bearer.
expecting: confirmed.
next_action: both fixes applied locally — awaiting user push + Railway redeploy + end-to-end Android verification.
reasoning_checkpoint: null
tdd_checkpoint: null
```

# Resolution

**Root cause:** Backend route `POST /api/cars` registers middleware in the order
`attachAuthIfPresent → requireNotSuspended('create_listing') → upload.array('images', 25)`. The `requireNotSuspended` middleware reads `req.body?.sellerId` as a fallback when no Bearer is present, but for multipart requests `req.body` is unpopulated until `multer` runs — and multer runs AFTER. The mobile `SellCarScreen` submits via bare `axios.post` without an Authorization header (it never adopted the new `apiClient` from `services/http/client.ts`), so `req.auth` is also empty. With both sources empty, the middleware returns 404 `user_not_found` for every legitimate seller, which the catch block surfaces as the generic "Failed to upload car listing." alert. Introduced by backend commit `0012256` (Phase 3 03-03 route gating); did not exist before the moderation milestone.

**Fix (applied — defense in depth, both sides):** Reorder middleware on `POST /api/cars` so multer runs FIRST (lets the body-uid fallback see `sellerId`). Wire Bearer on mobile via `apiClient` (so the strict `req.auth` path works too). Either fix alone unblocks listing creation; together they're belt-and-suspenders against future regressions.

**Fix applied (2026-04-29):**

- ✅ **Mobile side (Option B) — landed in this repo at commit `240c3f3` on `main`.**
  - File: `src/screens/SellCarScreen.tsx`
  - Replaced bare `axios` import with `apiClient` from `services/http/client.ts`; dropped now-unused `API_URL` import.
  - Switched 3 call sites to `apiClient` with relative paths: GET `/api/cars/:carId` (line 92), PUT `/api/cars/:carId` (line 436), POST `/api/cars` (line 443).
  - Multipart `Content-Type` header preserved (parity with `AuthService.uploadAvatar` precedent).
  - Lint: file shows 17 pre-existing problems unrelated to this change; no new errors introduced at the edited lines.
  - Effect: real authenticated users now send a Bearer token, so the strict-auth path in `attachAuthIfPresent` resolves `req.auth` correctly.
  - Commit NOT pushed — user will review and push.

- ✅ **Backend side (Option A) — landed at commit `91524a1` on `main` of `backend-services/carEx-services`.**
  - File: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js` (line 666).
  - Single-line reorder: `app.post('/api/cars', upload.array('images', 25), attachAuthIfPresent, requireNotSuspended('create_listing'), async (req, res) => {`.
  - `PUT /api/cars/:id` (line 761) was checked but NOT modified — it has no auth gating yet (just `upload.array` + handler), so there is no ordering bug to fix and adding gating is out of scope.
  - Sweep of all `requireNotSuspended` users (lines 516, 571, 666, 1026, 1057) and all `upload.*` users (lines 666, 761) confirmed `POST /api/cars` is the only route combining both — the fix is complete with one line.
  - Local backend was on clean `main` at `7a9c9a4` matching `origin/main` before the commit (the prior 55-commits-behind blocker is resolved).
  - Commit NOT pushed — user will review and push.

**Verification status:**

- Live curl probe still returns `404 user_not_found` (expected — Railway is unchanged because both commits are local-only).
- After user pushes the backend commit and Railway redeploys, the same `curl -X POST -F "sellerId=nope" -F "makeId=nope" https://carex-services-production.up.railway.app/api/cars` should return a different 4xx (likely 403 user_suspended check or a 404/400 from the handler — anything *other than* the pre-multer `user_not_found`), confirming multer is now parsing the body before the auth middleware reads it.
- End-to-end verification: real signed-in seller account on Android submits a complete "List Car" form → expect success (listing created, user lands on confirmation, no "Failed to upload car listing." alert).
- iOS native project diff (`ios/carEx.xcodeproj/project.pbxproj`) is a pre-existing release-bump leftover and was deliberately left out of both commits.

**Files changed:**

- `carEx` (this repo) commit `240c3f3`:
  - `src/screens/SellCarScreen.tsx` (4 insertions, 5 deletions)
- `backend-services/carEx-services` commit `91524a1`:
  - `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js` (1 insertion, 1 deletion)

**Next steps for user:**

1. Review carEx commit `240c3f3` and push (`git push origin main` in `/Users/beckmaldinVL/development/mobileApps/carEx`).
2. Review backend commit `91524a1` and push (`git push origin main` in `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`); wait for Railway redeploy.
3. Re-run prod curl probe — expect a different failure mode (no longer `user_not_found`), confirming the reorder shipped.
4. Real Android signed-in seller submits a "List Car" form end-to-end → expect success. If it succeeds, mark this session `resolved` and move the file to `.planning/debug/resolved/list-car-failed-upload.md`.
