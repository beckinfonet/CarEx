---
phase: 03-backend-enforcement-backend
plan: 03
subsystem: backend-router
tags: [server-js, middleware-composition, hybrid-cutover, enf-01, enf-02, enf-04]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-backend
    plan: 01
    provides: Car, Broker, LogisticsPartner models at src/models/*.js with pre(/^find/) hide-hooks
  - phase: 03-backend-enforcement-backend
    plan: 02
    provides: attachAuthIfPresent + requireNotSuspended(capability) middleware factories
provides:
  - server.js with three model requires replacing inline schemas
  - Five gated user-write routes (POST /api/cars, POST /api/payments/create-payment-intent, POST /api/payments/confirm-booking, PUT /api/brokers/:uid, PUT /api/logistics/:uid)
  - attachAuthIfPresent + requireNotSuspended composition at per-route position (inline, not router-mount)
  - Active enforcement perimeter delivering ROADMAP Criterion #1 (403 on user-write for suspended) and Criterion #2 (hide-on-read via the now-live Plan 03-01 pre-hooks)
affects: [03-04 (confirmBooking handler rewrite — replaces body of the already-gated POST /api/payments/confirm-booking), 03-05 (POST /api/orders 410-Gone rewrite), 03-06 (acceptance.test.js Block 1 hits all five gated routes; Block 2 exercises the now-live hide-hooks)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-route inline middleware composition: app.<verb>(path, attachAuthIfPresent, requireNotSuspended(capability), [existing multer/etc], handler) — D-04 mount order"
    - "Hybrid cutover discipline (D-02): exactly five ROADMAP-named routes gated; eight other user-write routes intentionally left ungated and tracked in CONTEXT.md §Deferred Ideas"
    - "Capability token vocabulary bound at mount site (ENF-04): 'create_listing' | 'create_order' | 'update_profile' — each string literal appears exactly where the plan prescribes"
    - "Schema-extraction continuation: top-of-file require block grew by five lines (3 model + 2 security) — matches existing Phase 1 require block grammar"

key-files:
  created: []
  modified:
    - ../backend-services/carEx-services/server.js

key-decisions:
  - "Model + middleware requires placed in the existing Phase 1 require block (lines 12-22), with models grouped after User/AdminUser and security modules alongside verifyIdToken/requireAdmin. Preserves existing grouping grammar."
  - "serviceItemSchema declaration deleted entirely. Grep confirmed its only references in server.js were inside brokerSchema and logisticsPartnerSchema (both deleted). Each extracted model file owns its own clone per Plan 03-01 decision."
  - "No handler bodies touched on any of the five routes. Diff is exactly five single-line changes for Task 2 — middleware args prepended, existing arguments (upload.array on POST /api/cars; async handler on the other four) kept in order."
  - "Eight neighboring user-write routes (PUT /api/cars/:id, PATCH /api/cars/:id/status, POST /api/users/:uid/request-*, PUT /api/users/:uid, POST /api/users/:uid/avatar, DELETE /api/users/:uid, PATCH /api/orders/:id/*) intentionally NOT gated — hybrid cutover discipline (D-02, 01 D-05/D-06). Tracked as follow-up tickets."

patterns-established:
  - "Middleware ordering invariant on gated routes: attachAuthIfPresent precedes requireNotSuspended (otherwise req.auth is not set before uid resolution). Enforced by grep-A verification showing upload.array follows requireNotSuspended on POST /api/cars."
  - "Exact-count grep as scope-discipline gate: `grep -c \"requireNotSuspended(\" server.js` returning anything other than 5 is a review-blocking regression. Same for 'attachAuthIfPresent,'. Phase 3 CI-worthy."

requirements-completed: [ENF-01, ENF-02, ENF-04]

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 3 Plan 3: server.js Enforcement Wiring Summary

**server.js now `require('./src/models/{Car,Broker,LogisticsPartner}')` at top-of-file instead of declaring inline schemas (delivering ROADMAP Criterion #2 by making every server.js Car/Broker/Logistics query hit the Plan 03-01 pre(/^find/) hide-hook), and the five ROADMAP-named user-write routes have `attachAuthIfPresent` + `requireNotSuspended(<capability>)` prepended in the middleware chain (delivering ROADMAP Criterion #1 and ENF-04 capability selectivity).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T20:14:39Z
- **Completed:** 2026-04-17T20:17:14Z
- **Tasks:** 2 (of 2)
- **Files created:** 0
- **Files modified:** 1 (`../backend-services/carEx-services/server.js`)

## Accomplishments

- Added five new top-of-file requires (3 models + 2 security middlewares) in the existing Phase 1 require block (lines 12-22).
- Deleted the three inline schema declarations:
  - `carSchema` + `const Car = mongoose.model('Car', carSchema)` (was server.js:95-133, 39 lines)
  - `serviceItemSchema` + `brokerSchema` + `brokerSchema.index(...)` + `const Broker = mongoose.model('Broker', brokerSchema, 'brokers')` (was server.js:137-160, 24 lines)
  - `logisticsPartnerSchema` + `logisticsPartnerSchema.index(...)` + `const LogisticsPartner = mongoose.model('LogisticsPartner', logisticsPartnerSchema, 'logistics_partners')` (was server.js:163-179, 17 lines)
  - Replaced the entire deleted block with a 5-line comment summarizing where each model lives now.
- Prepended `attachAuthIfPresent, requireNotSuspended('<capability>'), ` on exactly five routes per D-02:
  - `POST /api/cars` → `create_listing` (middleware inserted before the existing `upload.array('images', 25)` so multer runs after the gate)
  - `POST /api/payments/create-payment-intent` → `create_order`
  - `POST /api/payments/confirm-booking` → `create_order` (handler body untouched — Plan 03-04 replaces it)
  - `PUT /api/brokers/:uid` → `update_profile`
  - `PUT /api/logistics/:uid` → `update_profile`
- Confirmed exact grep counts match scope discipline — any deviation from 5 total `requireNotSuspended(` or `attachAuthIfPresent,` matches would indicate either a missed route or an out-of-scope addition. Both are exactly 5.
- Smoke-tested model loading: `node -e "require('./src/models/{User,AdminUser,Car,Broker,LogisticsPartner}')"` loads cleanly; pre-existing duplicate-index warnings on email + ownerUid persist unchanged (carried from Plan 03-01 deferred-items.md, tracked for future cleanup — not a regression).

## Task Commits

All task commits landed in the BACKEND repo (`../backend-services/carEx-services`):

1. **Task 1: Replace inline Car/Broker/LogisticsPartner schemas with requires** — backend `2a6fd0f` (refactor)
2. **Task 2: Prepend attachAuthIfPresent + requireNotSuspended on the five gated routes** — backend `0012256` (feat)

**Plan metadata commit:** captured in the mobile repo with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified

Backend repo (`../backend-services/carEx-services/`):
- `server.js` — modified: -86/+10 in Task 1 (schema deletion + require additions); -5/+5 in Task 2 (five single-line middleware prepends). Net: file shrank ~76 lines with no semantic loss.

Mobile repo (`.planning/`):
- `.planning/phases/03-backend-enforcement-backend/03-03-SUMMARY.md` — this file.

## Decisions Made

- **Where to place the new requires:** grouped models (Car/Broker/LogisticsPartner) after User/AdminUser in the Phase 1 require block; placed security modules (attachAuthIfPresent/requireNotSuspended) immediately after verifyIdToken/requireAdmin to preserve the existing security-group grammar. This keeps ordering consistent with Phase 1 D-02 extraction pattern.
- **serviceItemSchema deletion:** per plan decision tree (step 5 of Task 1 action): grep showed only two references (inside brokerSchema and logisticsPartnerSchema, both deleted). No other schema in server.js imports serviceItemSchema. Therefore the top-level declaration was deleted entirely. Each extracted model file (Broker.js, LogisticsPartner.js) owns its own independent clone per Plan 03-01 D-08.
- **Middleware placement relative to multer on POST /api/cars:** `attachAuthIfPresent, requireNotSuspended('create_listing')` inserted BEFORE `upload.array('images', 25)`. Rationale: short-circuit the 403 before multer starts streaming files to S3 — avoids charging S3 put-object costs on suspended-caller requests. This also matches the D-04 mount order exactly (attachAuthIfPresent → requireNotSuspended → existing middleware → handler).
- **POST /api/payments/confirm-booking handler UNCHANGED in this plan:** the middleware gate is active, but the existing ~30-line handler body (Stripe PI retrieve → Car.findById → save) remains. Plan 03-04 replaces the body with the transactional service from `src/payments/confirmBooking.js`. Sequencing both plans in the same file means 03-04 depends on 03-03 (already captured in its frontmatter).
- **Scope discipline enforcement via grep counts:** the Task 2 acceptance criteria specify exact counts (5 attachAuthIfPresent, 5 requireNotSuspended total, 1 create_listing, 2 create_order, 2 update_profile). These are now the CI-relevant smoke test for Phase 3 — any future diff that changes any count is a review flag.

## Deviations from Plan

None — plan executed exactly as written.

One cosmetic note that does NOT change behavior or acceptance:
- The deleted block (lines 95-179 original) was replaced with a five-line comment pointing to each extracted model file, rather than leaving a silent gap. This is purely documentary and does not affect any grep count or semantic behavior.

## Issues Encountered

None. Both tasks ran clean on the first attempt. `node --check server.js` passed after each edit; grep counts matched expectations; no file deletions detected post-commit.

## Known Stubs

None. All five gated routes now actively reject suspended callers at middleware level. The POST /api/payments/confirm-booking handler body is PLANNED for rewrite in Plan 03-04, but this is explicit sequencing (not a stub) — the middleware gate here is production-ready and independently enforces ROADMAP Criterion #1 for that route.

The Plan 03-01 pre(/^find/) hide-hooks on Car/Broker/LogisticsPartner were previously dormant because server.js still held the inline schemas (Mongoose registers the first model-for-a-name; extracted files would only be picked up if server.js imported them). After this plan's Task 1, the extracted models ARE what every server.js query resolves to, so the hide-hooks are now LIVE on every existing `Car.find(...)`, `Broker.findOne(...)`, `LogisticsPartner.find(...)` call without any further changes. This silently satisfies ROADMAP Criterion #2 for GET routes (admin bypass via `setOptions({includeAllUsers: true})` is available but not yet wired into every admin handler — that's a Phase 5 concern).

## User Setup Required

None — no external service configuration or secrets provisioning needed.

## Next Phase Readiness

**Ready for Plan 03-04** (confirmBooking transactional rewrite). 03-04 will:
1. Create `src/payments/confirmBooking.js` with the `session.withTransaction()` envelope (buyer re-check → provider re-check + providerSnapshot resolution → car.listingStatus flip → ServiceOrder.create rows).
2. Replace the body of `app.post('/api/payments/confirm-booking', attachAuthIfPresent, requireNotSuspended('create_order'), async (req, res) => {...})` — the route arg-list (the part this plan wrote) stays; only the handler body changes.
3. Add the refund-then-throw helper and the 409 provider_suspended / 409 refundFailed response shapes (D-10, D-11, D-15).

**Ready for Plan 03-05** (POST /api/orders → 410 Gone) — independent of this plan, operates on a different route.

**Ready for Plan 03-06** (enforcement tests). 03-06 acceptance.test.js:
- Block 1 (Criterion #1): hits all five gated routes with a blocked_with_review user — each must return 403 account_suspended. This plan's middleware is the code path under test.
- Block 2 (Criterion #2): seeds a car + suspends the seller → `Car.find({})` returns empty. This plan delivers "the models that server.js uses ARE the hooked models" — without Task 1's require swap, the hooks were dormant even though the files existed.
- Block 4 (Criterion #4): `POST /api/cars` with a feature_limited user whose `restrictedFeatures` includes `create_listing` → 403; same user's `POST /api/payments/create-payment-intent` → 200 (since `create_order` is NOT in their restrictedFeatures). This plan's `('create_listing')` vs `('create_order')` capability tokens on the routes is what makes the selectivity test meaningful.

**Blockers / concerns for Phase 3 downstream:** None new. The pre-existing duplicate-index warnings on Broker + LogisticsPartner ownerUid surfaced again on model-load smoke test (same source as Plan 03-01). The inline schema deletion in this plan does NOT fix them — the duplicate-index declarations are in the extracted model files per Plan 03-01's verbatim-lift requirement. Cleanup remains tracked in `deferred-items.md`.

## Threat Flags

None. No new security-relevant surface beyond the plan's documented `<threat_model>` (T-03-03-01 through T-03-03-05). Scope discipline (exactly 5 gated routes, 8 explicitly deferred) is enforced by grep-count acceptance criteria and is auditable from CI.

## Self-Check: PASSED

- File `../backend-services/carEx-services/server.js` — FOUND (modified by both tasks)
- Backend commit `2a6fd0f` (Task 1, refactor) — FOUND in backend repo log
- Backend commit `0012256` (Task 2, feat) — FOUND in backend repo log
- `require('./src/models/Car')` — present at server.js:14
- `require('./src/models/Broker')` — present at server.js:15
- `require('./src/models/LogisticsPartner')` — present at server.js:16
- `attachAuthIfPresent` require — present at server.js:19
- `requireNotSuspended` require — present at server.js:20
- `grep -c "carSchema = new mongoose.Schema" server.js` = 0
- `grep -c "brokerSchema = new mongoose.Schema" server.js` = 0
- `grep -c "logisticsPartnerSchema = new mongoose.Schema" server.js` = 0
- `grep -c "requireNotSuspended('create_listing')" server.js` = 1
- `grep -c "requireNotSuspended('create_order')" server.js` = 2
- `grep -c "requireNotSuspended('update_profile')" server.js` = 2
- `grep -c "attachAuthIfPresent," server.js` = 5
- `grep -c "requireNotSuspended(" server.js` = 5
- `node --check server.js` = exit 0

---
*Phase: 03-backend-enforcement-backend*
*Completed: 2026-04-17*
