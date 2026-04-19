---
phase: 06-affected-user-ux-security-review
plan: 02
subsystem: i18n
tags: [translations, i18n, phase-6, wave-1, copywriting, affected-user-ux, qual-01]

# Dependency graph
requires:
  - phase: 06-affected-user-ux-security-review
    plan: 01
    provides: QUAL-01 translation-parity.test.ts (live guard that must stay green across Wave 1 additions)
  - phase: 05-admin-moderation-ui-mobile
    plan: 02
    provides: Existing banner-comment convention and RU-first/EN-second structure in translations.ts
provides:
  - 35 new Phase 6 translation keys in RU block (494 total)
  - 35 new Phase 6 translation keys in EN block (494 total)
  - Banner severity title strings (bannerTitle{FeatureLimited,BlockedWithReview,PermanentlyBanned})
  - Appeal mailto fallback Alert strings (appealCta, appealNoMail{Title,Body}, appealOk, appealPlaceholder)
  - Banner expand/collapse hint strings (expandNote, collapseNote)
  - Gate overlay restore CTA (restoreProfile — feature_limited only)
  - Gate overlay copy matrix: 4 capabilities × 3 severities × 2 fields = 24 strings
  - QUAL-01 set-equality parity preserved (RU=EN=494 keys)
affects: [06-03-PLAN (UserStatusBanner consumes banner + appeal keys), 06-04-PLAN (FeatureGateOverlay consumes gate matrix + restoreProfile), 06-05-PLAN (GatedScreenWrapper wires wrappers with gate keys)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Banner-comment section marker precedent mirrored from Phase 5 (single `// ---- Phase N — Subject ----` line per language block)"
    - "35-key matrix expansion: 11 singleton keys + 4 capability families × 6 = 24 matrix keys"
    - "UI-SPEC §Copywriting Contract strings copied verbatim (D-05 locked; no paraphrasing)"
    - "Struck-key enforcement: appealCopyEmail / appealCopied / appealCancel explicitly NOT added (UI-SPEC Clipboard Decision; RN 0.83 removed legacy Clipboard module per CLAUDE.md)"

key-files:
  created: []
  modified:
    - src/constants/translations.ts

key-decisions:
  - "Plan's '32 new keys' figure was a miscount — the plan's enumerated action block lists 35 entries (3 banner + 1 appealCta + 4 mailto + 2 expand/collapse + 1 restoreProfile + 6×4 gate matrix). All grep-verifiable `<done>` criteria (gateCreateListing=6, gateCreateOrder=6, gateApplyProvider=6, gateContactSeller=6 per language) only hold if all 35 are added. Followed the enumerated keys; treated the 32 label as a plan-body-wins inconsistency (Rule 1 auto-fix)"
  - "EN strings copied verbatim from UI-SPEC §Copywriting — no paraphrasing, no wordsmithing; D-05 locks the exact copy so Wave 2 component tests can assert literal string matches if needed"
  - "Struck keys (appealCopyEmail/appealCopied/appealCancel) NOT added — UI-SPEC Clipboard Decision is definitive: RN 0.83 removed legacy @react-native-community/clipboard and CLAUDE.md forbids new state-management or networking libs for this milestone. Single Alert button `appealOk` handles the mailto-fallback UX per D-08"
  - "Reason-category labels (reasonSpam / reasonPolicyViolation / reasonFraud / reasonOther) NOT re-added — Phase 5 already ships them; re-adding would create duplicate keys and regress parity. Explicitly called out in Task 1 action text"
  - "35 additions placed at the END of each language block, preceded by a Phase-6 banner comment — matches Phase 5 precedent at lines 398 (RU) and 929 (EN). Keeps Phase 5 keys byte-identical and preserves banner-comment convention"

requirements-completed: []

# Metrics
duration: 2m45s
completed: 2026-04-19
---

# Phase 6 Plan 02: Translations Additions Summary

**35 new Phase 6 translation keys landed in both RU and EN blocks of `src/constants/translations.ts` (494 keys per language, up from 459 baseline). QUAL-01 parity test stays green — RU and EN key sets remain identical across the entire expansion.**

## Performance

- **Duration:** 2m45s
- **Started:** 2026-04-19T08:22:35Z
- **Completed:** 2026-04-19T08:25:20Z
- **Tasks:** 2
- **Files modified:** 1 (src/constants/translations.ts)

## Accomplishments

- 35 Phase 6 string keys now available in RU and EN for Wave 2+ component plans (06-03, 06-04, 06-05)
- QUAL-01 set-equality invariant preserved — `__tests__/translation-parity.test.ts` passes 3/3 (RU key set === EN key set, every value non-empty, no TODO/FIXME placeholders)
- Baseline 459/459 → 494/494 (+35 per language)
- Banner severity copy, gate overlay copy matrix (4×3×2), appeal mailto-fallback, and expand/collapse hints all deliverable
- Zero regression on Phase 5 and earlier keys (byte-identical preservation verified by diff showing only additions)
- Phase 6 Wave 0 scaffolds (3 component `test.todo` suites + parity test) continue green: 39 todo + 3 passed = 42 total, 0 failed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 6 keys to RU block (35 entries)** — `6a44e34` (feat)
2. **Task 2: Add Phase 6 keys to EN block (35 entries) + run parity test** — `a2808c2` (feat)

## Files Created/Modified

- `src/constants/translations.ts` — +110 lines net (55 RU additions at new end-of-RU-block position, 55 EN additions at new end-of-EN-block position). Baseline 1065 lines → 1175 lines. RU additions land between `capItemWithdrawFunds` (line 531, pre-edit) and the `},` RU-block closer; EN additions land between `capItemWithdrawFunds` (line 1117, pre-edit) and the `}` EN-block closer

## Decisions Made

See `key-decisions` in frontmatter. Primary:
- Plan's "32" label resolved in favor of the 35 enumerated keys — grep-verifiable `<done>` criteria force the full 35 and dropping any would break downstream Wave-2 component wiring
- UI-SPEC §Copywriting D-05 strings are the source of truth; no paraphrasing or wordsmithing
- Struck keys (appealCopyEmail / appealCopied / appealCancel) confirmed NOT added (grep count = 0)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Label bug] Plan objective states "32 new keys" but the enumerated action block lists 35**
- **Found during:** Task 1 pre-insertion counting (3 banner + 1 appealCta + 4 mailto + 2 expand/collapse + 1 restoreProfile + 6×4 gate = 35)
- **Issue:** The plan frontmatter (`must_haves.truths`) and Task 2 done criteria (`459 + 32 = 491`) both state 32, but the plan's actual enumerated keys total 35 and the grep-verifiable acceptance criteria (gateCreateListing × 6 per lang, gateCreateOrder × 6 per lang, gateApplyProvider × 6 per lang, gateContactSeller × 6 per lang, plus 11 singleton keys) require all 35
- **Fix:** Followed the enumerated action block verbatim (35 keys per language). Result is RU=EN=494, not 491
- **Files modified:** src/constants/translations.ts
- **Commits:** `6a44e34` (RU), `a2808c2` (EN)
- **Rationale:** Plan body and grep counts are the contract; the 32/491 labels are a miscount. Wave 2 components reference each of the 35 base-names — dropping any three would break Wave 2 implementation

**Total deviations:** 1 label-level bug auto-fixed. Zero functional deviations — all 35 strings copied verbatim from UI-SPEC §Copywriting Contract.

## Issues Encountered

None of substance. Two PreToolUse READ-BEFORE-EDIT reminder hooks fired during the session; the Edit tool accepted both changes immediately on first attempt (file had been read multiple times in this session), and no retries were necessary.

## User Setup Required

None — this plan only modifies a source file. No dashboards, env vars, secrets, native rebuilds, or pod-installs required.

## Next Phase Readiness

**Ready for Wave 2 (Plan 06-03, 06-04):**
- `UserStatusBanner` (Plan 06-03) can reference `t.bannerTitleFeatureLimited` / `t.bannerTitleBlockedWithReview` / `t.bannerTitlePermanentlyBanned`, `t.appealCta`, `t.appealNoMail{Title,Body}`, `t.appealOk`, `t.appealPlaceholder`, `t.expandNote`, `t.collapseNote`, `t.reasonSpam` (from Phase 5), etc.
- `FeatureGateOverlay` (Plan 06-04) can reference the full 24-key gate matrix `t.gate{CreateListing,CreateOrder,ApplyProvider,ContactSeller}{FeatureLimited,Blocked,Banned}{Title,Body}` plus `t.restoreProfile`

**Blockers:** None for translation layer. Full end-to-end Phase 6 mobile UX verification remains blocked on backend Phase 5 plans 05-0a / 05-0b (per prior STATE.md notes; unchanged by this plan).

**Grep-stable invariants locked by this plan:**
- `grep -c "Phase 6 — Affected-User UX" src/constants/translations.ts` returns 2 (one banner per language)
- `grep -c "appealCopyEmail\|appealCopied\|appealCancel" src/constants/translations.ts` returns 0 (struck keys never present)
- `grep -c "bannerTitleFeatureLimited" src/constants/translations.ts` returns 2
- `grep -c "restoreProfile" src/constants/translations.ts` returns 2
- `grep -c "gateApplyProvider" src/constants/translations.ts` returns 12
- `grep -c "gateCreateListing" src/constants/translations.ts` returns 12
- `grep -c "gateCreateOrder" src/constants/translations.ts` returns 12
- `grep -c "gateContactSeller" src/constants/translations.ts` returns 12
- `npx jest __tests__/translation-parity.test.ts` exits 0 with 3/3 passed

## TDD Gate Compliance

This plan is `type: execute`, not `type: tdd`. QUAL-01 parity test from Plan 06-01 served as the live RED/GREEN guard: the test was GREEN on entry (459=459), GREEN on mid-state after Task 1 would have been RED (RU=494, EN=459, but the actual test only ran at end-of-Task-2 per the plan's verify step), and GREEN on exit (494=494). No `test(...)` commit required; `feat(...)` commits alone satisfy the acceptance criteria.

---
*Phase: 06-affected-user-ux-security-review*
*Completed: 2026-04-19*

## Self-Check: PASSED

- `.planning/phases/06-affected-user-ux-security-review/06-02-SUMMARY.md`: FOUND
- `src/constants/translations.ts`: FOUND
- Commit `6a44e34`: FOUND (Task 1 — RU additions)
- Commit `a2808c2`: FOUND (Task 2 — EN additions + parity test)
- QUAL-01 parity test: 3/3 passed (RU=EN=494)
