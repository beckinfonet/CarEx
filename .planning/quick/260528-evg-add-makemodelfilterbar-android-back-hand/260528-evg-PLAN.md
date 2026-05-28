---
phase: quick-260528-evg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/SearchResultsV2.tsx
autonomous: true
requirements:
  - QUICK-SRV2-MMFB
  - QUICK-SRV2-ANDBACK

must_haves:
  truths:
    - "User on SearchResultsV2 sees a dropdown make/model picker (no typing) below the sticky header and above the market stats strip"
    - "Selecting a make/model from the picker filters the visible results"
    - "Pressing Android hardware back button on SearchResultsV2 returns to the previous screen (HomeScreenV2)"
    - "Existing chevron-back button in the sticky header still works (regression check)"
  artifacts:
    - path: "src/screens/SearchResultsV2.tsx"
      provides: "SearchResultsV2 screen with MakeModelFilterBar integration and Android BackHandler"
      contains: "MakeModelFilterBar"
  key_links:
    - from: "src/screens/SearchResultsV2.tsx"
      to: "src/components/MakeModelFilterBar.tsx"
      via: "import + JSX render with selectedMake/selectedModel/onSelect props"
      pattern: "MakeModelFilterBar"
    - from: "src/screens/SearchResultsV2.tsx"
      to: "src/hooks/useHomeListings.ts"
      via: "destructure selectedMake/setSelectedMake/selectedModel/setSelectedModel from useHomeListings()"
      pattern: "setSelectedMake"
    - from: "src/screens/SearchResultsV2.tsx"
      to: "react-native BackHandler API"
      via: "useEffect adds hardwareBackPress listener, calls navigation.goBack(), returns true"
      pattern: "hardwareBackPress"
---

<objective>
Wire v1's `MakeModelFilterBar` (dropdown picker — no typing) into `SearchResultsV2`, and add an Android hardware back-button handler that calls `navigation.goBack()`. Per user UAT decision: keep `SearchResultsV2` as a dedicated page (future paid content + refined search live here), but it needs the same make/model picker v1 home uses, plus correct Android back behavior. The existing chevron-back button in the sticky header must be preserved.

Purpose: Restore parity with v1's picker UX on v2's dedicated results page, and fix Android hardware back navigation.
Output: Modified `src/screens/SearchResultsV2.tsx` with three additive changes — picker import, hook destructure expansion + back-handler `useEffect`, picker JSX.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/screens/SearchResultsV2.tsx
@src/components/MakeModelFilterBar.tsx
@src/hooks/useHomeListings.ts
@src/constants/translations.ts

<interfaces>
<!-- Verified from codebase. Executor: use these directly, no further exploration needed. -->

From `src/hooks/useHomeListings.ts` (return object — confirmed at lines 232–233):
```ts
selectedMake, setSelectedMake,
selectedModel, setSelectedModel,
```
Types: `SelectedRef = { id: string; name: string } | null`. Same shape as `VehicleMake`/`VehicleModel` used by the picker — assignment is direct.

From `src/components/MakeModelFilterBar.tsx`:
```ts
interface MakeModelFilterBarProps {
  selectedMake: VehicleMake | null;
  selectedModel: VehicleModel | null;
  onSelect: (make: VehicleMake | null, model: VehicleModel | null) => void;
  t?: { selectMake: string; selectModel: string; make: string; model: string; searchWithMake?: string };
  containerStyle?: object;
}
```

From `src/constants/translations.ts` (confirmed both RU + EN):
- `selectMake`, `selectModel`, `searchWithMake`, `brand`, `model` all exist for both languages.

Current `src/screens/SearchResultsV2.tsx` relevant points (verified):
- Line 1: `import React, { useMemo, useState } from 'react';`
- Line 2: `import { View, Text, FlatList, StyleSheet, StatusBar, TouchableOpacity, Platform } from 'react-native';`
- Lines 46–50: existing `useHomeListings({...})` destructure pulls only `displayedCars`, `activeFilters`, `applyFilter`.
- Lines 52–56: existing `useState` hooks for `revealed`, `sort`, `sortVisible`, `filterModalVisible`, `currentFilterType`.
- Lines 92–106: sticky header `<View style={styles.stickyHeader}>...</View>` containing the chevron-back `TouchableOpacity`. **Preserve as-is.**
- Line 107 onward: `<MarketStatsStrip ... />`. The new `<MakeModelFilterBar />` JSX must sit **between** the closing `</View>` of `styles.stickyHeader` and `<MarketStatsStrip ... />`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add MakeModelFilterBar + Android BackHandler to SearchResultsV2</name>
  <files>src/screens/SearchResultsV2.tsx</files>
  <behavior>
    - On SearchResultsV2 mount, an Android-only `useEffect` subscribes to `hardwareBackPress` and routes it through `navigation.goBack()` (returns `true` to prevent default).
    - The effect cleanup removes the subscription on unmount; iOS short-circuits the effect immediately (early `return` when `Platform.OS !== 'android'`).
    - `MakeModelFilterBar` renders below the sticky header and above `MarketStatsStrip`, fed by `selectedMake`/`selectedModel` from `useHomeListings`. Selecting make+model invokes `setSelectedMake` and `setSelectedModel`, filtering the results list (hook already wires this into `filteredCars`).
    - The existing chevron-back `TouchableOpacity` in `styles.stickyHeader` is unchanged and still functional.
  </behavior>
  <action>
Make the following four additive edits to `src/screens/SearchResultsV2.tsx`. Do NOT modify any other file. Touch ONLY this file.

1. **Edit line 1** — append `useEffect` to the `react` import:
   ```ts
   import React, { useEffect, useMemo, useState } from 'react';
   ```

2. **Edit line 2** — append `BackHandler` to the `react-native` import:
   ```ts
   import { View, Text, FlatList, StyleSheet, StatusBar, TouchableOpacity, Platform, BackHandler } from 'react-native';
   ```

3. **Add a new import** for `MakeModelFilterBar` after the existing `FilterModal` import (~line 17), grouping with screen-local component imports:
   ```ts
   import { MakeModelFilterBar } from '../components/MakeModelFilterBar';
   ```

4. **Expand the `useHomeListings` destructure** (currently lines 46–50) to additionally pull the make/model state and setters. After the edit it must read:
   ```ts
   const {
     displayedCars,
     activeFilters,
     applyFilter,
     selectedMake,
     setSelectedMake,
     selectedModel,
     setSelectedModel,
   } = useHomeListings({ initialFilters: route.params.initialFilters });
   ```

5. **Insert an Android back-handler `useEffect`** immediately AFTER the existing `useState` block (after the line `const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);` — currently line 56) and BEFORE the `const stats = useMemo(...)` line:
   ```ts
   useEffect(() => {
     if (Platform.OS !== 'android') return;
     const sub = BackHandler.addEventListener('hardwareBackPress', () => {
       navigation.goBack();
       return true;
     });
     return () => sub.remove();
   }, [navigation]);
   ```

6. **Insert the `MakeModelFilterBar` JSX** inside the `Header` fragment, immediately AFTER the closing `</View>` of `styles.stickyHeader` (currently line 106) and BEFORE `<MarketStatsStrip ... />` (currently line 107):
   ```jsx
   <MakeModelFilterBar
     selectedMake={selectedMake}
     selectedModel={selectedModel}
     onSelect={(make, model) => {
       setSelectedMake(make);
       setSelectedModel(model);
     }}
     t={{ selectMake: t.selectMake, selectModel: t.selectModel, make: t.brand, model: t.model, searchWithMake: t.searchWithMake }}
     containerStyle={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 4 }}
   />
   ```

Notes for the executor:
- The existing chevron-back `TouchableOpacity` inside `styles.stickyHeader` (lines 95–97) MUST remain untouched — it provides the on-screen back affordance; the Android hardware-back effect is additive.
- `selectedMake`/`selectedModel` returned by `useHomeListings` are typed as `SelectedRef = { id: string; name: string } | null`, structurally compatible with the picker's `VehicleMake`/`VehicleModel` props. No cast required; TypeScript widens through structural identity. If TS complains, add a single-line `as any` ONLY on the two prop sites — do not change the hook or the component.
- The v1 `MakeModelFilterBar` uses v1 `COLORS` (dark search-bg + border) and will sit inside a v2 `V2.bg` background. This visual seam is accepted per the user UAT (same compromise as the BottomBar swap). Do NOT restyle the picker.
- Do NOT touch `MakeModelFilterBar.tsx`, `useHomeListings.ts`, `translations.ts`, `HomeScreenV2.tsx`, or any other file.
  </action>
  <verify>
    <automated>grep -c "MakeModelFilterBar" src/screens/SearchResultsV2.tsx | grep -qx 2 && grep -c "BackHandler" src/screens/SearchResultsV2.tsx | awk '{ exit !($1 >= 2) }' && grep -c "setSelectedMake" src/screens/SearchResultsV2.tsx | awk '{ exit !($1 >= 2) }' && grep -c "hardwareBackPress" src/screens/SearchResultsV2.tsx | grep -qx 1 && npx eslint src/screens/SearchResultsV2.tsx && (npx tsc --noEmit 2>&1 | grep "SearchResultsV2" ; test "${PIPESTATUS[1]}" = "1")</automated>
  </verify>
  <done>
- `grep -c "MakeModelFilterBar" src/screens/SearchResultsV2.tsx` returns exactly `2` (import + JSX).
- `grep -c "BackHandler" src/screens/SearchResultsV2.tsx` returns `>= 2` (named import on line 2 + `BackHandler.addEventListener` call).
- `grep -c "setSelectedMake" src/screens/SearchResultsV2.tsx` returns `>= 2` (hook destructure + `onSelect` body).
- `grep -c "hardwareBackPress" src/screens/SearchResultsV2.tsx` returns exactly `1`.
- `npx eslint src/screens/SearchResultsV2.tsx` exits 0 with no errors.
- `npx tsc --noEmit` produces zero diagnostics whose path contains `SearchResultsV2`.
- File diff is limited to `src/screens/SearchResultsV2.tsx`; `git status --porcelain` lists no other modified files.
  </done>
</task>

</tasks>

<verification>
After the task completes:

1. **Static checks (automated):**
   - All four `grep` gates from `<done>` pass.
   - `npx eslint src/screens/SearchResultsV2.tsx` → exit 0.
   - `npx tsc --noEmit` → no errors referencing `SearchResultsV2.tsx`.

2. **Scope check (automated):**
   - `git diff --name-only` outputs exactly `src/screens/SearchResultsV2.tsx` (no other files touched).

3. **Manual smoke (deferred to user UAT, documented here):**
   - On HomeScreenV2 → tap search pill → SearchResultsV2 opens.
   - Tap the make/model picker → dropdown opens (no keyboard), select a make → list filters.
   - Android only: press hardware back button → returns to HomeScreenV2.
   - Tap on-screen chevron-back → returns to HomeScreenV2 (regression).
</verification>

<success_criteria>
- `src/screens/SearchResultsV2.tsx` imports `MakeModelFilterBar`, `BackHandler`, and `useEffect`.
- `useHomeListings` destructure exposes `selectedMake`, `setSelectedMake`, `selectedModel`, `setSelectedModel` in this file.
- An Android-gated `useEffect` registers `hardwareBackPress` → `navigation.goBack()` → returns `true`, with cleanup that removes the subscription.
- `MakeModelFilterBar` renders between the sticky header `</View>` and `<MarketStatsStrip ... />` with `selectedMake`/`selectedModel`/`onSelect` wired to the hook and `t={...}` mapping `t.brand` → `make`, `t.model` → `model`.
- Existing chevron-back `TouchableOpacity` is unchanged.
- ESLint + TypeScript clean. No file other than `src/screens/SearchResultsV2.tsx` is modified.
</success_criteria>

<output>
After completion, create `.planning/quick/260528-evg-add-makemodelfilterbar-android-back-hand/260528-evg-01-SUMMARY.md` summarizing the diff (imports added, hook destructure expanded, useEffect added, JSX inserted), the four grep gate results, and the eslint/tsc outcomes.
</output>
