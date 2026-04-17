---
phase: 03-backend-enforcement-backend
plan: 01
subsystem: database
tags: [mongoose, pre-find-hook, read-time-visibility, enf-02]

# Dependency graph
requires:
  - phase: 01-schema-security-baseline-backend
    provides: User model at src/models/User.js with moderationStatus.state + indexes
  - phase: 02-admin-moderation-endpoints-backend
    provides: User.moderationStatus mutation surface (suspend/unsuspend/revoke) that these hooks read
provides:
  - Car model at src/models/Car.js with pre(/^find/) hide-hook (sellerId join, sellerStatus gate)
  - Broker model at src/models/Broker.js with pre(/^find/) hide-hook (ownerUid join, brokerStatus gate)
  - LogisticsPartner model at src/models/LogisticsPartner.js with pre(/^find/) hide-hook (ownerUid join, logisticsStatus gate)
  - Grep-visible includeAllUsers bypass flag on every hook (one use per file)
affects: [03-03 (server.js require-ins + inline-schema deletes), 03-04 (confirm-booking uses these models), 03-06 (hideOnFind.test.js, acceptance.test.js)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mongoose pre(/^find/) query middleware with query-option bypass"
    - "Lazy mongoose.model('User') resolution inside hooks to avoid load cycles"
    - "Read-time visibility computation (no denormalized flag mutation)"

key-files:
  created:
    - ../backend-services/carEx-services/src/models/Car.js
    - ../backend-services/carEx-services/src/models/Broker.js
    - ../backend-services/carEx-services/src/models/LogisticsPartner.js
  modified: []

key-decisions:
  - "Car join on sellerId (existing field); Broker/LogisticsPartner on ownerUid — verified against server.js:383, 559, 614 existing query shapes (D-06)."
  - "Lazy mongoose.model('User') resolution inside each hook instead of top-level require('./User') — removes a potential model-load cycle and keeps the hook body self-contained."
  - "Each model file ships its own independent serviceItemSchema clone. Broker + LogisticsPartner do NOT share a sub-schema import — keeps each model self-contained and matches 03-PATTERNS.md §Broker/LogisticsPartner recommendation."
  - "Pre-existing duplicate-index warning on ownerUid (inline unique + schema.index) preserved verbatim from server.js:146-158/163-177 per scope boundary. Cleanup deferred to after Plan 03-03 removes the inline schemas (see deferred-items.md)."

patterns-established:
  - "Hide-hook signature: `<schema>.pre(/^find/, async function () { if (this.getOptions().includeAllUsers) return; … this.setQuery({ ...this.getQuery(), <joinField>: { $nin: hiddenUids } }); });` — grep-friendly + uniform across all three models for Phase 6 QUAL-03 review"
  - "Bypass flag `includeAllUsers: true` is query-option level (not filter level) — a caller passing it inside a filter literal does NOT activate the bypass (T-03-01-02 mitigation)"
  - "Model extraction preserves registered name AND collection — Car (no collection arg, default 'cars' pluralization), Broker ('brokers' explicit), LogisticsPartner ('logistics_partners' explicit) — matches inline server.js registrations so existing resolvers continue to work"

requirements-completed: [ENF-02]

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 3 Plan 1: Hide-Hook Model Extraction Summary

**Three Mongoose models (Car, Broker, LogisticsPartner) extracted from `server.js` into `src/models/` with co-located `pre(/^find/)` hide-hooks that read User moderationStatus + role status and rewrite the query with `$nin` on hidden owner uids.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T20:03:22Z
- **Completed:** 2026-04-17T20:05:59Z
- **Tasks:** 2 (of 2)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- Extracted `carSchema`, `brokerSchema`, `logisticsPartnerSchema` verbatim from `server.js:95-179` into dedicated model files at `../backend-services/carEx-services/src/models/{Car,Broker,LogisticsPartner}.js`.
- Attached `pre(/^find/)` hide-hook on each model: resolves the hidden-uid set via `User.distinct` on `moderationStatus.state !== 'active' OR <role>Status !== 'APPROVED'`, then rewrites `this.setQuery` with `$nin` on the correct owner-join field (`sellerId` for Car, `ownerUid` for Broker + LogisticsPartner).
- Co-located `includeAllUsers` bypass inside each hook — exactly one use per file, grep-visible for Phase 6 QUAL-03 review.
- Registered each model with its existing name and collection (`'Car'` with default pluralization; `'Broker'` → `'brokers'`; `'LogisticsPartner'` → `'logistics_partners'`) so callers elsewhere in `server.js` resolving by `mongoose.model('X')` continue to hit the same instance.
- Preserved existing `brokerSchema.index({ ownerUid: 1 }, { unique: true })` and `logisticsPartnerSchema.index({ ownerUid: 1 }, { unique: true })`.
- Proved all three models load + expose `find()` via `node -e "require('./src/models/Car'); require('./src/models/Broker'); require('./src/models/LogisticsPartner')"` — no throw.

## Task Commits

Each task was committed atomically in the BACKEND repo (`../backend-services/carEx-services`):

1. **Task 1: Extract Car model with pre(/^find/) hide-hook** — backend `6fb6adb` (feat)
2. **Task 2: Extract Broker and LogisticsPartner models with hide-hooks** — backend `debad04` (feat)

**Plan metadata commit:** captured in the mobile repo (see final commit below) with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified

Backend repo (`../backend-services/carEx-services/`):
- `src/models/Car.js` — Car schema + pre(/^find/) hook joining on `sellerId`, gating on `sellerStatus !== 'APPROVED'` or non-active moderation. Exports `mongoose.model('Car', carSchema)` (default 'cars' collection).
- `src/models/Broker.js` — local serviceItemSchema clone + Broker schema + unique `ownerUid` index + pre(/^find/) hook joining on `ownerUid`, gating on `brokerStatus !== 'APPROVED'`. Exports `mongoose.model('Broker', brokerSchema, 'brokers')`.
- `src/models/LogisticsPartner.js` — local serviceItemSchema clone + LogisticsPartner schema + unique `ownerUid` index + pre(/^find/) hook joining on `ownerUid`, gating on `logisticsStatus !== 'APPROVED'`. Exports `mongoose.model('LogisticsPartner', logisticsPartnerSchema, 'logistics_partners')`.

Mobile repo (`.planning/`):
- `.planning/phases/03-backend-enforcement-backend/03-01-SUMMARY.md` — this file.
- `.planning/phases/03-backend-enforcement-backend/deferred-items.md` — logs the pre-existing duplicate-index warning surfaced during Task 2 smoke test.

## Decisions Made

- **Join field matrix confirmed and codified in code**: Car→`sellerId`; Broker→`ownerUid`; LogisticsPartner→`ownerUid`. Matches D-06 and was cross-checked against existing query usage at `server.js:383, 559, 614`.
- **Lazy `mongoose.model('User')` resolution** inside the hook (not top-level require). Keeps model load order flexible for tests that `require` Car/Broker/Logistics before User is registered (D-08).
- **Independent serviceItemSchema clones** in Broker.js + LogisticsPartner.js rather than a shared helper. PATTERNS.md called this explicitly; avoids coupling + cycle risk. Mongoose treats independent sub-schema instances as equivalent for validation.
- **No changes to `Broker.status` / `LogisticsPartner.status`** (the existing 'active'|'inactive' operational field). Moderation is orthogonal per Phase 2 D-10.
- **Scope discipline**: `server.js` intentionally NOT touched — Plan 03-03 deletes the inline schemas + adds `require()` statements. Keeping both schemas live simultaneously is safe because Mongoose's `mongoose.model('X', schema)` on a name already registered would throw `OverwriteModelError` — but both files register EACH name exactly once during Wave 1 tests (tests should not boot `server.js`, per plan objective note).

## Deviations from Plan

None - plan executed exactly as written.

One pre-existing concern was surfaced but is OUT OF SCOPE per deviation-rules SCOPE BOUNDARY:

- **Duplicate-index warning on Broker + LogisticsPartner**: Mongoose warns that `ownerUid` has both `unique: true` inline and a separate `schema.index({ ownerUid: 1 }, { unique: true })` call. Both forms come directly from the verbatim schema text at `server.js:146-158` / `server.js:163-177`. Plan explicitly required VERBATIM lift AND the acceptance criteria require the explicit `schema.index` form to be present. Any fix would violate both requirements. Logged to `.planning/phases/03-backend-enforcement-backend/deferred-items.md` for cleanup after Plan 03-03 removes the inline schemas.

## Issues Encountered

None.

## Known Stubs

None. All three files are production-ready model definitions; the hide-hook is fully functional (pending `User` model being registered before the first find — which is how the existing `server.js` already operates).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plan 03-02** (requireNotSuspended middleware) — no dependency on the extracted models; independent.

**Ready for Plan 03-03** (server.js integration) — Plan 03-03 will:
1. `require('./src/models/Car')`, `require('./src/models/Broker')`, `require('./src/models/LogisticsPartner')` at top of `server.js`.
2. Delete the inline `const Car = mongoose.model('Car', carSchema)` at `server.js:133`, `const Broker = mongoose.model('Broker', brokerSchema, 'brokers')` at `server.js:160`, and `const LogisticsPartner = mongoose.model('LogisticsPartner', logisticsPartnerSchema, 'logistics_partners')` at `server.js:179`.
3. Delete the corresponding inline schema declarations.
4. Compose the ENF-01 middleware on the 5 gated routes.

**Ready for Plan 03-06** (enforcement tests) — `hideOnFind.test.js` can now `require('../../src/models/Car')` directly. The test file MUST require `User` first (or reset model registry per-test) to ensure `mongoose.model('User')` resolves inside the hook.

**Blockers / concerns for Phase 3 downstream:** None new. The pre-existing duplicate-index warning is tracked in `deferred-items.md` for follow-up after inline-schema deletion.

## Self-Check: PASSED

- File `../backend-services/carEx-services/src/models/Car.js` — FOUND
- File `../backend-services/carEx-services/src/models/Broker.js` — FOUND
- File `../backend-services/carEx-services/src/models/LogisticsPartner.js` — FOUND
- File `.planning/phases/03-backend-enforcement-backend/03-01-SUMMARY.md` — FOUND
- File `.planning/phases/03-backend-enforcement-backend/deferred-items.md` — FOUND
- Backend commit `6fb6adb` (Task 1) — FOUND in backend repo log
- Backend commit `debad04` (Task 2) — FOUND in backend repo log

---
*Phase: 03-backend-enforcement-backend*
*Completed: 2026-04-17*
