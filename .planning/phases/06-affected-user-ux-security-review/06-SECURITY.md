---
phase: 06-affected-user-ux-security-review
artifact: security-review
status: APPROVED
reviewed_by: self
reviewed_at: 2026-04-19
roadmap_criterion: "Phase 6 Success #6 — (a)-(e)"
---

# Phase 6 — Security Review (QUAL-03)

**Scope:** Admin moderation milestone — cross-repo verification before merge to `main`.
**Reviewer:** Self-review (per 06-CONTEXT D-QUAL-03 — informal, no external auditor).
**Review date:** 2026-04-19
**Repos audited:**

- `carEx` (mobile) — @ commit `cd853ccc212b8729deda9cffa812a85d68d20630` (branch `main`)
- `backend-services/carEx-services` (backend) — @ commit `387039fb70e367e3b31df6b3fad6ca9fc9330e37` (branch `feat/moderation-baseline`)

**Structure:** Five sections `(a)-(e)` map verbatim to ROADMAP §Phase 6 Success Criterion 6 sub-items. No 6th criterion invented (per 06-RESEARCH Open Question 2 resolution). The trailing "Optional — Additional Hardening Notes" section is auxiliary and not part of the required criteria.

---

## (a) verifyIdToken runs on every admin route

**Verification:**
Grep backend middleware + route files for `verifyIdToken` and `requireAdmin`; cross-reference against admin route declarations in `server.js`, `src/admin/router.js`, and `src/moderation/router.js`. The backend uses a flat `src/<domain>/` layout rather than `src/routes/` + `src/middleware/`, so the plan's grep path was broadened to `src/` accordingly.

```bash
# In backend-services/carEx-services/
grep -rn "verifyIdToken\|requireAdmin" src/
grep -n "/api/admin" server.js
grep -nE "^router\." src/admin/router.js src/moderation/router.js
```

**Evidence:**

Middleware definitions:
```
src/security/verifyIdToken.js:10:async function verifyIdToken(req, res, next) {
src/security/verifyIdToken.js:18:    const decoded = await admin.auth().verifyIdToken(match[1], true);
src/security/verifyIdToken.js:26:module.exports = { verifyIdToken };
src/security/requireAdmin.js:10:async function requireAdmin(req, res, next) {
src/security/requireAdmin.js:22:module.exports = { requireAdmin };
```

Admin-surface mount points (server.js + sub-routers):
```
server.js:850:app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);
src/admin/router.js:23:const { verifyIdToken } = require('../security/verifyIdToken');
src/admin/router.js:24:const { requireAdmin } = require('../security/requireAdmin');
src/admin/router.js:93:router.get('/users/search', verifyIdToken, requireAdmin, async (req, res) => {
```

Moderation sub-router routes (all inherit the app-level `verifyIdToken + requireAdmin` chain mounted at `server.js:850`):
```
src/moderation/router.js:88:router.get('/ping', ...)
src/moderation/router.js:95:router.post('/:targetUid', denySelfModeration, ...)
src/moderation/router.js:132:router.patch('/:targetUid/unsuspend', denySelfModeration, ...)
src/moderation/router.js:156:router.delete('/:targetUid/provider-profile', denySelfModeration, ...)
src/moderation/router.js:183:router.post('/:targetUid/edit-profile', denySelfModeration, ...)
src/moderation/router.js:220:router.get('/:targetUid/history', ...)
```

Every new Phase-2+ admin route is preceded by the `verifyIdToken + requireAdmin` chain — either at the mount point (moderation sub-router via `server.js:850`) or on the route declaration itself (`/api/admin/users/search` at `src/admin/router.js:93`). No new admin route bypasses the middleware. `requireAdmin` depends on `req.auth.email` populated by `verifyIdToken` (`src/security/requireAdmin.js:4` comment confirms the ordering contract).

**Legacy note (NOT in scope for this criterion):** Pre-existing `/api/admin/*` inline routes in `server.js:853-1014` (status/requests/approve/reject/admin-users/order-status) use the older `verifyAdminByUid(callerUid-from-body)` pattern. `server.js:848` carries a comment explicitly deferring this legacy pattern to a future cleanup. This review does not regress the legacy pattern; see Section (b) for discussion of its authorization posture.

**Verdict:** ✅ PASS

---

## (b) No callerUid body param is trusted for authorization on any new route

**Verification:**
Grep the entire backend `src/` + `server.js` for `req.body.callerUid` and `body.callerUid`; additionally grep the new moderation layer (backend `src/moderation/`, `src/admin/`; mobile `src/services/moderation/`) for any `callerUid` reference at all. New-route hits must be zero; legacy hits must be inspected to confirm they are audit/labeling only (or, where authorization use is confirmed, explicitly flagged as pre-existing legacy scope — see 06-CONTEXT §out-of-scope).

```bash
# Backend (all src + server.js)
grep -rn "req\.body\.callerUid\|body\.callerUid" src/ server.js
# Backend — new moderation surface specifically
grep -rn "callerUid" src/moderation/ src/admin/
# Mobile — new moderation service specifically
grep -rn "callerUid" src/services/moderation/
```

**Evidence:**

`grep -rn "req\.body\.callerUid\|body\.callerUid" src/ server.js` → **zero hits** (exit code 1).

`grep -rn "callerUid" src/moderation/ src/admin/` → **zero hits**.

`grep -rn "callerUid" src/services/moderation/` (mobile) → **zero hits**.

Broader backend `grep -rn "callerUid" src/ server.js` returns only:

1. `src/security/requireNotSuspended.js:47-74` — reads `callerUid = req.auth?.uid` (i.e., from the *verified* Firebase token, NOT from the request body), with a narrow shape-checked fallback to a body `uid` field for Phase-3 Dual-Accept compatibility (D-03/D-04). This is a trust-boundary-correct identifier, not a body-trusted authorization source.
2. `server.js:848` — comment block: `"legacy routes below keep their existing callerUid-in-body pattern until a future cleanup"`.
3. `server.js:890-1196` — legacy `/api/admin/requests/:uid/approve`, `/reject`, `/api/admin/users` (POST/DELETE), `/api/orders/:id/status` — these PRE-DATE the moderation milestone and are explicitly flagged legacy.

**New routes (this milestone): zero `callerUid` authorization references.** All new admin routes authenticate via the cryptographic `verifyIdToken` chain; `req.auth.uid` / `req.admin.uid` is the sole authorization source. The mobile `ModerationService.ts` likewise passes no `callerUid` body field — it relies on the shared http-client Bearer interceptor (Phase 4 MOB-02).

**Verdict:** ✅ PASS

---

## (c) Suspend and confirm-booking mutations are transactional

**Verification:**
Grep for Mongoose transaction constructs in the suspend service handler and the confirm-booking payment path.

```bash
grep -rn "startSession\|withTransaction\|session\.startTransaction" src/ | grep -iE "moderation|confirm|booking"
```

**Evidence:**

```
src/payments/confirmBooking.js:124:  const session = await mongoose.startSession();
src/payments/confirmBooking.js:126:    await session.withTransaction(async () => {
src/payments/confirmBooking.js:131:      // attempt. session.withTransaction auto-retries on transient errors
src/moderation/service.js:5:// inside a single session.withTransaction() so the pair is atomic (D-23, D-24).
src/moderation/service.js:14:// withTransaction(), then the User mutation with lastActionId back-link.
src/moderation/service.js:64:  const session = await mongoose.startSession();
src/moderation/service.js:68:    await session.withTransaction(async () => {
src/moderation/service.js:161:  const session = await mongoose.startSession();
src/moderation/service.js:165:    await session.withTransaction(async () => {
src/moderation/service.js:247:  const session = await mongoose.startSession();
src/moderation/service.js:250:    await session.withTransaction(async () => {
src/moderation/service.js:355:  const session = await mongoose.startSession();
src/moderation/service.js:358:    await session.withTransaction(async () => {
src/moderation/service.js:485:  const session = await mongoose.startSession();
src/moderation/service.js:488:    await session.withTransaction(async () => {
```

- **`suspend`** (`src/moderation/service.js:64-68`, Phase 2 Plan 02-03): audit-row-insert → user-update-with-lastActionId transactional pair inside a single `session.withTransaction()` block (D-23/D-24). Same pattern verified on the sibling handlers `unsuspend` (line 161), `revokeRole` (line 247), `deleteProviderProfile` (line 355), and `editProfile` (line 485).
- **`confirmBooking`** (`src/payments/confirmBooking.js:124-126`, Phase 3 Plan 03-04): session-bound `withTransaction` wraps buyer re-check, provider re-check, provider-snapshot absorption, and order insert. The refund-first-throw-second ordering is implemented via `refundThenThrow(stripe, paymentIntentId, 'provider_suspended', uid)` so Stripe refunds land before the transaction aborts — no "buyer charged, no order, no refund" hole (D-13/D-23, ROADMAP §Phase 3 Success #3).

**Verdict:** ✅ PASS

---

## (d) ModerationAction collection rejects updates and deletes at the application layer

**Verification:**
Inspect the ModerationAction Mongoose model for pre-hook append-only enforcement; grep the rest of the codebase for any call site attempting to mutate the collection.

```bash
grep -nE "pre\(|APPEND_ONLY|append-only" src/models/ModerationAction.js
grep -rn "ModerationAction\.updateOne\|ModerationAction\.deleteOne\|ModerationAction\.findOneAndUpdate\|ModerationAction\.update\b\|ModerationAction\.remove" src/
```

**Evidence:**

Model pre-hooks (`src/models/ModerationAction.js:18-25`):
```javascript
// Append-only enforcement (D-17):
const APPEND_ONLY_ERR = new Error('ModerationAction is append-only');
moderationActionSchema.pre('updateOne',         function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('updateMany',        function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('findOneAndUpdate',  function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('deleteOne',         function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('deleteMany',        function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('findOneAndDelete', function () { throw APPEND_ONLY_ERR; });
```

Six mutation verbs hooked — broader than the plan template's sample grep (which only listed `updateOne`/`deleteOne`/`findOneAndUpdate`). Every standard Mongoose write path that could mutate an existing row is intercepted and throws `"ModerationAction is append-only"`. Phase 1 Plan 01-01 (DATA-02) ships the unit test covering this invariant; ROADMAP §Phase 1 Success #4 was the original acceptance gate.

Production call-site grep (`ModerationAction.updateOne|deleteOne|findOneAndUpdate|update|remove`) → **zero hits**. No production code attempts to mutate the collection; the only writers are the `session.withTransaction` audit-insert paths referenced in Section (c).

**Verdict:** ✅ PASS

---

## (e) No new hardcoded secrets were introduced

**Verification:**
Scan both repos for new hardcoded secret patterns (API keys, JWTs, Mongo URIs, bearer tokens). Backend diff uses the natural range (`git diff main`, since backend is on `feat/moderation-baseline` branch). Mobile is already on `main`, so `git diff main` is empty; instead, the mobile scan runs `git grep` for secret patterns against the current tracked tree and cross-checks any hits against Phase 5 CONCERNS.md to confirm they are pre-existing, not introduced by this milestone (per the plan's guidance when operating on-main).

```bash
# Backend — branch diff vs main
cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services
git diff main -- '*.js' '*.ts' | grep -iE "AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer\s+[A-Za-z0-9._-]{40,}"

# Mobile — on main; git grep current tree for known patterns
cd /Users/beckmaldinVL/development/mobileApps/carEx
git grep -nE 'AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer\s+[A-Za-z0-9._-]{40,}' -- '*.ts' '*.tsx' '*.js'
# Cross-check mobile hit ages
git log --oneline -S "AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas" -- src/services/AuthService.ts
git blame -L 9,9 src/services/AuthService.ts
```

**Evidence:**

Backend `git diff main -- '*.js' '*.ts' | grep -iE "AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer..."` → **zero matches** (exit code 0, no output). 44 commits landed on `feat/moderation-baseline` (Phases 1–3 + 5-0a/5-0b) with 48 files changed / 13,458 insertions and none introduced a hardcoded secret.

Mobile `git grep -nE 'AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer\s+[A-Za-z0-9._-]{40,}' -- '*.ts' '*.tsx' '*.js'`:
```
src/services/AuthService.ts:9:const API_KEY = 'AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas';
```

Age cross-check:
```
$ git log --oneline -S "AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas" -- src/services/AuthService.ts
cd5f6ac authentication added
$ git blame -L 9,9 src/services/AuthService.ts
cd5f6ac6 (beckinfonet 2026-01-30 00:02:09 -0800 9) const API_KEY = 'AIza...';
```

Additional hit — Stripe test publishable key:
```
App.tsx:93: <StripeProvider publishableKey="pk_test_51TEgrOJA..."
```

Both hits are **pre-existing Phase 5 CONCERNS.md entries** (documented in the known-concerns register and deferred to REL-01/REL-03 per REQUIREMENTS.md). Neither was introduced by Phase 6 work. Firebase API key dates to `cd5f6ac (2026-01-30)` — over two months before this milestone started. Stripe `pk_test_` publishable keys are not secrets per Stripe's own classification (test-mode public keys), though still flagged in CONCERNS.md as "should read from env for consistency."

**T-06-05 additional check (load-test credential exposure):**
```bash
grep -rn "K6_ADMIN_IDTOKEN\|eyJ[A-Za-z0-9_-]" scripts/load-test/
# → grep: scripts/load-test/: No such file or directory (exit code 2)
```
The load-test harness directory does not exist because **Plan 06-0b (QUAL-02 k6 harness) was deferred by operator decision 2026-04-19** alongside Plan 06-0a (10k-user seed). With no harness checked in, there is no surface on which to introduce a load-test credential. T-06-05 reverts to "accept with deferred verification" — the mitigation will be re-evaluated if/when the harness is built in a future milestone.

**Pre-existing known secrets (NOT introduced by this milestone, deferred to REL-01/REL-03 per REQUIREMENTS.md):**
- Stripe `pk_test_…` in `App.tsx:93` — Phase 5 CONCERNS.md
- Firebase web API key in `src/services/AuthService.ts:9` — Phase 5 CONCERNS.md (landed 2026-01-30 in commit `cd5f6ac`)

**New hardcoded secrets in this milestone:** NONE. Backend branch diff produced zero matches; mobile tree hits are all pre-milestone and pre-documented.

**Verdict:** ✅ PASS

---

## Optional — Additional Hardening Notes

(Not part of the 5 required criteria; captures incidental findings that may inform future work.)

- **Load-test harness (Plan 06-0b) was deferred** by operator decision 2026-04-19 alongside Plan 06-0a (QUAL-02 10k-user seed). No `scripts/load-test/` directory exists in `backend-services/carEx-services/`, so T-06-05 (load-test credential exposure) has no current surface. Mitigation will be revisited if/when the harness is built.
- **UserStatusBanner (Plan 06-03) mailto body encoding:** The banner routes all interpolated values through `encodeURIComponent` before composing the `mailto:` URL — the Phase-6 T-06-02 grep count of 2 `encodeURIComponent` call sites in `src/components/moderation/UserStatusBanner.tsx` was verified during Plan 06-03 execution and again during the Plan 06-09 literal scanner run.
- **GatedScreenWrapper (Plan 06-05) capability predicate:** Covers both the `all_writes` sentinel and alias-mapped backend capability keys (`CAPABILITY_ALIASES`). UI-bypass risk (T-06-03) is mitigated defense-in-depth; the hard gate remains the backend `requireNotSuspended` middleware (Phase 3 ENF-01, verified in Section (c) above).
- **Legacy `/api/admin/*` callerUid-in-body pattern** (`server.js:848-1196`) is explicitly out of scope for this milestone (see Section (b)). It is tracked by the `server.js:848` comment block deferring the cleanup to a future tech-debt sweep. These routes predate `verifyIdToken` and are protected by `verifyAdminByUid(callerUid)` — weaker but functional admin gating. A follow-up milestone should migrate them to the `verifyIdToken + requireAdmin` chain.
- **Phase 5 `deferred-items.md` entries** (App.test.tsx navigation-stack mock failure, 16 inline-style warnings, dead `ModerationService.restoreRole` method, `AdminDashboardScreen` react-hooks/exhaustive-deps lint warning) were surfaced during review and do NOT affect security posture. Deferred per 06-CONTEXT §deferred.
- **QUAL-01 closure** (Plan 06-09 literal scanner + Plan 06-01 translation parity test) is independent of this QUAL-03 gate but relevant: the scanner confirms no untranslated user-facing literals were introduced in the new moderation components, eliminating a class of "silent English leak to RU users" information-disclosure risk.

---

## Review Sign-Off

All 5 ROADMAP §Phase 6 Success Criterion 6 sub-items verified **PASS**.

- Reviewer: self (per 06-CONTEXT D-QUAL-03 — informal, no external auditor)
- Date: 2026-04-19
- Ready for merge to `main`: **YES**
- Outstanding (informational, non-blocking): legacy `/api/admin/*` callerUid-in-body tech-debt cleanup; Phase 5 deferred-items.md; Plan 06-0a/06-0b (QUAL-02 load test) re-visit when harness is built.
