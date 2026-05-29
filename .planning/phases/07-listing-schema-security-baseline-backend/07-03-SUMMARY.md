---
phase: 07-listing-schema-security-baseline-backend
plan: 03
subsystem: backend/moderation
tags: [capability-map, listing-moderation, ldata-01, foundation]
requires:
  - 07-01: Car.status enum (active/suspended/archived/deleted) — directly read by the keyset-equality test
provides:
  - LISTING_STATUS_POLICY: 4-state capability map keyed by Car.status enum, values are { buyerBlocked: string[], banner: null | { titleKey, bodyKey, severity } }
  - resolveBlockedBuyerActions: (state: string) => string[] — nullish-coalesce fallback for unknown states (D-14)
  - banner translation-key contract: listingBannerSuspendedTitle/Body, listingBannerArchivedTitle/Body, listingBannerDeletedTitle/Body
affects:
  - Phase 9 (read-time hide hooks + cart-add/confirm-booking re-verification) — will call resolveBlockedBuyerActions(listing.status)
  - Phase 11 (buyer-banner component in translations.ts) — will bind to the listingBanner* keys
tech-stack:
  added: []
  patterns:
    - "pure-JS capability-map module (forked structurally from v1.0 src/moderation/capabilities.js per 07-PATTERNS.md §3)"
    - "schema↔policy keyset-equality jest assertion (foundational invariant lock per 07-PATTERNS.md §10)"
    - "MongoMemoryServer-isolated test (D-20: no server.js boot)"
key-files:
  created:
    - ../backend-services/carEx-services/src/moderation/listingCapabilities.js
    - ../backend-services/carEx-services/__tests__/listing-moderation/listingCapabilities.test.js
  modified: []
decisions:
  - "Chose nullish-coalesce fallback (`?? []`) over v1.0's throw-on-unknown-state pattern — D-14 authoritative. Rationale: Phase 9 will pass listing state from arbitrary client-path inputs; defensive empty-list return avoids leaking taxonomy via thrown error messages."
  - "Banner translation keys use flat `listingBanner*` prefix (not dotted `moderation.<state>.<field>` v1.0 convention) — D-14a, prevents collision with v1.0 keys in translations.ts."
  - "Module-level test loaded Car model via require to read enumValues; MongoMemoryServer connect/disconnect in beforeAll/afterAll mirrors v1.0 capabilities.test.js harness despite this module not touching the DB itself (model registration touches Mongoose)."
metrics:
  duration_minutes: ~7
  completed_date: 2026-05-28
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_added: 7
  commits: 2
---

# Phase 7 Plan 03: Listing Capability Map + Resolver Summary

**One-liner:** Landed `LISTING_STATUS_POLICY` (4-state buyer-action policy map) + `resolveBlockedBuyerActions(state)` resolver as pure-JS module — with a jest set-equality lock between policy keys and the `Car.status` enum so future enum drift breaks CI immediately.

## What changed

Two new files in the backend repo, no modifications:

1. **`src/moderation/listingCapabilities.js`** (54 lines, new) — pure-JS module exporting `LISTING_STATUS_POLICY` (the 4-state D-14 verbatim map) and `resolveBlockedBuyerActions(state)` (nullish-coalesce resolver). Phase 9 enforcement code + Phase 11 buyer-banner copy both bind here.
2. **`__tests__/listing-moderation/listingCapabilities.test.js`** (88 lines, new) — 7 jest tests inside one MongoMemoryServer harness: 1 schema-equality lock + 4 per-state shape assertions + 1 resolver per-state coverage + 1 resolver fallback test.

The Phase 9 enforcement code that will *consume* this module is out of scope (as designed by D-14 — Phase 9 gets a "use file" coupling rather than "create + use" coupling).

## How it was built

- Task 1: cloned the structural shape of v1.0 `src/moderation/capabilities.js` (the `STATUS_POLICY` + `resolveRestrictedFeatures` pair), replaced the user-mod state vocabulary with the 4 listing states, swapped `capabilities: 'all' | { blocked: [...] }` for D-14's flatter `buyerBlocked: []` shape, and adopted the `?? []` fallback in the resolver rather than v1.0's `throw new Error(...)` (per D-14 deliberate divergence — defensive default for Phase 9's client-path-derived state inputs).
- Task 2: cloned v1.0 `__tests__/moderation/capabilities.test.js` harness (MongoMemoryServer connect/disconnect — needed because requiring `Car` triggers Mongoose model registration). Rebuilt the assertion suite around the listing vocabulary: schema-equality lock against `Car.schema.path('status').enumValues`, per-state buyerBlocked+banner assertions for all 4 states, resolver coverage for documented + unknown states. Skipped the v1.0 "banner key follows X regex" test because the new keys are flat (`listingBannerSuspendedTitle`), not dotted (`moderation.suspended.title`).

## Verification

```
cd ../backend-services/carEx-services && npx jest __tests__/listing-moderation/listingCapabilities.test.js --bail
```

Result: `Tests: 7 passed, 7 total` — every per-state shape assertion green, the foundational D-19 keyset-equality lock green, the D-14 fallback contract green.

Sanity smoke (`node -e "console.log(require('./src/moderation/listingCapabilities').resolveBlockedBuyerActions('suspended'))"`) prints `[ 'add_to_cart', 'confirm_booking' ]` as specified by `<verification>` in PLAN.

## Commits

| Repo | Hash | Message |
|------|------|---------|
| backend | `f5e67a0` | feat(07-03): add LISTING_STATUS_POLICY capability map + resolveBlockedBuyerActions (LDATA-01) |
| backend | `43fe8ba` | test(07-03): assert LISTING_STATUS_POLICY ↔ Car.status keyset equality + per-state shapes (LDATA-01) |
| mobile  | (this commit) | docs(07-03): summarize listing capability map + resolver landing |

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes triggered. No checkpoints (autonomous plan, no `type="checkpoint:*"` tasks). No CLAUDE.md conflicts (work was entirely in the backend repo's `src/moderation/` directory and follows the mandated v1.0 structural fork pattern).

One trivial source-formatting tweak landed mid-task to satisfy the plan's `grep -c "Car.schema.path('status').enumValues"` acceptance check — the schema-equality test's `enumValues` read was initially split across two lines via a `statePath` local; collapsed to a single-line expression. Behavior identical, tests still 7/7 green. Not a Rule-1 deviation — purely an artifact of the acceptance criterion being grep-based.

## Threat surface scan

The plan's `<threat_model>` lists 3 STRIDE entries (T-07-03-01 mitigate via Task 2 keyset-equality lock; T-07-03-02 and T-07-03-03 accepted). Task 2 implements the T-07-03-01 mitigation literally — the schema-equality lock is the first test in the suite. No new trust boundaries beyond those documented in the plan.

## Threat Flags

None — files created are a pure-data module + its unit test. No new network endpoints, auth paths, file access patterns, or schema/data-model changes beyond those already captured in the plan threat model.

## Known Stubs

None. The `LISTING_STATUS_POLICY` is data-complete for all 4 states; the resolver is functionally complete with documented fallback behavior. Phase 9 consumers will arrive in their own plan; that's a forward dependency, not a stub. Phase 11's translation copy for the 6 `listingBanner*` keys is also a forward dependency (LQUAL-01) — the *key identifiers* land here per D-14b and become a referent for Phase 11 to populate.

## TDD Gate Compliance

Not applicable — this plan is `type: execute` (not `type: tdd`). However, Task 1 (`feat`) committed before Task 2 (`test`). This matches the plan-stated task ordering (Task 1 creates the module, Task 2 tests it) and the plan's acceptance criteria explicitly require Task 2 to import from Task 1's module. The keyset-equality lock would have been impossible to write usefully before the module existed.

## Forward links for downstream work

- **Phase 9 plan author:** call `resolveBlockedBuyerActions(listing.status)` from the `add_to_cart` + `confirm_booking` re-verify code paths. Empty array = allow; non-empty = block with the matching action token. Banner copy is for Phase 11 — Phase 9's thin-payload response can ship `listing.status` and Phase 11 will derive the banner from there.
- **Phase 11 plan author:** the 6 banner key strings (`listingBannerSuspendedTitle/Body`, `listingBannerArchivedTitle/Body`, `listingBannerDeletedTitle/Body`) need RU + EN copy entries in `carEx/src/constants/translations.ts`. The severity field (`'warning' | 'neutral' | 'destructive'`) is the styling discriminator for the banner component (color tokens / icon choice).

## Self-Check: PASSED

Created files exist:
- `../backend-services/carEx-services/src/moderation/listingCapabilities.js` — confirmed present (54 lines)
- `../backend-services/carEx-services/__tests__/listing-moderation/listingCapabilities.test.js` — confirmed present (88 lines)

Commits exist in backend repo:
- `f5e67a0` — `git log --oneline | grep f5e67a0` → match
- `43fe8ba` — `git log --oneline | grep 43fe8ba` → match

Verification command exit code: 0 (`Tests: 7 passed, 7 total`).

Sanity smoke from `<verification>`: prints `[ 'add_to_cart', 'confirm_booking' ]` — matches expected.
