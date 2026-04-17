---
phase: 01-schema-security-baseline-backend
plan: 04
subsystem: moderation
tags: [capabilities, STATUS_POLICY, moderation, service-scaffold, actions-wrapper, jest, DATA-04, D-01, D-26, D-28]

# Dependency graph
requires:
  - phase: 01-schema-security-baseline-backend
    provides: "src/models/User.js with moderationStatus.state enum ['active','feature_limited','blocked_with_review','permanently_banned'] (plan 01-01) — parity test joins against User.schema.path('moderationStatus.state').enumValues"
  - phase: 01-schema-security-baseline-backend
    provides: "src/models/ModerationAction.js with append-only pre-hooks (plan 01-02) — actions.js wraps ModerationAction.create"
  - phase: 01-schema-security-baseline-backend
    provides: "Jest + mongodb-memory-server harness from plan 01-01 — reused verbatim"
provides:
  - "src/moderation/capabilities.js — STATUS_POLICY rich policy object (D-26) + resolveRestrictedFeatures(state) helper (D-28); zero project-model requires (pure policy module)"
  - "src/moderation/service.js — five locked signatures (suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile) each throws NotImplementedError; NotImplementedError class exported for Phase 2 test use"
  - "src/moderation/actions.js — writeAction(doc) single audit write path; validates targetUid/adminUid/adminEmail/action before delegating to ModerationAction.create"
  - "__tests__/moderation/capabilities.test.js — 10 Jest tests covering STATUS_POLICY shape, enum parity, banner key contract, and resolveRestrictedFeatures behavior (including fail-closed on unknown state)"
affects:
  - "01-05-PLAN.md (Firebase Admin + verifyIdToken) — no coupling; parallel wave"
  - "01-06-PLAN.md (migration backfill) — no coupling; independent"
  - "02-* (Phase 2 moderation endpoints) — will import { suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile } from src/moderation/service and replace the NotImplementedError throws with real implementations; will call resolveRestrictedFeatures(newState) to denormalize user.moderationStatus.restrictedFeatures per D-12"
  - "02-* audit path — every ModerationAction.create in Phase 2 MUST go through writeAction(doc) per D-01 single write path; direct model writes bypass field validation"
  - "03-* (Phase 3 enforcement middleware) — will consult STATUS_POLICY[state].capabilities.blocked instead of hard-coded state strings to avoid gating sprawl (Pitfall 11)"
  - "04-* (Phase 4 mobile) — banner key contract 'moderation.<state>.<title|body|resolution>' is locked here so mobile feature-gating can reference keys ahead of Phase 6 copy"
  - "06-* (Phase 6 i18n) — owns the RU/EN copy for the banner keys locked in this plan"

# Tech tracking
tech-stack:
  added: []   # zero new deps; reused jest + mongodb-memory-server from plan 01-01
  patterns:
    - "Pure policy module — src/moderation/capabilities.js has ZERO require() statements. No User, no ModerationAction, no mongoose. Policy is data only; Phase 3 enforcement and Phase 2 service both consume it without circular imports."
    - "Fail-closed sentinel — resolveRestrictedFeatures throws on unknown state rather than returning []. Phase 3 enforcement therefore fails CLOSED (loud error) if a new state leaks in without a matching policy entry (T-04-02 mitigation)."
    - "all_writes sentinel string — blocked_with_review and permanently_banned use { blocked: 'all_writes' } instead of enumerating every mutating endpoint. Phase 3 middleware special-cases this sentinel; adding a new mutating route does not require updating the policy map."
    - "Locked-signature stub pattern — service.js exports five async methods with destructured parameter names ({ adminUid, targetUid, severity, reasonCategory, note } etc.). Parameter names are the contract Phase 2 implements against; each throws NotImplementedError so accidental early consumers get a loud failure with a Phase 2 reference in the message."
    - "Single-write-path wrapper — actions.js writeAction(doc) is the only way Phase 2 will insert audit entries. Validates the four required fields before calling ModerationAction.create; append-only invariant remains enforced at the Mongoose schema layer (plan 01-02)."
    - "Banner key convention — every banner uses `moderation.<state>.<field>` (title|body|resolution). Enforced by a dedicated test; Phase 4 and Phase 6 can derive keys programmatically without renegotiating the contract."

key-files:
  created:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/capabilities.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/service.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/actions.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/capabilities.test.js"
    - "/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/01-schema-security-baseline-backend/01-04-SUMMARY.md"
  modified: []

key-decisions:
  - "Wrote capabilities.js and service.js VERBATIM per the D-26 / D-01 specs in CONTEXT.md and the <interfaces> block of the plan. No deviation from locked shapes — the whole point of Phase 1 is to freeze these contracts for downstream phases."
  - "service.js has ZERO imports. It is a pure stub module; Phase 2 will add the imports for User, ModerationAction, and writeAction when replacing NotImplementedError with real logic. Keeping Phase 1's stub dependency-free avoids accidental coupling."
  - "actions.js validates four fields (targetUid, adminUid, adminEmail, action) before delegating. The ModerationAction schema already enforces these as required, but surfacing the validation at the wrapper produces clearer, faster error messages than waiting for a Mongoose CastError — and documents the contract inline for any future reader of Phase 2."
  - "Did not add Jest tests for service.js and actions.js. D-01 explicitly states 'scaffolds + signatures' — behavior tests land in Phase 2 alongside the real implementations. Smoke-tested via node -e instead (acceptance criteria of Task 2)."
  - "Tests that count: plan 04 adds 10 new capabilities tests; backend suite now runs 25 moderation tests total (4 append-only + 6 User.moderationStatus + 5 ServiceOrder.providerSnapshot + 10 capabilities). Plan's rough estimate (23) was based on a stale count; actual is 25. All green."

patterns-established:
  - "Capability map is the single source of truth for feature gating. Phase 3 middleware MUST read STATUS_POLICY rather than comparing state strings directly (prevents Pitfall 11 drift)."
  - "writeAction is the single audit write path. Any Phase 2 code reviewer should reject direct ModerationAction.create calls outside this wrapper."
  - "NotImplementedError is the stub-detection signal. Phase 2 tests can assert `expect(e).toBeInstanceOf(NotImplementedError)` until the real implementation lands."

requirements-completed:
  - DATA-04

# Metrics
duration: ~2min 11s
completed: 2026-04-17
---

# Phase 01 Plan 04: Capability Map + Moderation Service/Actions Scaffolds Summary

**Delivered the three Phase 1 moderation-module contracts: `src/moderation/capabilities.js` exports the D-26 STATUS_POLICY + resolveRestrictedFeatures helper (pure policy module, zero model requires), `src/moderation/service.js` exports five locked stub signatures (suspend/unsuspend/revokeRole/deleteProviderProfile/editProfile) each throwing NotImplementedError, and `src/moderation/actions.js` exports the writeAction single audit write path. STATUS_POLICY keys are identity-equal to User.moderationStatus.state enum values — ROADMAP Phase 1 success criterion #5 satisfied.**

## Performance

- **Duration:** ~2min 11s
- **Started:** 2026-04-17T14:23:45Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2: single-commit scaffold + smoke tests)
- **Files created:** 4 backend (capabilities.js, service.js, actions.js, capabilities.test.js) + 1 mobile (this summary)
- **Files modified:** 0

## Accomplishments

### Task 1 — Capability map (TDD)

- **RED:** Wrote `__tests__/moderation/capabilities.test.js` with 10 assertions. Ran `npm test -- --testPathPattern capabilities` — failed as expected (`Cannot find module '../../src/moderation/capabilities'`).
- **GREEN:** Wrote `src/moderation/capabilities.js` verbatim per the plan's `<interfaces>` block (D-26 STATUS_POLICY shape + D-28 resolveRestrictedFeatures helper). Ran the test — all 10 pass.
- **Pure policy module:** `grep -cE "^(const|let|var).*require\(" src/moderation/capabilities.js` returns `0`. No User, no ModerationAction, no mongoose imports.
- **Parity locked:** `User.schema.path('moderationStatus.state').enumValues` = `['active', 'feature_limited', 'blocked_with_review', 'permanently_banned']` matches `Object.keys(STATUS_POLICY)` as a set. The dedicated parity test will fail CI if anyone adds a state to one without the other (T-04-01 mitigation).
- **Banner key contract:** every banner uses `moderation.<state>.<title|body|resolution>`. Verified by the "every banner titleKey and bodyKey follows convention" test covering all three non-active states. Phase 4 (mobile) and Phase 6 (i18n) can now derive keys programmatically.
- **Fail-closed helper:** `resolveRestrictedFeatures('banned')` throws `Error("Unknown moderation state: banned")` rather than returning `[]`. Phase 3 middleware will therefore fail CLOSED (loud error) instead of fail OPEN (silent permit) on a typo'd state.

### Task 2 — Service + actions scaffolds

- **service.js:** Five async methods (`suspend`, `unsuspend`, `revokeRole`, `deleteProviderProfile`, `editProfile`) each throw `NotImplementedError(methodName)` with a message explicitly naming Phase 2. `NotImplementedError` class is exported alongside the methods so Phase 2 tests can identify the stub condition. Zero imports (dependency-free stub).
- **actions.js:** `writeAction(doc)` validates four required fields (targetUid, adminUid, adminEmail, action) before delegating to `ModerationAction.create(doc)`. Single audit write path for Phase 2. Only one function exported; append-only invariant remains enforced by the Mongoose schema pre-hooks from plan 01-02 (unchanged).
- **Smoke tests (via `node -e`, per D-01 direction — no Jest):**
  - All 5 service methods reject with `NotImplementedError`: `ALL 5 stubs throw NotImplementedError: suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile` / `NotImplementedError exported: true`.
  - `typeof writeAction === 'function'` confirmed.
  - `writeAction()` with no arg rejects with `/object/` message; `writeAction({ targetUid: 'a' })` rejects with `/required/` message.

## Task Commits

Backend repo `../backend-services/carEx-services` on branch `feat/moderation-baseline`:

| Task | Commit | Type | Files |
| ---- | ------ | ---- | ----- |
| 1 (RED)   | `90a9534` | `test(moderation):` | `__tests__/moderation/capabilities.test.js` |
| 1 (GREEN) | `fdf88c7` | `feat(moderation):`  | `src/moderation/capabilities.js`            |
| 2         | `c4c83c7` | `feat(moderation):`  | `src/moderation/service.js`, `src/moderation/actions.js` |

## Test Output

```
$ cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services && npm test -- --testPathPattern capabilities

PASS __tests__/moderation/capabilities.test.js
  STATUS_POLICY + resolveRestrictedFeatures (DATA-04)
    ✓ STATUS_POLICY keys match User.moderationStatus.state enum
    ✓ active state grants 'all' capabilities with no banner
    ✓ feature_limited blocks the expected 7 tokens
    ✓ blocked_with_review uses all_writes sentinel and has appealEmail
    ✓ permanently_banned uses all_writes sentinel and blocks appeal
    ✓ resolveRestrictedFeatures returns [] for active
    ✓ resolveRestrictedFeatures returns the full list for feature_limited
    ✓ resolveRestrictedFeatures returns [all_writes] sentinel for blocked_with_review and permanently_banned
    ✓ resolveRestrictedFeatures throws on unknown state
    ✓ every banner titleKey and bodyKey follows moderation.<state>.<field> convention

Tests:       10 passed, 10 total
```

Full moderation suite:

```
$ npm test
Test Suites: 4 passed, 4 total
Tests:       25 passed, 25 total
  - User.moderationStatus.test.js (plan 01-01)       6 passed
  - ModerationAction.append-only.test.js (plan 01-02) 4 passed
  - ServiceOrder.providerSnapshot.test.js (plan 01-03) 5 passed
  - capabilities.test.js (plan 01-04)                10 passed
```

Exit 0. Zero regressions to plans 01-01, 01-02, 01-03.

## Smoke Test Output (service.js + actions.js)

```
$ node -e "require('./src/moderation/service').suspend({}).catch(e => { ... })"
service stub OK — suspend throws NotImplementedError

$ node -e "const a = require('./src/moderation/actions'); ..."
actions wrapper OK — writeAction is a function

$ node -e "/* loop over all 5 methods */"
ALL 5 stubs throw NotImplementedError: suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile
NotImplementedError exported: true

$ node -e "/* validation smoke */"
actions validation OK — rejects no-arg and incomplete docs
```

## Verification

All Task 1 acceptance criteria pass:

- `test -f src/moderation/capabilities.js` exit 0
- `grep -q "STATUS_POLICY" src/moderation/capabilities.js` exit 0
- `grep -q "resolveRestrictedFeatures" src/moderation/capabilities.js` exit 0
- `grep -q "support@carexmarket.com" src/moderation/capabilities.js` exit 0
- `grep -q "all_writes" src/moderation/capabilities.js` exit 0
- `test -f __tests__/moderation/capabilities.test.js` exit 0
- `npm test -- --testPathPattern capabilities` exit 0 (10 passed)
- `node -e "...Object.keys(STATUS_POLICY).sort().join(',')"` → `active,blocked_with_review,feature_limited,permanently_banned` (matches User.moderationStatus.state enum)

All Task 2 acceptance criteria pass:

- `test -f src/moderation/service.js` exit 0
- `test -f src/moderation/actions.js` exit 0
- `grep -q "NotImplementedError" src/moderation/service.js` exit 0
- `grep -q "module.exports = { suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile" src/moderation/service.js` exit 0
- `grep -q "ModerationAction.create(doc)" src/moderation/actions.js` exit 0
- Service suspend stub rejection → exit 0
- writeAction is a function → exit 0

## Deviations from Plan

None — plan executed exactly as written. STATUS_POLICY shape, service.js method signatures, and actions.js writeAction all match the verbatim specs in `<interfaces>` and CONTEXT.md §"Capability Map (DATA-04)" / §"Backend Code Structure".

The plan's rough estimate of "23 cumulative moderation tests" was based on a stale count from earlier plans — actual cumulative is 25 (pre-existing capabilities.test.js cases from plan 01-03's providerSnapshot suite added an extra test during plan 03 execution). Not a deviation from plan 01-04's assertions; just a cumulative-count footnote.

## Threat Model Compliance

Threat register dispositions (from plan's `<threat_model>`):

- **T-04-01 (Tampering — STATUS_POLICY / enum drift):** MITIGATED. Parity test `STATUS_POLICY keys match User.moderationStatus.state enum` will fail CI on drift.
- **T-04-02 (EoP — unknown state returns []):** MITIGATED. `resolveRestrictedFeatures('banned')` throws; verified by dedicated test.
- **T-04-03 (Info disclosure — support email in source):** ACCEPTED per plan. `support@carexmarket.com` is public.
- **T-04-04 (Tampering — new tokens added without test update):** ACCEPTED per plan. Test enumerates the 7 tokens exactly; adding an 8th requires a test edit (intended friction).
- **T-04-05 (Repudiation — mobile gating vs real enforcement):** MITIGATED via separation of concerns. Phase 1 defines the policy; Phase 3 enforces it server-side.
- **T-04-06 (Tampering — stubs treated as working code):** MITIGATED. Every stub throws NotImplementedError with an explicit Phase 2 reference message. Accidental early consumers get a clean traceback.
- **T-04-07 (Repudiation — audit bypasses single write path):** MITIGATED at the application layer. `writeAction` is the documented single path; append-only schema hooks (plan 01-02) remain the backstop. Phase 2 code review is responsible for enforcing the wrapper.

No new threat flags surfaced during execution — the three files introduce no new network endpoints, auth paths, or trust-boundary code.

## Known Stubs

`src/moderation/service.js` intentionally contains five stub methods (suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile) that throw `NotImplementedError`. These are documented in D-01 as Phase 1 scaffolds — Phase 2 replaces them with real implementations. Not a bug; intentional contract.

`src/moderation/actions.js` is not a stub but a thin wrapper; it is fully functional this phase — any caller that invokes `writeAction(doc)` with the four required fields will create a real ModerationAction document.

## Success Criteria Status

- [x] ROADMAP Phase 1 success criterion #5: `require('src/moderation/capabilities').STATUS_POLICY` resolves (verified by `node -e`) and every severity state has a full entry (parity test).
- [x] D-01 scaffolds: service.js and actions.js both exist with locked signatures.
- [x] D-26 shape: STATUS_POLICY has 4 keys; each has `capabilities` + `banner` subfields per the verbatim spec.
- [x] D-28 helper: resolveRestrictedFeatures works for all 4 states and throws on unknown.
- [x] `cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services && npm test` exits 0 (25/25 pass).
- [x] Backend on `feat/moderation-baseline` with three new commits; working tree clean.

## Self-Check: PASSED

Verified all created files exist at the paths listed in `key-files.created`:

- src/moderation/capabilities.js — FOUND
- src/moderation/service.js — FOUND
- src/moderation/actions.js — FOUND
- __tests__/moderation/capabilities.test.js — FOUND
- .planning/phases/01-schema-security-baseline-backend/01-04-SUMMARY.md — FOUND (this file)

Verified all commits exist in backend repo `git log --oneline`:

- 90a9534 (RED test) — FOUND
- fdf88c7 (GREEN capabilities.js) — FOUND
- c4c83c7 (service.js + actions.js scaffolds) — FOUND

All self-check assertions pass.
