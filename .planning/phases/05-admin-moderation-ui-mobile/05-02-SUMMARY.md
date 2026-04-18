---
phase: 05
plan: 02
subsystem: mobile/design-tokens+i18n
tags: [wave-1, design-tokens, i18n, moderation, foundation]
requires:
  - phase-04-complete
  - wave-0-test-scaffolds
provides:
  - phase-5-design-tokens
  - phase-5-ru-en-translation-keys
  - dual-role-delete-labels
  - role-badge-palette
  - severity-badge-palette
affects:
  - src/constants/theme.ts
  - src/constants/translations.ts
tech-stack:
  added: []
  patterns:
    - "TYPOGRAPHY fontWeight values pinned with `as const` — required for React Native StyleSheet type compatibility (only the literal weight union is accepted)"
    - "Dual-key strategy for `adminUsers` collision — legacy key preserved verbatim (Profile menu), new `adminUsersTitle` key added for repurposed header (RESEARCH §Pitfall 8)"
    - "Strict RU/EN parity enforced by sorted key-set diff (455 keys each)"
    - "Interpolation tokens (`{email}`, `{count}`, `{list}`) kept as literal substrings — consumers use String.prototype.replace, no template eval path (T-05-02-01)"
key-files:
  created: []
  modified:
    - src/constants/theme.ts
    - src/constants/translations.ts
decisions:
  - "Phase 5 translation block appended at the END of each language object, not grouped near the existing `// Admin` block — appending preserves git-blame locality for old admin keys and makes the Phase 5 addition reviewable as one contiguous range"
  - "All 131 Phase 5 keys share a single banner comment per language (`// ---- Phase 5 — Admin Moderation UI (UI-SPEC §10) ----`) + sub-group comments matching the UI-SPEC §10 groupings, so future plans can grep for a keyword (e.g. `Severity names`) to land in the right zone without scanning 130 lines"
  - "COLORS.success preserved at its original `#22C55E` value; new COLORS.successFg (#4ADE80) added as a separate token aligned with COLORS.moderation.active.fg — spec-mandated (T-05-02-03 mitigation). Existing call sites of COLORS.success continue to resolve unchanged; new moderation code MUST use COLORS.successFg where tonal alignment with the active-severity badge matters"
  - "TYPOGRAPHY fontWeight values use `as const` (6 instances — one per variant) — without it TypeScript widens to `string`, which React Native StyleSheet rejects (expects the literal union `'normal' | 'bold' | '100' | ... | '900'`). The plan explicitly notes this; acceptance criterion locks the exact count"
metrics:
  duration: "~3m14s"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  commits: 2
---

# Phase 05 Plan 02: Theme Tokens + RU/EN Translation Keys Summary

**One-liner:** Extended `src/constants/theme.ts` with the full Phase 5 palette (COLORS.moderation + COLORS.role severity/role badges, 4 new top-level color tokens, expanded SIZES spacing+radius scale, new TYPOGRAPHY export) and added 131 RU+EN translation keys (×2 = 262 entries) to `src/constants/translations.ts` including the dual-role delete labels (`deleteBrokerProfile` / `deleteLogisticsProfile`) that lock D-04 from Wave 1 forward — no breaking changes to existing call sites.

## What Was Built

### Task 1 — theme.ts (commit `83c27cf`)

Replaced `src/constants/theme.ts` with the full Phase 5 token set. Every existing token preserved verbatim; additions grouped behind `// --- Phase 5 additions (UI-SPEC §11) ---` markers.

**COLORS additions:**
- `textTertiaryStrong: '#D1D5DB'` — stronger neutral for reason chips
- `successFg: '#4ADE80'` — aligned with `moderation.active.fg`; NEW companion to legacy `success: '#22C55E'`
- `destructive: '#EF4444'` — explicit token (was ad-hoc hex before)
- `warning: '#F59E0B'` — amber (superadmin, destructive warning modal headers)
- `moderation: { active, featureLimited, blockedReview, permaBanned }` — each nested key has `{ bg, fg, border }`; consumed by SeverityBadge (Plan 05-05) and Phase 6 UserStatusBanner
- `role: { admin, broker, seller, logistics }` — each with `{ bg, fg }`; consumed by role badge renderer

**SIZES additions:**
- Spacing scale: `spacingXs/Sm/Md/Lg/Xl/2xl` (4/8/16/24/32/48). `spacingMd` is alias for legacy `padding: 16`
- Radius scale: `radiusSm/Md/Pill` (8/12/999). `radiusMd` is alias for legacy `borderRadius: 12`
- Interaction: `minTapTarget: 44` (Apple HIG / Material minimum touch zone)
- Badge: `badgeHeight: 22`, `chipHeight: 32`
- Bottom sheet handle: `bottomSheetHandleWidth: 36`, `bottomSheetHandleHeight: 4`

**TYPOGRAPHY (new named export):** `body`, `bodyStrong`, `label`, `labelStrong`, `heading`, `display` — each with `{ fontSize, fontWeight: '...' as const, lineHeight }`. The `as const` pin is load-bearing (React Native StyleSheet rejects `string` for fontWeight).

### Task 2 — translations.ts (commit `8c14b5d`)

Appended 131 keys to each of the RU and EN objects (262 entries total), each preceded by a banner comment and sub-group comments matching UI-SPEC §10.

**Groups added (per language):**

| Group | Key count |
|---|---|
| Screen titles + headers | 3 (adminUsersTitle, adminModerationTitle, adminUserDetailTitle) |
| Filter chips — AdminManagementScreen | 2 |
| Filter chips — Role group | 6 |
| Filter chips — State group | 5 |
| Severity names + descriptions | 6 (3 names + 3 descriptions for SeverityPicker) |
| Reason categories | 4 (reasonSpam/PolicyViolation/Fraud/Other) |
| Action names | 5 (actionSuspend/Unsuspend/RevokeRole/DeleteProfile/EditProfile) |
| **Dual-role delete labels** | **2 (deleteBrokerProfile, deleteLogisticsProfile)** |
| Form field labels | 11 |
| Primary CTAs (modal-specific) | 8 |
| Typed-confirmation copy | 8 |
| Empty states | 9 |
| Error mappings (1 per ModerationError.code) | 13 |
| Success toasts | 5 |
| Sticky summary card copy | 4 |
| Capability preview | 7 |
| **Total per language** | **131** |

**`adminUsers` collision resolution (RESEARCH §Pitfall 8):** The pre-existing `adminUsers: 'Администраторы' / 'Administrators'` key (used by the Profile menu) was NOT renamed or removed. The repurposed AdminManagementScreen header uses the NEW `adminUsersTitle: 'Пользователи' / 'Users'` key. Both keys coexist; downstream plans (05-09 repurpose) must import the intended one.

**Dual-role delete contract (D-04 + RESEARCH §Pitfall 11):** Both `deleteBrokerProfile` and `deleteLogisticsProfile` exist in BOTH RU and EN with explicit role names in the label. QuickActionSheet (Plan 05-06) renders them as two separate rows when a target user has BOTH broker AND logistics profiles APPROVED, so the admin's tap unambiguously selects the role payload — no silent broker default.

**Interpolation tokens:** `{email}`, `{count}`, `{list}` are literal substrings in value strings. Consumers replace at render time via `string.replace('{email}', value)` — no template eval path (T-05-02-01 mitigation).

## Verification

- **Token back-compat (theme.ts):** All 4 legacy-value grep checks pass — `background: '#0F1115'`, `success: '#22C55E'`, `padding: 16`, `borderRadius: 12` each appear exactly once
- **Token additions (theme.ts):** All 17 new-token grep checks pass — `moderation:`, `featureLimited:`, `blockedReview:`, `permaBanned:`, `role:`, `destructive:`, `warning:`, `successFg:`, `textTertiaryStrong:`, `spacingXs:`, `spacing2xl: 48`, `radiusPill: 999`, `minTapTarget: 44`, `bottomSheetHandleWidth: 36`, `export const TYPOGRAPHY`, `labelStrong:`, `as const` (6×)
- **Translation additions (translations.ts):** All 28 plan acceptance-criterion grep checks pass (count=2 per key, i.e. RU+EN present). Legacy `adminUsers` preserved at count=2
- **Banner marker:** `Phase 5 — Admin Moderation UI` appears 2× (once per language block)
- **Strict RU/EN parity:** Node script extracted top-level key sets (regex `^ {4}([a-zA-Z][a-zA-Z0-9]*):` per block) — RU=455, EN=455, zero keys in one that aren't in the other
- **Typecheck:** `npx tsc --noEmit | grep "src/constants/theme.ts" | wc -l` returns 0; same for translations.ts. 3 pre-existing errors in `src/hooks/__tests__/useDebouncedValue.test.ts` remain (Plan 05-01 scaffold — documented in 05-01-SUMMARY decisions; out of scope per scope boundary rule)
- **No accidental deletions:** `git diff --diff-filter=D HEAD~2 HEAD` shows no deletions across either commit

## Deviations from Plan

None — the plan was executed exactly as written. Every key/value pair, every token value, and every ordering matches the plan's `<action>` blocks verbatim.

## Commits

| Hash | Message | Files |
|------|---------|-------|
| `83c27cf` | feat(05-02): extend theme.ts with Phase 5 moderation tokens | 1 |
| `8c14b5d` | feat(05-02): add Phase 5 admin moderation RU+EN translation keys | 1 |

## Downstream Consumers

- **Plan 05-03** (ModerationService.searchUsers + getHistory) — does not consume tokens/translations directly
- **Plan 05-04** (moderationErrorKeyMap util) — maps `ModerationError.code` → translation key names from this plan's `err*` set (13 keys), plus uses `formatYmdHm` with no translation dependency
- **Plan 05-05** (SeverityBadge + EmptyState) — consumes `COLORS.moderation.*` verbatim + `TYPOGRAPHY.bodyStrong` for badge label + `empty*` translation keys for EmptyState
- **Plan 05-06** (QuickActionSheet + ModerationActionModal + TypedConfirmationModal) — consumes `action*`, `deleteBrokerProfile`, `deleteLogisticsProfile`, `severity*`, `reason*`, `field*`, `confirm*`, `modalConfirm`, `modalCancel`, `typedConfirm*`, `capability*` keys + new SIZES (minTapTarget, bottomSheetHandle*, radiusSm) + COLORS.destructive/warning for typed-confirmation warning heading
- **Plan 05-07** (AdminModerationScreen) — consumes `adminModerationTitle`, `roleFilter*`, `stateFilter*`, `searchPrompt*`, `emptySearch*`, `searchEmailOrUid`, `summary*` keys + COLORS.role.* for inline role badges
- **Plan 05-08** (AdminUserDetailScreen) — consumes `adminUserDetailTitle`, `summary*`, `emptyHistory*`, `memberSince` (legacy), `unsuspendUser`, `confirmUnsuspend` keys
- **Plan 05-09** (repurpose AdminManagementScreen) — consumes `adminUsersTitle` (NOT legacy `adminUsers`), `filterAdminsOnly`, `filterAllUsers` + all action/severity keys shared with 05-06
- **Phase 6 UserStatusBanner** (future) — consumes `COLORS.moderation.*` verbatim per plan key-link

## Known Stubs

None — this plan produces design tokens + translation string resources only. No UI-visible code paths were added.

## Threat Flags

None — no new security-relevant surface (no endpoints, no auth paths, no file access, no schema changes). The plan's threat register anticipates this; T-05-02-01/02/03/04 all resolved inline via the preservation/naming choices above.

## Self-Check: PASSED

- `ls -la src/constants/theme.ts src/constants/translations.ts` — both FOUND
- `git log --oneline | grep -E "83c27cf|8c14b5d"` — both commits FOUND
- `grep -c "export const TYPOGRAPHY" src/constants/theme.ts` → 1 FOUND
- `grep -c "deleteBrokerProfile:" src/constants/translations.ts` → 2 FOUND
- `grep -c "deleteLogisticsProfile:" src/constants/translations.ts` → 2 FOUND
- `grep -c "adminUsers:" src/constants/translations.ts` → 2 FOUND (legacy preserved)
- `grep -c "adminUsersTitle:" src/constants/translations.ts` → 2 FOUND (new key)
- Node script confirms 455 RU keys = 455 EN keys with zero parity mismatches
