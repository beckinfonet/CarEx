---
phase: 260528-cfe-align-center-fab
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/home/v2/EditorialDock.tsx
autonomous: false
requirements:
  - QUICK-260528-CFE: Align center FAB (+) in EditorialDock so it visually sits with the side nav items and all three labels share a baseline
must_haves:
  truths:
    - "The center FAB still appears elevated above the bar (visual emphasis preserved on the primary 'Продать авто' action)"
    - "The FAB no longer 'floats' so dramatically that it looks disconnected from the bar"
    - "The 'Продать авто' label baseline sits on (or within 1px of) the same baseline as the 'Главная' and 'Ещё' labels"
    - "The FAB gradient circle, icon, colors, shadow, and border are visually unchanged"
    - "No other screen, component, or layout regresses (EditorialDock is the only consumer touched)"
  artifacts:
    - path: "src/components/home/v2/EditorialDock.tsx"
      provides: "EditorialDock with corrected FAB vertical offset and label margin"
      contains: "styles.fab"
  key_links:
    - from: "styles.fab.top"
      to: "FAB vertical elevation above the bar"
      via: "absolute positioning offset"
      pattern: "top:\\s*-?\\d+"
    - from: "styles.fabLabel.marginTop"
      to: "FAB label vertical position inside fabSlot"
      via: "margin pushes label below the absolutely-positioned FAB"
      pattern: "marginTop:\\s*\\d+"
---

<objective>
Adjust two numeric style values in `EditorialDock.tsx` so that the center "Продать авто" FAB (+) stops floating too high above the bar and its label aligns with the side nav labels' baseline.

Purpose: The current `fab.top: -16` + `fabLabel.marginTop: 38` combo makes the FAB look "crooked" — the circle pokes out unusually far above the bar, and the label sits noticeably lower than the side labels ("Главная", "Ещё"). This is a pure visual polish task; no behavioral changes.

Output: Modified `src/components/home/v2/EditorialDock.tsx` with two style values changed (and optionally a third, see Task 1). All other styling, handlers, icons, colors, and gradients untouched.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/components/home/v2/EditorialDock.tsx
@src/components/home/v2/theme.ts

<interfaces>
<!-- Key style structure the executor needs. Extracted from EditorialDock.tsx. -->
<!-- Executor should NOT explore other files — this is the only target. -->

Current values in `src/components/home/v2/EditorialDock.tsx` (StyleSheet block at bottom):

```
styles.wrapper:    { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 28 }
styles.bar:        { ..., height: 64, borderRadius: 28 }
styles.navItem:    { flex: 1, alignItems: 'center', justifyContent: 'center',
                     paddingVertical: 6, gap: 2 }
styles.navLabel:   { fontSize: 10, letterSpacing: -0.1 }
styles.fabSlot:    { width: 80, alignItems: 'center', justifyContent: 'center' }
styles.fab:        { position: 'absolute', top: -16, ... }   <-- CHANGE
styles.fabGradient:{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, ... }
styles.fabLabel:   { fontSize: 10, color: V2.text, fontWeight: '700',
                     marginTop: 38 }                         <-- CHANGE
```

Layout math (for executor judgment):
- Bar height: 64
- Side nav label baseline sits ~y=37-49 inside the bar (paddingVertical 6 + icon 20 + gap 2 + label).
- With `fab.top: -16`, the 60×60 FAB occupies y=-16 to y=44 (circle center y=14).
- With `fabLabel.marginTop: 38`, label sits ~8-10px below side labels' baseline.
- Recommended starting values: `fab.top: -8`, `fabLabel.marginTop: 30`.
- Executor may fine-tune within ±2px (visual judgment matters; checkpoint will confirm).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adjust FAB elevation and label margin in EditorialDock styles</name>
  <files>src/components/home/v2/EditorialDock.tsx</files>
  <action>
In `src/components/home/v2/EditorialDock.tsx`, modify ONLY the StyleSheet block at the bottom. Make these two changes:

1. In `styles.fab` (currently `{ position: 'absolute', top: -16, alignItems: 'center', justifyContent: 'center' }`), change `top: -16` to `top: -8`. The FAB will still poke above the bar (preserving visual emphasis on the primary "Продать авто" action) but only half as much, so it reads as "elevated" rather than "floating disconnected".

2. In `styles.fabLabel` (currently `{ fontSize: 10, color: V2.text, fontWeight: '700', marginTop: 38 }`), change `marginTop: 38` to `marginTop: 30`. This raises the "Продать авто" label by 8px so its baseline matches the side labels' baseline (which sit at roughly the same y-coordinate inside their `navItem` containers with `paddingVertical: 6` + 20px icon + 2px gap + 10px label).

Optional fine-tuning (executor's discretion, within ±2px each): If after visual check the label is 1-2px above/below the side baselines, nudge `fabLabel.marginTop` to 28-32. If the FAB still floats too high or sinks into the bar, nudge `fab.top` to -6 or -10. Do NOT exceed ±2px from the recommended values without re-evaluating.

DO NOT change any of the following (they are explicitly load-bearing for the V2 visual design):
- `styles.fabGradient` (width/height/borderRadius/borderWidth/colors/shadow values must stay 60/60/30/3/V2.bg/V2.blue/etc.)
- `styles.bar` (height: 64, borderRadius: 28, borderColor)
- Icon sizes (Home 20, Plus 26, Menu 20) or strokeWidths
- Gradient colors, gradient stops (`V2.blue`, `V2.blueDeep`), or shadow values
- `styles.wrapper` paddings (paddingHorizontal: 8, paddingTop: 8, paddingBottom: 28)
- `styles.fade` (the bar-fade gradient above the dock)
- `styles.fabSlot` (width: 80)
- Any handler logic, navigation calls, state, props, or imports

NOTE: The task description authorized `wrapper.paddingTop` as a fallback compensation knob, but with `fab.top: -8` the wrapper paddingTop (8) is already sufficient — the FAB extends to y=-8 above the bar, and the wrapper has 8px of paddingTop, so it clears within the wrapper bounds. Do not modify `wrapper.paddingTop` unless visual check reveals the FAB getting clipped at the top, in which case raise to 10-12.
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; grep -E "top:\s*-8|marginTop:\s*30" src/components/home/v2/EditorialDock.tsx | wc -l | awk '{ if ($1 &gt;= 2) print "PASS: both style values updated"; else print "FAIL: expected at least 2 matches, got " $1 }'</automated>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; npm run lint -- src/components/home/v2/EditorialDock.tsx 2&gt;&amp;1 | tail -20</automated>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; npx tsc --noEmit 2&gt;&amp;1 | grep -E "EditorialDock\.tsx" || echo "PASS: no TS errors in EditorialDock.tsx"</automated>
  </verify>
  <done>
- `styles.fab.top` changed from `-16` to `-8` (or executor's chosen value within -6 to -10).
- `styles.fabLabel.marginTop` changed from `38` to `30` (or executor's chosen value within 28-32).
- No other style properties, JSX, imports, handlers, or behavior changed.
- `npm run lint` passes for the file with no new warnings/errors.
- `npx tsc --noEmit` shows no TypeScript errors in `EditorialDock.tsx`.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Visual verification on HomeScreenV2</name>
  <what-built>
Two numeric style adjustments in `src/components/home/v2/EditorialDock.tsx`:
- `styles.fab.top`: -16 → -8 (FAB pokes less above the bar)
- `styles.fabLabel.marginTop`: 38 → 30 (label raised to align with side labels)
  </what-built>
  <how-to-verify>
1. If Metro is not running: `npm start` from project root. If native deps haven't changed, `npm run start:reset` is NOT required.
2. Run on iOS sim: `npm run ios` (or use already-running sim).
3. Toggle to V2 home screen if not already there:
   - Open the app
   - Navigate to Profile → Настройки (Settings) → "Внешний вид" row → select V2 (новый дизайн)
   - Return to Home tab — HomeScreenV2 should render with the EditorialDock at the bottom
4. Inspect the bottom dock against these criteria:
   - **FAB elevation:** The blue gradient + circle should still visually "lift" above the bar (cue that it's the primary action), but NOT float so high that it looks detached from the bar. Compare to before — the circle's bottom edge should still be inside the bar, top edge ~8px above.
   - **Label baseline alignment:** Hold a finger or visual ruler horizontally across all three labels ("Главная", "Продать авто", "Ещё"). All three baselines should sit on (or within 1-2px of) the same horizontal line. Before this change, "Продать авто" was visibly lower.
   - **No clipping:** The top of the FAB circle should not be clipped by the wrapper or fade gradient.
   - **Tap targets still work:** Tap the + FAB → navigates to SellCar. Tap Главная → HomeScreen with cleared filters. Tap Ещё → opens the More sheet.
5. Repeat on Android emulator if convenient: `npm run android`.
6. If anything looks off:
   - Label still misaligned by &gt;2px → ask executor to nudge `fabLabel.marginTop` ±2
   - FAB floating too high / sinking into bar → ask executor to nudge `fab.top` ±2
   - FAB clipped → ask executor to bump `wrapper.paddingTop` from 8 to 10-12
  </how-to-verify>
  <resume-signal>Type "approved" if alignment looks correct on both labels and FAB elevation. If adjustments are needed, describe what looks off (e.g., "label still 2px low", "FAB clipped at top") and the executor will fine-tune.</resume-signal>
</task>

</tasks>

<verification>
- File `src/components/home/v2/EditorialDock.tsx` is modified.
- Only `styles.fab.top` and `styles.fabLabel.marginTop` (and optionally `styles.wrapper.paddingTop` if clipping observed) have changed numeric values.
- No JSX, imports, handlers, or other style properties touched.
- Lint and TypeScript pass.
- Visual checkpoint approved by user.
</verification>

<success_criteria>
- All three EditorialDock labels ("Главная", "Продать авто", "Ещё") share the same baseline (within 1-2px).
- Center FAB still reads as elevated/primary but is not visually disconnected from the bar.
- No regressions to FAB tap (→ SellCar), Home tap (→ Home with cleared filters), or More tap (→ opens More sheet).
- No other screens or components are affected.
- User approves visual at checkpoint.
</success_criteria>

<output>
After completion, create `.planning/quick/260528-cfe-align-center-fab-in-editorialdock-with-s/260528-cfe-01-SUMMARY.md` capturing:
- Final values chosen for `fab.top` and `fabLabel.marginTop` (and `wrapper.paddingTop` if changed).
- Any deviation from the recommended -8 / 30 starting values and why.
- Confirmation that visual checkpoint was approved.
</output>
