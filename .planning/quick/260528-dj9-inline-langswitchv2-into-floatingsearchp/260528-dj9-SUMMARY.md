---
phase: 260528-dj9-inline-langswitchv2-into-floatingsearchp
plan: 01
subsystem: home/v2
tags: [home-v2, floating-search-pill, lang-switch, layout, refactor]
requires: []
provides:
  - "FloatingSearchPill with optional `trailing` slot"
  - "HomeScreenV2 with LangSwitchV2 inlined into the search pill row"
affects:
  - src/components/home/v2/FloatingSearchPill.tsx
  - src/screens/HomeScreenV2.tsx
tech-stack-added: []
patterns:
  - "Optional `trailing?: React.ReactNode` slot pattern for row-flex sibling composition"
key-files-created: []
key-files-modified:
  - src/components/home/v2/FloatingSearchPill.tsx
  - src/screens/HomeScreenV2.tsx
decisions:
  - "Compose LangSwitchV2 as a row-flex sibling of the pill (not a child) so the pill keeps its internal layout untouched and the existing test passes unchanged."
  - "Give the pill `flex: 1` so it absorbs remaining horizontal space; the trailing node sits to its right without overlapping."
  - "Leave LangSwitchV2's internal `alignSelf: 'flex-end'` as-is — harmless inside a row-flex parent, and editing LangSwitchV2 is out of scope per plan constraints."
metrics:
  duration: "1m 23s"
  completed: "2026-05-28"
  tasks_completed: 1
  files_modified: 2
commits:
  - hash: 8486f4c
    type: feat
    message: "feat(260528-dj9-01): inline LangSwitchV2 into FloatingSearchPill via trailing prop"
requirements:
  - QUICK-DJ9
---

# Phase 260528-dj9 Plan 01: Inline LangSwitchV2 into FloatingSearchPill Summary

Restored HomeScreenV2 vertical layout density by inlining LangSwitchV2 into FloatingSearchPill through a new optional `trailing` prop — the language toggle now rides the same horizontal row as the search pill, eliminating the extra row that 260528-d9a had added above GreetingBlock.

## Edits Made

### Edit 1 — `src/components/home/v2/FloatingSearchPill.tsx`

1. **Props interface**: added `trailing?: React.ReactNode` to `FloatingSearchPillProps`.
2. **Component destructure**: added `trailing` to the props destructure on the component signature.
3. **JSX**: rendered `{trailing}` as a sibling of the pill `TouchableOpacity` (after it, before the closing wrapper `View`). The pill's internal children — `Search` icon, placeholder `Text`, and the `filtersButton` `TouchableOpacity` — are byte-identical to the prior version.
4. **`wrapper` style**: added `flexDirection: 'row'`, `alignItems: 'center'`, and `gap: 10` while preserving `paddingHorizontal: 18` and `paddingTop: 12`.
5. **`pill` style**: added `flex: 1` so the pill absorbs remaining horizontal space when a trailing node is present. All other pill style fields (`height: 48`, paddings, background, border, radius, gap) are unchanged.

When `trailing` is omitted (as in the existing test), the wrapper still renders exactly one pill `TouchableOpacity` with one nested `filtersButton` `TouchableOpacity`, so `touchables[0]`/`touchables[1]` continue to map to the pill/filter handlers — no test changes required.

### Edit 2 — `src/screens/HomeScreenV2.tsx`

1. **Removed** the three-line wrapper at the top of the `Header` fragment:

   ```tsx
   <View style={{ alignItems: 'flex-end', paddingTop: 8 }}>
     <LangSwitchV2 language={language} setLanguage={setLanguage} />
   </View>
   ```

   The `Header` fragment now starts directly with `<GreetingBlock ... />`.

2. **Added** `trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}` to the `FloatingSearchPill` call site at the top of the `SafeAreaView`.

3. The `LangSwitchV2` import (line 23) and the `useLanguage()` destructure (line 41) are unchanged — `language` and `setLanguage` now flow into the `trailing` JSX.

## Verification Results

### Grep gate (from plan `<verify>`)

```
pill_trailing=3   (>= 3 required)   PASS
home_trailing=1   (>= 1 required)   PASS
home_langswitch=2 (== 2 required)   PASS
old_row=0         (== 0 required)   PASS
```

### Jest

```
$ npx jest --testPathPattern FloatingSearchPill --no-watch
PASS src/components/home/v2/__tests__/FloatingSearchPill.test.tsx
  FloatingSearchPill
    ✓ renders placeholder and calls handlers (950 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

The existing test passes without modification, confirming the `trailing` slot is purely additive — omitting it preserves the prior render shape (one pill `TouchableOpacity`, one nested `filtersButton`).

### ESLint

```
$ npx eslint src/components/home/v2/FloatingSearchPill.tsx src/screens/HomeScreenV2.tsx
0 errors, 2 warnings
```

Both warnings are **pre-existing** on `src/screens/HomeScreenV2.tsx:158` (the `FlatList` `renderItem` arrow inline component + `{ height: 11 }` separator inline style) — they live on lines this plan did not touch and are out of scope under the SCOPE BOUNDARY (only auto-fix issues directly caused by the current task's changes).

### TypeScript (filtered)

```
$ npx tsc --noEmit 2>&1 | grep -E "FloatingSearchPill|HomeScreenV2"
(no output)
```

No `FloatingSearchPill` or `HomeScreenV2` errors reported by `tsc --noEmit`.

## Layout Outcome

LangSwitchV2 is now **visually inline** with the search pill — it sits to the right of the filter button on the same horizontal row, with the row-flex wrapper providing `gap: 10` between the pill and the toggle. **No new vertical row** appears above `GreetingBlock`; the prior 260528-d9a `paddingTop: 8` row is gone and `GreetingBlock` resumes its pre-d9a vertical position.

## Deviations from Plan

None — plan executed exactly as written. Both edits applied verbatim, all four grep counts hit their required thresholds on the first run, the existing FloatingSearchPill test stayed green without modification, and ESLint/tsc reported no errors on the modified files.

## Commits

| Hash    | Type | Message                                                                       |
| ------- | ---- | ----------------------------------------------------------------------------- |
| 8486f4c | feat | feat(260528-dj9-01): inline LangSwitchV2 into FloatingSearchPill via trailing prop |

## Self-Check: PASSED

- `src/components/home/v2/FloatingSearchPill.tsx` — modified, contains `trailing?: React.ReactNode`, row-flex wrapper, and `flex: 1` pill (verified via grep gate counts 3/1/2/0).
- `src/screens/HomeScreenV2.tsx` — modified, no longer contains `alignItems: 'flex-end', paddingTop: 8`, passes `trailing={<LangSwitchV2 ...` to `FloatingSearchPill` (verified via grep gate).
- Commit `8486f4c` exists in `git log --oneline` on `worktree-agent-a85a0719aecf442dd`.
- Only the two target files modified — `git status --short` after commit shows clean tree.
