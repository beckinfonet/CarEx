---
phase: 260528-d9a-re-add-ru-en-language-toggle-to-v2-home-
plan: 01
subsystem: home-v2
tags: [home-v2, i18n, ux-parity, design-tokens]
dependency_graph:
  requires:
    - src/components/home/v2/theme.ts
    - src/context/LanguageContext.tsx
  provides:
    - LangSwitchV2 component (V2-token-styled RU|EN switch)
  affects:
    - src/screens/HomeScreenV2.tsx (Header layout — adds top-right pill)
tech_stack:
  added: []
  patterns:
    - V2-token-only styling for v2 tree (no V1 COLORS leak)
    - Single hex literal '#04101f' permitted with FloatingSearchPill precedent
key_files:
  created:
    - src/components/home/v2/LangSwitchV2.tsx
  modified:
    - src/screens/HomeScreenV2.tsx
decisions:
  - "Kept active-text color as the literal '#04101f' (same dark navy used by FloatingSearchPill icon on V2.blue chrome) rather than adding a new token; keeps V2 token surface minimal and parity-aligned with existing precedent."
  - "Wrapped the LangSwitchV2 in a `<View style={{ alignItems: 'flex-end', paddingTop: 8 }}>` inside the Header fragment so the pill anchors top-right above GreetingBlock — matches v1 visual placement without restructuring the v2 Header into a flex row."
  - "Did NOT add useTypography to the new component — v1 langSwitch is system bold; matches design parity per plan §<action>."
metrics:
  duration_seconds: 76
  files_created: 1
  files_modified: 1
  tasks_completed: 1
  completed_date: 2026-05-28
---

# Quick 260528-d9a Plan 01: Re-add RU|EN Language Toggle to v2 Home Summary

V2-tokenized RU|EN pill toggle re-mounted as first child of HomeScreenV2's Header (top-right above GreetingBlock), via new co-located `LangSwitchV2` component — no V1 COLORS leak into the v2 tree.

## What Changed

### Created

**`src/components/home/v2/LangSwitchV2.tsx`** (55 LOC, lines 1–55, new file)
- Named export `LangSwitchV2` (React.FC<LangSwitchV2Props>).
- Props: `{ language: 'RU' | 'EN'; setLanguage: (lang: 'RU' | 'EN') => void }`.
- Renders `TouchableOpacity` (activeOpacity 0.85) wrapping `RU` / divider / `EN` Texts.
- Tap toggles `language === 'RU' ? 'EN' : 'RU'` (same shape as v1 HomeScreen langSwitch).
- Local `StyleSheet.create` with four keys — `langSwitch`, `langText`, `activeLang`, `divider` — all sourced from `V2.surface`, `V2.border`, `V2.textMuted`, `V2.blue`. The only literal hex is `'#04101f'` (active-text on V2.blue chrome).
- Imports: `React`, `react-native` primitives, and `./theme` (V2). No `COLORS`, no `useTypography`.

### Modified

**`src/screens/HomeScreenV2.tsx`** (+5 / −1 lines)
- Line 23: Added `import { LangSwitchV2 } from '../components/home/v2/LangSwitchV2';` after the FilterModal import.
- Line 41: Changed `const { t } = useLanguage();` → `const { t, language, setLanguage } = useLanguage();`.
- Lines 95–97: Inserted as the FIRST child of the `Header` JSX fragment, before `<GreetingBlock>`:
  ```tsx
  <View style={{ alignItems: 'flex-end', paddingTop: 8 }}>
    <LangSwitchV2 language={language} setLanguage={setLanguage} />
  </View>
  ```
- Nothing else touched. No style additions to the local `styles` object (uses inline `{ alignItems: 'flex-end', paddingTop: 8 }` on the wrapper — same warning class as the pre-existing inline `{ height: 11 }` on the separator).

### Untouched (confirmed)

- `src/screens/HomeScreen.tsx` — byte-identical (v1 path intact).
- `src/components/home/v2/FloatingSearchPill.tsx` — byte-identical.
- `src/components/home/v2/theme.ts` — byte-identical.
- `src/context/LanguageContext.tsx` — byte-identical.

`git diff --stat` against base shows exactly two paths.

## Note on the `'#04101f'` Literal

The new component's `activeLang.color` is set to the literal `'#04101f'`. This is intentional and is **not** a token leak. It mirrors the same dark navy already in production at `src/components/home/v2/FloatingSearchPill.tsx:25`, where the filters-button icon sits on `V2.blue` chrome. Both places represent "dark glyph on V2.blue button" — the same visual contract. No V2 token is added for it (keeps the V2 surface minimal); future readers can verify the shared precedent by greping `'#04101f'` across the v2 tree.

## Verification Results

### Acceptance greps (all passed)

| Check                                                | Expected | Actual |
| ---------------------------------------------------- | -------- | ------ |
| `grep -c "LangSwitchV2" src/screens/HomeScreenV2.tsx` | 2        | 2      |
| `grep -c "setLanguage" src/screens/HomeScreenV2.tsx`  | 2        | 2      |
| `grep -c "COLORS" src/components/home/v2/LangSwitchV2.tsx` | 0    | 0      |
| `grep -q "V2.surface"`                               | present  | OK     |
| `grep -q "V2.blue"`                                  | present  | OK     |
| `grep -q "'#04101f'"`                                | present  | OK     |

### ESLint (`npx eslint src/screens/HomeScreenV2.tsx src/components/home/v2/LangSwitchV2.tsx`)

- **0 errors**, 3 warnings (all pre-existing class):
  - `HomeScreenV2.tsx:95:20` `react-native/no-inline-styles` — the `{ alignItems: 'flex-end', paddingTop: 8 }` wrapper around `LangSwitchV2`. Same warning class as the pre-existing `{ height: 11 }` separator on line 160. Out of scope to refactor.
  - `HomeScreenV2.tsx:160:33` `react/no-unstable-nested-components` (pre-existing, not introduced by this task).
  - `HomeScreenV2.tsx:160:52` `react-native/no-inline-styles` (pre-existing, not introduced by this task).
- `LangSwitchV2.tsx` — 0 warnings, 0 errors.

### TypeScript (`npx tsc --noEmit`)

- **0 errors in either touched file** (filtered via `grep -E "HomeScreenV2|LangSwitchV2"`; same filter the plan uses in its `<verify>` block).
- Pre-existing TS errors elsewhere (`__tests__/*`, `src/context/__tests__/*`, `src/services/AuthService.ts`, etc.) are unrelated to this task and out of scope per the scope-boundary rule. They existed at base commit `417f104` before any edits.

## Deviations from Plan

None — plan executed exactly as written.

## Manual Smoke (deferred to user per plan)

- Launch app on iOS sim (`npm run ios`).
- Settings → Внешний вид → toggle to v2.
- Open Home; confirm RU|EN pill appears top-right above GreetingBlock greeting line.
- Tap pill; greeting and `listingsCount` labels swap RU↔EN immediately.
- Confirm pill chrome matches v2 dark surface (V2.surface `#13151B`) — not v1 cardBackground — and active token highlights `V2.blue` with the dark `'#04101f'` text.

## Self-Check: PASSED

- File `src/components/home/v2/LangSwitchV2.tsx` exists — FOUND.
- File `src/screens/HomeScreenV2.tsx` exists — FOUND (modified).
- Commit `555cb40` exists in `git log --all --oneline` — FOUND.
