---
phase: 03-backend-enforcement-backend
plan: 05
subsystem: backend-routes-deprecation
tags: [deprecated-endpoint, 410-gone, d-12, toctou-close, enf-03, route-body-replacement]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-backend
    plan: 04
    provides: POST /api/payments/confirm-booking absorbs order creation into a single Mongoose transaction with buyer+provider+seller re-check; makes standalone POST /api/orders safe to neutralize
  - phase: 03-backend-enforcement-backend
    plan: 03
    provides: Middleware map locked; POST /api/orders intentionally NOT in the gated-route list (D-02) so this plan's 410-without-middleware contract is consistent with that decision
provides:
  - "POST /api/orders → unconditional 410 Gone with { error: 'deprecated', message: 'Use POST /api/payments/confirm-booking which now creates orders atomically' }"
  - "Old order-creation handler body (providerGroups build + ServiceOrder.create loop + orderNumber uniqueness check + carSnapshot construction — 96 lines at server.js:1081-1176) deleted in place"
  - "Route entry registered but middleware-free — the 410 is the gate, not auth/moderation"
  - "Loud failure contract for stale mobile builds: any client still calling the deprecated two-step flow (create-payment-intent → confirm-booking → POST /api/orders) fails visibly with 410 instead of silently creating orders that skip provider re-check"
affects: [03-06 (ordersDeprecated.test.js asserts the exact 410 + error shape shipped by this plan)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deprecated-route-stub idiom — route remains registered, body is a 2-statement status(410).json() with a leading TODO comment block citing the removal trigger (mobile retirement + grace period, per 03-CONTEXT.md Deferred Ideas)"
    - "No-middleware deprecated response — attachAuthIfPresent/requireNotSuspended intentionally omitted so stale clients that might be suspended still receive the deterministic 410 (avoids 403-masking-410 ambiguity for old builds)"

key-files:
  created: []
  modified:
    - ../backend-services/carEx-services/server.js

key-decisions:
  - "Kept route entry registered — removal deferred per 03-CONTEXT.md Deferred Ideas until Phase 4 retires the mobile call site and a grace period passes. Stub-with-comment preserves a discoverable deprecation signal in the code rather than silently vanishing the route (which would 404 and be confused with a routing bug)"
  - "No attachAuthIfPresent / requireNotSuspended on POST /api/orders — per D-12 the 410 is the gate itself. Adding auth middleware would 403 suspended callers before they see the 410, muddying the deprecation signal and leaving legacy mobile code without clear guidance to migrate. Acceptance criterion explicitly locked attachAuthIfPresent route count at 5 (unchanged from Plan 03-04)"
  - "TOCTOU-escape-hatch closure framed in the commit body, not just the code comment — the core risk wasn't 'old endpoint still works' but 'old endpoint lets a client skip the confirm-booking re-check that Plan 03-04 installed'. Commit trailer makes this architectural intent searchable in git log, not just in PLAN.md"

patterns-established:
  - "Route-body-replacement-without-route-removal as the canonical shape for deprecated endpoints during the mobile-retirement window: comment block citing deprecation trigger + 410 Gone + no middleware + removal tracked in 03-CONTEXT.md Deferred"
  - "Load-bearing comment preserves removal intent — the TODO line 'route removal after mobile retires the call + grace period (see 03-CONTEXT.md Deferred)' is the only link between this code and the Deferred Ideas section, so the comment is architectural signal not decoration"

requirements-completed: [ENF-03]

# Metrics
duration: 2m10s
completed: 2026-04-17
---

# Phase 3 Plan 5: POST /api/orders → 410 Gone Summary

**Replace the 96-line `POST /api/orders` order-creation handler body in `server.js` with a 13-line stub that returns unconditional `410 Gone` (`{ error: 'deprecated', message: 'Use POST /api/payments/confirm-booking which now creates orders atomically' }`), closing the ROADMAP Criterion #3 TOCTOU escape hatch where a client could route around the confirm-booking re-check (installed by Plan 03-04) by calling the standalone `POST /api/orders` directly after a successful create-payment-intent. Route entry stays registered so stale mobile builds fail loudly rather than silently.**

## Performance

- **Duration:** ~2m10s
- **Started:** 2026-04-17T20:27:35Z
- **Completed:** 2026-04-17T20:29:45Z
- **Tasks:** 1 (of 1)
- **Files created:** 0
- **Files modified:** 1 (`../backend-services/carEx-services/server.js`)

## Accomplishments

- Located the pre-edit `POST /api/orders` route at `server.js:1081-1176` (96 lines: handler body spanning providerGroups build, ServiceOrder.create loop, orderNumber uniqueness check, carSnapshot construction, and catch block).
- Replaced the entire route declaration in place with a 13-line block: 6-line deprecation comment (citing D-12 rationale, TOCTOU reference, and the removal TODO pointing to 03-CONTEXT.md Deferred) + 6-line `app.post('/api/orders', (req, res) => { res.status(410).json({ ... }); });` stub.
- Preserved the `// --- Service Order Routes ---` section header and the surrounding GET routes (buyer orders, provider orders) untouched.
- Did NOT add `attachAuthIfPresent` or `requireNotSuspended` to the route — the 410 is the gate per D-12.
- Did NOT remove the `ServiceOrder` require/import at the top of `server.js` because `ServiceOrder` is still referenced 7 more times by GET /api/orders/buyer/:uid, GET /api/orders/provider/:uid, PATCH /api/orders/:id/status, and PATCH /api/orders/:id/services/:serviceIndex/status handlers.
- `node --check server.js` exits 0.
- Net diff: `-96` / `+11` lines (11 insertions + 96 deletions; net reduction of 85 lines, meeting the ≥85-line acceptance criterion exactly).

## Task Commits

All task commits landed in the BACKEND repo (`../backend-services/carEx-services`):

1. **Task 1: Replace POST /api/orders handler body with 410 Gone** — backend `1238c6d` (feat)

**Plan metadata commit:** captured in the mobile repo with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified

Backend repo (`../backend-services/carEx-services/`):
- `server.js` — modified: `-96 / +11` lines. The 96-line handler body at lines 1081-1176 (Plan 03-04 did not touch this block; line numbers shifted from the pre-Phase-3 original `1148-1244` range due to Plan 03-01 model extraction and Plan 03-04 confirmBooking handler rewrite) was replaced with a comment+stub block. Post-edit, the route now lives at lines 1086-1091 (6 lines of executable code + 6 lines of leading comment).

Mobile repo (`.planning/`):
- `.planning/phases/03-backend-enforcement-backend/03-05-SUMMARY.md` — this file.

## Decisions Made

- **Route entry preserved, body replaced:** Per D-12 and 03-CONTEXT.md Deferred Ideas, the route is not removed. Keeping `app.post('/api/orders', ...)` registered gives stale mobile builds a deterministic 410 response with migration guidance. Removing the route would instead produce a 404 that could be mistaken for an Express routing bug or a network issue, losing the loud-failure signal. A TODO comment (`// TODO: route removal after mobile retires the call + grace period (see 03-CONTEXT.md Deferred)`) is the only architectural link between this code and the deferred-cleanup tracking, so the comment is load-bearing.
- **No middleware on the deprecated route:** Adding `attachAuthIfPresent, requireNotSuspended('create_order')` would 403-mask-410 for suspended callers, muddying the deprecation signal (the client would get `account_suspended` and think they needed to appeal, when the real fix is for the mobile build to stop calling this endpoint). The plan's acceptance criterion explicitly locks `attachAuthIfPresent` total count at 6 (5 route usages + 1 require) unchanged from Plan 03-04 — this plan must NOT add it.
- **ServiceOrder import kept at top-of-file:** `grep -c "ServiceOrder" server.js` returns 8 post-edit (require line + GET buyer orders + GET provider orders + 2 PATCH endpoints + the now-dead handler is gone, but the module-level access remains for the other handlers). Removing the require would break the remaining `ServiceOrder.find(...)` / `.findOne(...)` / `.findById(...)` calls. Scope discipline per `<action>`'s "most likely ServiceOrder is still referenced elsewhere — KEEP those imports".
- **Commit message frames this as TOCTOU-escape-hatch closure, not just deprecation:** The commit body calls out the architectural intent — this isn't cleanup hygiene, it's the final close of the attack surface that Plan 03-04's transactional re-check would otherwise still allow a client to bypass. Makes the intent searchable in git log.

## Deviations from Plan

None — plan executed exactly as written.

One benign observation about the plan's line-range reference: the plan's `<read_first>` and `<interfaces>` sections cite `server.js:1148-1244` / `1156-1236` as the location of the POST /api/orders handler. That range was accurate at Phase 3 START; after Plan 03-01's model extraction (-inline Car/Broker/LogisticsPartner schemas) and Plan 03-04's confirm-booking handler rewrite, the actual current location is `1081-1176`. The plan anticipated this drift (`<action>` step 1: "verify exact current range before editing") and instructed locating the route by `grep -n "app.post('/api/orders'"` rather than by hard line number. Located at line 1081, edited in place, no scope or semantic deviation.

## Authentication Gates

None encountered. Pure code replacement — no external service auth, no credentials, no API keys involved. The backend repo was already clean (`git status` empty) before starting, per the sequential-execution preamble.

## Issues Encountered

None. Task ran clean on the first attempt:
- `node --check server.js` passed post-edit.
- Route count acceptance: `grep -c "app.post('/api/orders'" server.js` = 1.
- Inside-block 410 / 'deprecated' / exact message assertions all = 1 each.
- Inside-block ServiceOrder.create / providerSnapshot assertions all = 0 (old body gone).
- attachAuthIfPresent total count unchanged at 6 (5 route usages + 1 require) — acceptance satisfied.
- Net line delta: `11 insertions / 96 deletions` = net -85 (acceptance criterion: "at least ~85 line reduction").
- Zero file deletions in the commit (`git diff --diff-filter=D --name-only HEAD~1 HEAD` = empty).
- Zero untracked files after commit.

The pre-existing Mongoose duplicate-index warnings on `ownerUid` (documented in Plan 03-01's `deferred-items.md`) were not surfaced during this plan — the edit does not touch schema registration, only route body.

## Known Stubs

The new `POST /api/orders` handler body IS a stub by design — a 410-Gone deprecation response. This is the plan's explicit goal, not a missed wire-up. The stub is documented in 03-CONTEXT.md Deferred Ideas with the removal trigger ("after Phase 4 mobile stops calling it + grace period"), and carries a TODO comment in the code itself pointing to that deferred-cleanup section. Per the SUMMARY stub-tracking rules, intentional deprecation stubs with documented removal plans are not a blocking issue.

No other stubs introduced. No placeholder text, no hardcoded empty arrays flowing to UI (this is backend-only), no "coming soon" strings.

## User Setup Required

None — no external service configuration or secrets provisioning needed. The plan was backend-only, server.js edit only, no new env vars, no DB migration.

## Next Plan Readiness

**Ready for Plan 03-06** (enforcement tests). Specifically:
- `__tests__/enforcement/ordersDeprecated.test.js` (owned by Plan 03-06 per its frontmatter) can now assert:
  - `POST /api/orders` with any body returns HTTP 410.
  - Response JSON matches `{ error: 'deprecated', message: 'Use POST /api/payments/confirm-booking which now creates orders atomically' }` exactly.
  - Response body shape is stable regardless of auth header / buyerUid / items presence (the 410 is unconditional).
- `__tests__/enforcement/acceptance.test.js` Block 3 (concurrent admin.suspend vs confirm-booking) can trust that there is no alternate `POST /api/orders` code path a test client could call to bypass the transactional re-check.

**Blockers / concerns for Phase 3 downstream:** None new.

## Threat Flags

None new beyond the plan's documented `<threat_model>` (T-03-05-01 through T-03-05-03):
- T-03-05-01 (Tampering / TOCTOU via standalone order creation) — **mitigated**: the route body that could create `ServiceOrder` rows outside the confirm-booking transaction is deleted. `grep -A 15 "app.post('/api/orders'" server.js | grep -c "ServiceOrder.create"` returns 0.
- T-03-05-02 (DoS via old-build retry storm) — **accepted**: 410 is a hard terminal failure; retry loops burn against a deterministic JSON response. Cost per request is trivial.
- T-03-05-03 (Repudiation via silent deprecation) — **mitigated**: the 410 body carries an explicit deprecation message naming the replacement endpoint, and the in-code comment block documents the removal plan for future code readers.

No new surface introduced — this plan strictly reduces surface (96 lines of order-creation code path, now gone).

## Self-Check: PASSED

- File `../backend-services/carEx-services/server.js` — FOUND (modified by Task 1; post-edit lines 1086-1091 contain the 410 stub)
- Backend commit `1238c6d` (Task 1, feat) — FOUND in backend repo log
- `node --check server.js` — exit 0
- `grep -c "app.post('/api/orders'" server.js` — returns 1
- `grep -A 10 "app.post('/api/orders'" server.js | grep -c "status(410)"` — returns 1
- `grep -A 10 "app.post('/api/orders'" server.js | grep -c "'deprecated'"` — returns 1
- `grep -A 10 "app.post('/api/orders'" server.js | grep -c "confirm-booking which now creates orders atomically"` — returns 1
- `grep -A 15 "app.post('/api/orders'" server.js | grep -c "ServiceOrder.create"` — returns 0 (old handler body gone)
- `grep -A 15 "app.post('/api/orders'" server.js | grep -c "providerSnapshot"` — returns 0 (old handler body gone)
- `grep -c "attachAuthIfPresent" server.js` — returns 6 (1 require + 5 route usages, unchanged from Plan 03-04 post-state)
- `git diff --stat server.js` (pre-commit) — showed `1 file changed, 11 insertions(+), 96 deletions(-)` = net -85 lines (acceptance: "at least ~85 line reduction")
- Zero file deletions in the backend commit (`git diff --diff-filter=D --name-only HEAD~1 HEAD` — empty)

---
*Phase: 03-backend-enforcement-backend*
*Completed: 2026-04-17*
