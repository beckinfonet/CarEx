---
phase: 260528-cr4
plan: 01
subsystem: home-screen-v2
tags: [home-v2, bottom-bar, ux-fix, dock-swap]
dependency_graph:
  requires:
    - src/components/BottomBar.tsx (adopted as-is, not modified)
    - src/components/MoreMenu.tsx (managed internally by BottomBar)
  provides:
    - HomeScreenV2 renders v1 BottomBar with working MoreMenu popup
  affects:
    - HomeScreenV2 UAT (homescreen-v2 toggle flow)
tech_stack:
  added: []
  patterns:
    - Component swap (minimal diff: import + JSX, drop now-unused handler)
key_files:
  created: []
  modified:
    - src/screens/HomeScreenV2.tsx
decisions:
  - Adopt v1 BottomBar verbatim in HomeScreenV2 instead of iterating on EditorialDock
  - Leave EditorialDock.tsx in tree as dead code; may revisit v2 dock design later
  - Accept minor color seam between V2.bg content and v1 COLORS.background dock (user-approved)
  - Leave `const { user } = useAuth();` destructure in place despite lint warning, per plan instruction to keep diff minimal
metrics:
  duration_minutes: ~3
  completed: 2026-05-28
  commits: 1
  files_changed: 1
  net_lines: -9
requirements_completed:
  - CR4-01
---

# Phase 260528-cr4 Plan 01: Swap EditorialDock for v1 BottomBar in HomeScreenV2 Summary

Replaced the v2 EditorialDock with the v1 BottomBar in `src/screens/HomeScreenV2.tsx` verbatim (named import + `<BottomBar t={t} />`), removed the now-redundant `handleMorePress` handler, and kept everything else (state, effects, hero/shelf/feed, FilterModal, BackHandler) unchanged — unblocking the v2 home toggle UAT after the FAB-alignment fix in 260528-cfe failed visual review.

## Edits Applied

| # | Location (post-edit)     | Change                                                                                                                                                              |
| - | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | line 22 (import block)   | `import { EditorialDock } from '../components/home/v2/EditorialDock';` → `import { BottomBar } from '../components/BottomBar';`                                     |
| 2 | line 93 (handler block)  | Deleted 4-line `handleMorePress` arrow function (`if (user) navigation.navigate('Profile'); else navigation.navigate('Login');`)                                    |
| 3 | line 167 (render tree)   | 6-line `<EditorialDock homeLabel={...} sellLabel={...} moreLabel={...} onMorePress={handleMorePress} />` collapsed to single line `<BottomBar t={t} />`             |

Net diff: −11 / +2 = −9 lines, matching the plan's predicted shape exactly.

## Acceptance Verification

```
grep -c "BottomBar"       src/screens/HomeScreenV2.tsx → 2 (expected 2)  PASS
grep -c "EditorialDock"   src/screens/HomeScreenV2.tsx → 0 (expected 0)  PASS
grep -c "handleMorePress" src/screens/HomeScreenV2.tsx → 0 (expected 0)  PASS
```

- `npx tsc --noEmit` produces **no HomeScreenV2-attributable errors**.
- `git diff --stat` shows only `src/screens/HomeScreenV2.tsx` modified (1 file changed, 2 insertions, 11 deletions).

## Files Confirmed NOT Modified (out of scope)

| File                                       | Status        |
| ------------------------------------------ | ------------- |
| `src/components/home/v2/EditorialDock.tsx` | unmodified (dead code, intentionally retained) |
| `src/components/BottomBar.tsx`             | unmodified (adopted as-is)                     |
| `src/components/MoreMenu.tsx`              | unmodified (used by BottomBar internally)      |
| `src/screens/HomeScreen.tsx` (v1 reference)| unmodified                                     |

## Lint / Type Findings

**One in-scope ESLint error left in place per plan instruction:**

- `src/screens/HomeScreenV2.tsx:42:11` — `'user' is assigned a value but never used` (`@typescript-eslint/no-unused-vars`).
  - The `const { user } = useAuth();` destructure is now unused because `handleMorePress` (its only consumer) was removed.
  - The plan's `<interfaces>` block (lines 84) explicitly instructs: *"leave the destructure as-is; an unused local is a lint warning, not a blocker, and the user wants the diff minimal."*
  - **Decision: left as-is.** Will be cleaned up in a future plan that revisits HomeScreenV2 if the user destructure is still unused at that point.

**Two pre-existing warnings unchanged (out of scope — predate this task):**

- `src/screens/HomeScreenV2.tsx:158:33` — `react/no-unstable-nested-components` on `ItemSeparatorComponent={() => <View style={{ height: 11 }} />}`.
- `src/screens/HomeScreenV2.tsx:158:52` — `react-native/no-inline-styles` on the same line.

Neither was introduced by this task; both relate to the `FlatList`'s `ItemSeparatorComponent` which was not touched. Per the executor scope boundary, pre-existing warnings in unrelated lines are not fixed here.

## Deviations from Plan

None — plan executed exactly as written. The three edits landed in the exact order, locations, and shape described in `<tasks>` Task 1 `<action>`.

## Commits

- `bc7c80e` — `feat(260528-cr4): swap EditorialDock for v1 BottomBar in HomeScreenV2`

## Next Step

Hand off to UAT against the `feat/homescreen-v2-toggle` branch:

1. Build and launch the app with the v2 toggle ON in Settings → Внешний вид.
2. Confirm the bottom bar renders with the v1 layout (rounded buttons, blue accent border, Home / Продать / Ещё labels).
3. Tap "Ещё" → expect the MoreMenu popup (v1 sliding modal), not a navigation jump to Profile/Login.
4. Tap "Главная" → expect Home to refresh with filters cleared.
5. Tap the center "+" button → expect navigation to SellCar.
6. Confirm refresh-to-reload still works on the v2 feed and that BackHandler still unwinds filters on Android.

If UAT passes, the v2 toggle branch is ready for merge consideration (still gated by the broader homescreen-v2 continuation work tracked in `.planning/` memory).

## Self-Check: PASSED

- File `src/screens/HomeScreenV2.tsx` exists and contains the expected post-edit shape.
- Commit `bc7c80e` exists on `worktree-agent-a590536cd40e46d18`.
- All three acceptance grep counts pass.
- TypeScript reports no HomeScreenV2 errors.
- No out-of-scope files modified.
