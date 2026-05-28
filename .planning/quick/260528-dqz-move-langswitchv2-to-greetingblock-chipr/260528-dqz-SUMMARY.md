---
phase: 260528-dqz-move-langswitchv2-to-greetingblock-chipr
plan: 01
subsystem: home-v2
tags: [ui, home-v2, lang-switch, layout]
requires: []
provides:
  - "GreetingBlock optional `trailing` slot in chipRow"
  - "FloatingSearchPill reverted to single-child wrapper shape (pre-dj9)"
affects:
  - "src/components/home/v2/FloatingSearchPill.tsx"
  - "src/components/home/v2/GreetingBlock.tsx"
  - "src/screens/HomeScreenV2.tsx"
tech-stack:
  added: []
  patterns:
    - "Optional React.ReactNode `trailing` prop as right-aligned chipRow sibling"
key-files:
  created: []
  modified:
    - "src/components/home/v2/FloatingSearchPill.tsx"
    - "src/components/home/v2/GreetingBlock.tsx"
    - "src/screens/HomeScreenV2.tsx"
decisions:
  - "LangSwitchV2 moves from FloatingSearchPill trailing slot → GreetingBlock chipRow trailing slot to match pill heights (listings chip ~28px vs pill 48px caused visual imbalance)"
metrics:
  duration: "~4 min"
  completed: "2026-05-28T16:58:15Z"
  commit: "d047081"
---

# Phase 260528-dqz Plan 01: Move LangSwitchV2 to GreetingBlock chipRow Summary

Move the RU/EN language switch from FloatingSearchPill's trailing slot to GreetingBlock's chip row so it sits next to the listings count chip, fixing the height mismatch surfaced in 260528-dj9 UAT.

## One-liner

LangSwitchV2 is now a right-aligned sibling of the "50 объявлений" chip inside GreetingBlock's chipRow; FloatingSearchPill is reverted to its pre-260528-dj9 single-child shape.

## Diffs Applied

1. **`src/components/home/v2/FloatingSearchPill.tsx`** — Removed `trailing?: React.ReactNode` from props/destructure, dropped `{trailing}` from JSX, stripped `flexDirection/alignItems/gap` from `styles.wrapper` and `flex: 1` from `styles.pill`. Wrapper now exactly `{ paddingHorizontal: 18, paddingTop: 12 }`.
2. **`src/components/home/v2/GreetingBlock.tsx`** — Added optional `trailing?: React.ReactNode` prop (with JSDoc), destructured it, rendered `{trailing}` as sibling of the chip View inside `chipRow`, and added `alignItems: 'center', justifyContent: 'space-between'` to `styles.chipRow`.
3. **`src/screens/HomeScreenV2.tsx`** — Removed `trailing={...}` from `<FloatingSearchPill>` and added the same `trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}` to `<GreetingBlock>`. The `LangSwitchV2` import (line 23) and `language`/`setLanguage` destructure (line 41) are unchanged.

## Verification Results

All four grep gates pass:

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| `FloatingSearchPill.tsx` "trailing" count | 0 | 0 | PASS |
| `GreetingBlock.tsx` "trailing" count | >=3 | 3 | PASS |
| `HomeScreenV2.tsx` "trailing" count | 1 | 1 | PASS |
| `HomeScreenV2.tsx` "LangSwitchV2" count | 2 | 2 | PASS |

Jest:
```
PASS src/components/home/v2/__tests__/GreetingBlock.test.tsx
PASS src/components/home/v2/__tests__/FloatingSearchPill.test.tsx

Test Suites: 2 passed, 2 total
Tests:       2 passed, 2 total
```

ESLint: 0 errors on all three files (2 pre-existing warnings on `HomeScreenV2.tsx:158` — `react/no-unstable-nested-components` and `react-native/no-inline-styles` — are unrelated to this change and exist on the inline `ItemSeparatorComponent` lambda).

TypeScript: `npx tsc --noEmit` reports no errors mentioning any of the three target files.

## Deviations from Plan

None — plan executed exactly as written.

## Commit

- `d047081` — feat(260528-dqz-01): move LangSwitchV2 to GreetingBlock chip row (3 files, +7/-10)

## Follow-up

This completes the toggle-placement UAT follow-up from 260528-dj9. Manual UAT (visual) still required to confirm:
- FloatingSearchPill again spans the full row at the top.
- The chip row inside the greeting block shows the listings chip on the left and LangSwitchV2 on the right at similar pill heights.
- Tapping the toggle still switches RU/EN and re-renders the greeting copy.
- v1 HomeScreen (with v2 toggle off) is untouched.

## Self-Check: PASSED

- FOUND: src/components/home/v2/FloatingSearchPill.tsx (modified)
- FOUND: src/components/home/v2/GreetingBlock.tsx (modified)
- FOUND: src/screens/HomeScreenV2.tsx (modified)
- FOUND: commit d047081 in git log
