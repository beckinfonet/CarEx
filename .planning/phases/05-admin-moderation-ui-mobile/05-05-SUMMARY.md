---
phase: 05
plan: 05
subsystem: mobile/shared-ui-primitives
tags: [wave-2, presentational, moderation, severity-badge, empty-state, a11y]
requires:
  - phase-5-design-tokens
  - phase-5-ru-en-translation-keys
provides:
  - severity-badge-primitive
  - empty-state-primitive
affects:
  - src/components/moderation/SeverityBadge.tsx
  - src/components/moderation/EmptyState.tsx
tech-stack:
  added: []
  patterns:
    - "STATE_TO_PALETTE_KEY record maps the 4-state discriminated union to `COLORS.moderation` subkeys — single lookup point means adding a 5th state requires updating exactly one table (and the type union)"
    - "Label lookup via `(t as Record<string, string>)[labelKey]` with defensive `?? state` fallback — keeps translations.ts key union out of SeverityBadge's type signature while still preventing runtime crash if a key disappears"
    - "`lineHeight: SIZES.badgeHeight` on pill text — relies on line-box centering rather than flex alignItems alone; tested-safe pattern for short pill text cross-platform (iOS + Android render differently under pure flex)"
    - "`alignSelf: 'flex-start'` on the pill — prevents the badge from stretching to fill its parent, matching the existing inline `typeBadge` pattern at AdminDashboardScreen.tsx:163-175"
    - "`import type { LucideIcon }` on EmptyState — type-only; zero runtime cost, no accidental full-icon-registry import"
    - "EmptyState uses `flex: 1` so consumers drop it directly into `<FlatList ListEmptyComponent={…} />` without an extra wrapper View"
    - "JSX destructuring rename `icon: Icon` is required because React parses lowercase identifiers as host elements; kept the public prop name lowercase to match Lucide's convention"
key-files:
  created:
    - src/components/moderation/SeverityBadge.tsx
    - src/components/moderation/EmptyState.tsx
  modified: []
decisions:
  - "Label lookup uses `(t as Record<string, string>)[labelKey]` instead of enumerating all translation keys in the component's type signature — keeps SeverityBadge decoupled from the full TRANSLATIONS key union (which grows every phase) while still giving compile-time safety on the label-key table (STATE_TO_LABEL_KEY is strictly typed)"
  - "Fallback `?? state` renders the raw literal (`'active'` / `'feature_limited'` / etc.) if the expected key is missing — defensive per T-05-05-02; the type system prevents this inside our codebase but the cast opens a narrow runtime hole that a fallback closes"
  - "`alignSelf: 'flex-start'` on the pill container — without it, the pill stretches to fill its parent (default flex behavior in React Native), breaking the visual pill shape. Mirrors the pattern already proven in AdminDashboardScreen.tsx typeBadge"
  - "`lineHeight: SIZES.badgeHeight` on the pill text instead of relying on `justifyContent: 'center'` alone — iOS and Android flex vertical centering render slightly differently for short text; locking lineHeight to the container height gives pixel-stable output on both platforms"
  - "EmptyState caps `body` at `maxWidth: 280` — keeps two-line copy readable on standard phone widths (375-414pt); longer copy wraps to 3+ lines and pushes the icon+title off-screen on iPhone SE form factor"
  - "`size={40}` on the icon is literal-numeric per Lucide prop type (accepts number | string); not a theme token because Lucide's own docs treat this as a per-consumer sizing decision rather than a global scale — would be inconsistent to introduce `SIZES.emptyStateIconSize: 40` for a single call site (Plan 05-02 did not add it to the scale)"
metrics:
  duration: "~1m05s"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
---

# Phase 05 Plan 05: SeverityBadge + EmptyState Shared Primitives Summary

**One-liner:** Added two pure-presentational mobile primitives — `SeverityBadge` (state-aware colored pill with localized label, wired to `COLORS.moderation` palette + `stateFilter*` translations) and `EmptyState` (centered icon + heading + body stack) — each <65 lines, token-only, accessibility-wired, consumed by every Wave 3 screen and the Plan 05-06 interactive components.

## What Was Built

### Task 1 — SeverityBadge.tsx (commit `1ee0598`)

`src/components/moderation/SeverityBadge.tsx` (62 lines). Exports:

- `ModerationState` type: discriminated literal union `'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned'`
- `SeverityBadge: React.FC<{ state: ModerationState }>` — renders a small colored pill

**Visual shape:**
- Height: `SIZES.badgeHeight` (22px), `paddingHorizontal: SIZES.spacingSm` (8px), `borderRadius: SIZES.radiusPill` (999)
- Background: `COLORS.moderation[paletteKey].bg` (translucent tint)
- Border: 1px solid `COLORS.moderation[paletteKey].border`
- Text: `COLORS.moderation[paletteKey].fg` + `TYPOGRAPHY.bodyStrong` (14px/600) + `lineHeight: SIZES.badgeHeight` for cross-platform vertical centering
- `alignSelf: 'flex-start'` so the pill hugs content instead of stretching

**State → palette → label mapping** (two lookup tables, both strictly typed):

| ModerationState         | Palette subkey   | Translation key             |
|-------------------------|------------------|-----------------------------|
| `active`                | `active`         | `stateFilterActive`         |
| `feature_limited`       | `featureLimited` | `stateFilterFeatureLimited` |
| `blocked_with_review`   | `blockedReview`  | `stateFilterBlocked`        |
| `permanently_banned`    | `permaBanned`    | `stateFilterBanned`         |

**Accessibility:** `accessible` (merges children into one announcement) + `accessibilityRole="text"` + `accessibilityLabel={label}` — matches UI-SPEC §Accessibility row for SeverityBadge.

### Task 2 — EmptyState.tsx (commit `e282c1a`)

`src/components/moderation/EmptyState.tsx` (54 lines). Exports:

- `EmptyStateProps` interface: `{ icon: LucideIcon; title: string; body: string }`
- `EmptyState: React.FC<EmptyStateProps>` — centered icon + heading + body stack

**Layout (per UI-SPEC §Loading/Empty State Matrix):**
- Container: `flex: 1`, `alignItems: 'center'`, `justifyContent: 'center'`, `paddingVertical: SIZES.spacing2xl` (48px), `paddingHorizontal: SIZES.spacingLg` (24px)
- Icon: `size={40}`, `color={COLORS.textTertiary}` — rendered via caller-supplied LucideIcon component
- Title: `TYPOGRAPHY.heading` (20px/600), `color: COLORS.textPrimary`, `marginTop: SIZES.spacingMd` (16px), `textAlign: 'center'`
- Body: `TYPOGRAPHY.body` (14px/400), `color: COLORS.textSecondary`, `marginTop: SIZES.spacingSm` (8px), `textAlign: 'center'`, `maxWidth: 280`

**LucideIcon import is type-only** (`import type { LucideIcon }`) — no runtime cost, no risk of pulling the entire icon registry. JSX destructuring rename `icon: Icon` required because React parses lowercase identifiers as host elements.

**Consumers (documented in docblock, to be wired in Waves 3-4):**
1. AdminManagementScreen (no users matching filter)
2. AdminModerationScreen — initial blank (Search icon + "Start searching")
3. AdminModerationScreen — no matches (Search icon + "No matches")
4. AdminUserDetailScreen (no history yet)
5. Generic error fallback (inline list errors; Alert remains primary for non-list errors)

## Verification

- **Typecheck:** `npx tsc --noEmit 2>&1 | grep -E "src/components/moderation/(EmptyState|SeverityBadge).tsx" | wc -l` → 0 errors attributable to this plan. The 3 pre-existing `src/hooks/__tests__/useDebouncedValue.test.ts` parse errors remain from the Plan 05-01 scaffold (documented deferred — out of scope per scope boundary rule).
- **SeverityBadge acceptance checks (11/11):** `export const SeverityBadge`=1, `export type ModerationState`=1, `COLORS.moderation[`=1, `TYPOGRAPHY.bodyStrong`=1, `SIZES.badgeHeight`=2, `SIZES.radiusPill`=1, `accessibilityRole="text"`=1, `feature_limited`=3, `blocked_with_review`=3, `permanently_banned`=3, hardcoded-hex-not-via-COLORS=0
- **EmptyState acceptance checks (10/10):** `export const EmptyState`=1, `export interface EmptyStateProps`=1, `import type { LucideIcon }`=1, `TYPOGRAPHY.heading`=1, `TYPOGRAPHY.body`=1, `SIZES.spacing2xl`=1, `size={40}`=1, `maxWidth: 280`=1, `COLORS.textTertiary`=1, hardcoded-hex-not-via-COLORS=0
- **No accidental deletions:** `git diff --diff-filter=D HEAD~2 HEAD` shows no deletions across either commit
- **Test scaffolds compile-unblock:** Both `src/components/moderation/__tests__/SeverityBadge.test.tsx` and `EmptyState.test.tsx` import paths now resolve (modules exist); scaffolds remain at `test.todo` per Plan 05-01 contract — Plan 05-10 fills real assertions

## Deviations from Plan

None — the plan was executed exactly as written. Every line of the two files matches the plan's `<action>` blocks byte-for-byte.

## Commits

| Hash      | Message                                              | Files                                             |
|-----------|------------------------------------------------------|---------------------------------------------------|
| `1ee0598` | feat(05-05): add SeverityBadge presentational pill   | src/components/moderation/SeverityBadge.tsx       |
| `e282c1a` | feat(05-05): add EmptyState reusable centered primitive | src/components/moderation/EmptyState.tsx       |

## Downstream Consumers

- **Plan 05-06** (QuickActionSheet + ModerationActionModal + TypedConfirmationModal) — QuickActionSheet's capability preview may render SeverityBadge for the target user's current state; no EmptyState usage
- **Plan 05-07** (AdminModerationScreen) — consumes both: SeverityBadge in each search result row (UI-SPEC §UserRow tertiary line); EmptyState for initial blank prompt + no-match state (2 call sites)
- **Plan 05-08** (AdminUserDetailScreen) — consumes SeverityBadge in the sticky summary card + EmptyState for the empty history list
- **Plan 05-09** (repurpose AdminManagementScreen) — consumes SeverityBadge in each row; EmptyState for no-match state (1 call site)
- **Plan 05-10** (fill component tests) — fills the 4 `test.todo` entries in `SeverityBadge.test.tsx` and the 4 in `EmptyState.test.tsx` with real assertions (palette check, label text, icon sizing, a11y props)
- **Phase 6 UserStatusBanner** (future) — shares `COLORS.moderation.*` tokens but uses its own larger-format banner; does NOT consume SeverityBadge directly per 05-02 plan

## Known Stubs

None — these are pure presentational components. They render whatever state/icon/title/body the caller passes. No data sources to wire.

## Threat Flags

None — no new security-relevant surface (no endpoints, no auth paths, no file access, no schema). Threat register T-05-05-01 through T-05-05-03 all resolved inline:
- T-05-05-01 (SeverityBadge label leaks state): `accept` — badge is only rendered on admin-gated screens; non-admins never see it
- T-05-05-02 (caller passes invalid state via runtime cast): `mitigate` — `?? state` fallback renders the literal instead of crashing; type system prevents in-codebase abuse
- T-05-05-03 (EmptyState consumer passes user-controlled text): `accept` — consumers pass localized constants only; Plan 05-09 grep audit will verify zero `${userInput}` call sites

## Self-Check: PASSED

- `ls src/components/moderation/SeverityBadge.tsx src/components/moderation/EmptyState.tsx` — both FOUND
- `git log --oneline | grep -E "1ee0598|e282c1a"` — both commits FOUND
- `grep -c "export const SeverityBadge" src/components/moderation/SeverityBadge.tsx` → 1 FOUND
- `grep -c "export const EmptyState" src/components/moderation/EmptyState.tsx` → 1 FOUND
- `npx tsc --noEmit` — 0 new errors attributable to this plan; 3 pre-existing Plan 05-01 scaffold errors remain out of scope
