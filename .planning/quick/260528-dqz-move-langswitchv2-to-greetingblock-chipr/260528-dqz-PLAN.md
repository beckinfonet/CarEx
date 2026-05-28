---
phase: 260528-dqz-move-langswitchv2-to-greetingblock-chipr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/home/v2/FloatingSearchPill.tsx
  - src/components/home/v2/GreetingBlock.tsx
  - src/screens/HomeScreenV2.tsx
autonomous: true
requirements: [UI-DQZ-01]

must_haves:
  truths:
    - "FloatingSearchPill renders only the search pill row (no language switch, no trailing slot)"
    - "GreetingBlock's chip row shows the listings count chip on the left and the language switch on the right"
    - "HomeScreenV2 passes LangSwitchV2 to GreetingBlock (not to FloatingSearchPill)"
    - "Both FloatingSearchPill.test.tsx and GreetingBlock.test.tsx continue to pass without modification"
  artifacts:
    - path: "src/components/home/v2/FloatingSearchPill.tsx"
      provides: "Pre-260528-dj9 shape — no `trailing` prop, wrapper has only `paddingHorizontal` + `paddingTop`, `pill` has no `flex: 1`"
      contains: "FloatingSearchPillProps without trailing"
    - path: "src/components/home/v2/GreetingBlock.tsx"
      provides: "Optional `trailing` prop rendered as sibling of the chip inside `chipRow`, with `justifyContent: 'space-between'` + `alignItems: 'center'`"
      contains: "trailing?: React.ReactNode"
    - path: "src/screens/HomeScreenV2.tsx"
      provides: "LangSwitchV2 mounted via GreetingBlock's `trailing` prop"
      contains: "trailing={<LangSwitchV2"
  key_links:
    - from: "src/screens/HomeScreenV2.tsx"
      to: "src/components/home/v2/GreetingBlock.tsx"
      via: "trailing prop"
      pattern: "GreetingBlock[\\s\\S]*trailing=\\{<LangSwitchV2"
    - from: "src/components/home/v2/GreetingBlock.tsx"
      to: "rendered chip row"
      via: "trailing rendered inside chipRow View, after chip"
      pattern: "chipRow[\\s\\S]*\\{trailing\\}"
---

<objective>
Move LangSwitchV2 from FloatingSearchPill's trailing slot (introduced in 260528-dj9) to GreetingBlock's chip row, so the toggle sits next to the "50 объявлений" listings chip. Both elements are pill-shaped with similar heights, fixing the visual height mismatch UAT surfaced (pill 48px vs LangSwitchV2 ~28–30px).

Purpose: Visual balance — listings chip + language switch share the same compact pill aesthetic.
Output: FloatingSearchPill reverted to its pre-260528-dj9 shape; GreetingBlock gains an optional trailing slot inside its chipRow; HomeScreenV2 moves the LangSwitchV2 prop from pill → greeting.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md

<interfaces>
<!-- Current shape of the three files. Use these directly — no codebase exploration needed. -->

From src/components/home/v2/FloatingSearchPill.tsx (current — has unwanted `trailing`):
```typescript
export interface FloatingSearchPillProps {
  placeholder: string;
  onPress: () => void;
  onFiltersPress: () => void;
  trailing?: React.ReactNode;   // ← REMOVE
}
```
Current `styles.wrapper` has `flexDirection: 'row', alignItems: 'center', gap: 10` and `styles.pill` has `flex: 1` — both added by 260528-dj9 and must be removed. Target wrapper: `{ paddingHorizontal: 18, paddingTop: 12 }`. Target pill: same as today minus `flex: 1`.

From src/components/home/v2/GreetingBlock.tsx (current — no trailing slot):
```typescript
export interface GreetingBlockProps {
  timeOfDay: string;
  city: string;
  headline: string;
  listingsCount: number;
  listingsNoun: string;
  // ← ADD: trailing?: React.ReactNode;
}
```
Current `chipRow` style: `{ flexDirection: 'row', marginTop: 12, gap: 8 }`. Target: add `justifyContent: 'space-between', alignItems: 'center'`. Current JSX has one child `<View style={styles.chip}>…</View>` inside `chipRow`. Target: render `{trailing}` as a sibling after that chip View.

From src/components/home/v2/LangSwitchV2.tsx (read-only — passed as-is):
```typescript
<LangSwitchV2 language={language} setLanguage={setLanguage} />
```

From src/screens/HomeScreenV2.tsx (current — passes trailing on FloatingSearchPill at line 145):
```jsx
<FloatingSearchPill
  placeholder={t.searchPlaceholderV2}
  onPress={handleSearchPress}
  onFiltersPress={handleFiltersPress}
  trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}  // ← REMOVE this line
/>
```
The `<GreetingBlock … />` block lives at ~lines 95–101 inside the `Header` JSX. Add `trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}` as the last prop on that GreetingBlock.

Note: `language` and `setLanguage` are already destructured from `useLanguage()` on line 41. No new imports required — `LangSwitchV2` is already imported on line 23.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Revert FloatingSearchPill, add trailing slot to GreetingBlock chipRow, move LangSwitchV2 prop in HomeScreenV2</name>
  <files>src/components/home/v2/FloatingSearchPill.tsx, src/components/home/v2/GreetingBlock.tsx, src/screens/HomeScreenV2.tsx</files>
  <action>
Three coordinated edits across the three listed files. Do not touch any other files (especially not LangSwitchV2.tsx, theme.ts, BottomBar.tsx, the v1 HomeScreen, or any test file).

1) Revert src/components/home/v2/FloatingSearchPill.tsx to its pre-260528-dj9 shape:
   - In `FloatingSearchPillProps`: remove the `trailing?: React.ReactNode;` line.
   - In the component's destructure (`{ placeholder, onPress, onFiltersPress, trailing }`): remove `trailing`.
   - In the JSX: remove the `{trailing}` expression that currently follows the inner `TouchableOpacity` and sits inside the wrapper `View`. The wrapper `View` now has exactly one child: the pill TouchableOpacity.
   - In `styles.wrapper`: remove `flexDirection: 'row'`, `alignItems: 'center'`, and `gap: 10`. The final wrapper style must be exactly `{ paddingHorizontal: 18, paddingTop: 12 }`.
   - In `styles.pill`: remove the leading `flex: 1,` line. All other pill fields (`flexDirection`, `alignItems`, `height: 48`, paddings, background, border, `borderRadius: V2.radius.pill`, `gap: 10`) stay unchanged.
   - After this edit, no occurrence of the token `trailing` may remain in the file (including comments).

2) Modify src/components/home/v2/GreetingBlock.tsx to accept a `trailing` slot and render it inside `chipRow`:
   - In `GreetingBlockProps`: append `trailing?: React.ReactNode;` after `listingsNoun: string;`. Add a brief JSDoc line above it, e.g. `/** Optional element rendered at the right edge of the chip row (used for LangSwitchV2). */`.
   - In the component destructure: add `trailing` after `listingsNoun`.
   - In the JSX `chipRow` View: keep the existing chip `<View style={styles.chip}>…</View>` as-is, then render `{trailing}` as its sibling, after the chip View, still inside the `chipRow` View.
   - In `styles.chipRow`: change from `{ flexDirection: 'row', marginTop: 12, gap: 8 }` to `{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }`. Field order within the object is flexible; the key requirement is that both `alignItems: 'center'` and `justifyContent: 'space-between'` are present alongside the existing fields.
   - The token `trailing` must appear at least 3 times in the final file (prop type, destructure, JSX render).

3) Modify src/screens/HomeScreenV2.tsx to move the LangSwitchV2 mount from FloatingSearchPill to GreetingBlock:
   - On the `<FloatingSearchPill … />` element (around line 141–146): remove the `trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}` prop. The element keeps its other three props (`placeholder`, `onPress`, `onFiltersPress`).
   - On the `<GreetingBlock … />` element (around line 95–101 inside the `Header` JSX): add `trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}` as the last prop, after `listingsNoun={t.listingsCount}`.
   - Do not touch the `import { LangSwitchV2 } from '../components/home/v2/LangSwitchV2';` line on line 23 — it's still used.
   - After this edit, `trailing` must appear exactly once in the file (on the GreetingBlock element), and `LangSwitchV2` must appear exactly twice (the import + the single JSX usage).

Do not introduce new theme constants, new styles, new exports, new imports, or any other prop changes. Do not modify any test files; both FloatingSearchPill.test.tsx and GreetingBlock.test.tsx do not pass `trailing` and must continue to pass unchanged because `trailing` remains optional on GreetingBlock and is removed entirely from FloatingSearchPill.
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; \
TRAIL_PILL=$(grep -v '^[[:space:]]*//' src/components/home/v2/FloatingSearchPill.tsx | grep -c "trailing") &amp;&amp; \
TRAIL_GREET=$(grep -v '^[[:space:]]*//' src/components/home/v2/GreetingBlock.tsx | grep -c "trailing") &amp;&amp; \
TRAIL_HOME=$(grep -v '^[[:space:]]*//' src/screens/HomeScreenV2.tsx | grep -c "trailing") &amp;&amp; \
LANG_HOME=$(grep -v '^[[:space:]]*//' src/screens/HomeScreenV2.tsx | grep -c "LangSwitchV2") &amp;&amp; \
echo "FloatingSearchPill trailing=$TRAIL_PILL (expect 0)" &amp;&amp; \
echo "GreetingBlock trailing=$TRAIL_GREET (expect >=3)" &amp;&amp; \
echo "HomeScreenV2 trailing=$TRAIL_HOME (expect 1)" &amp;&amp; \
echo "HomeScreenV2 LangSwitchV2=$LANG_HOME (expect 2)" &amp;&amp; \
[ "$TRAIL_PILL" -eq 0 ] &amp;&amp; [ "$TRAIL_GREET" -ge 3 ] &amp;&amp; [ "$TRAIL_HOME" -eq 1 ] &amp;&amp; [ "$LANG_HOME" -eq 2 ] &amp;&amp; \
npx jest --testPathPattern "FloatingSearchPill|GreetingBlock" &amp;&amp; \
npx eslint src/components/home/v2/FloatingSearchPill.tsx src/components/home/v2/GreetingBlock.tsx src/screens/HomeScreenV2.tsx &amp;&amp; \
(npx tsc --noEmit 2>&amp;1 | grep -E "FloatingSearchPill|GreetingBlock|HomeScreenV2" &amp;&amp; echo "TS errors found in target files — FAIL" &amp;&amp; exit 1 || echo "No TS errors in target files")</automated>
  </verify>
  <done>
    - FloatingSearchPill.tsx has no `trailing` token; `styles.wrapper` is `{ paddingHorizontal: 18, paddingTop: 12 }`; `styles.pill` no longer has `flex: 1`.
    - GreetingBlock.tsx exposes optional `trailing` prop, renders it inside `chipRow` as sibling of the chip, and `chipRow` style includes both `alignItems: 'center'` and `justifyContent: 'space-between'`.
    - HomeScreenV2.tsx mounts `<LangSwitchV2 language={language} setLanguage={setLanguage} />` via GreetingBlock's `trailing` prop only; FloatingSearchPill receives only `placeholder`, `onPress`, `onFiltersPress`.
    - `npx jest --testPathPattern "FloatingSearchPill|GreetingBlock"` passes.
    - `npx eslint` clean on all three files.
    - `npx tsc --noEmit` produces no errors referencing any of the three target files.
  </done>
</task>

</tasks>

<verification>
After the task completes, manually launch HomeScreenV2 and confirm visually:
- The search pill once again spans the full row (no toggle on its right) and sits at the top with the previous padding.
- The chip row inside the greeting block now shows "50 объявлений" pill on the left and LangSwitchV2 (RU/EN toggle) on the right, both at similar pill heights.
- Tapping the language toggle still switches RU/EN and re-renders the greeting copy.
- v1 HomeScreen (with v2 toggle off) is untouched.

Automated guards already enforced by the task's `<verify>` block.
</verification>

<success_criteria>
- All four grep gates pass (FloatingSearchPill `trailing`==0, GreetingBlock `trailing`>=3, HomeScreenV2 `trailing`==1, HomeScreenV2 `LangSwitchV2`==2).
- Jest suites for FloatingSearchPill and GreetingBlock both pass without modification to the test files.
- ESLint is clean on the three modified files.
- `npx tsc --noEmit` reports no errors mentioning the three target files.
- No other files modified.
</success_criteria>

<output>
After completion, create `.planning/quick/260528-dqz-move-langswitchv2-to-greetingblock-chipr/260528-dqz-01-SUMMARY.md` capturing:
- The three diffs (one-line each) applied
- Confirmation that all grep gates and jest/eslint/tsc commands passed
- Note that this completes the toggle-placement UAT followup from 260528-dj9
</output>
