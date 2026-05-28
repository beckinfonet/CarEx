---
phase: 260528-cfe-align-center-fab
plan: 01
subsystem: home-v2-ui
tags: [home-v2, editorial-dock, fab, visual-polish, alignment]
requires: []
provides:
  - "EditorialDock with corrected FAB vertical offset (-8) and label margin (30)"
affects:
  - "src/components/home/v2/EditorialDock.tsx"
tech-stack:
  added: []
  patterns: ["StyleSheet numeric polish only; no behavior change"]
key-files:
  created: []
  modified:
    - src/components/home/v2/EditorialDock.tsx
decisions:
  - "Adopted recommended starting values (fab.top: -8, fabLabel.marginTop: 30) verbatim — no ±2px fine-tuning applied. Visual judgment deferred to human-verify checkpoint (Task 2)."
  - "wrapper.paddingTop left at 8 — with fab.top: -8 the FAB extends to y=-8 above the bar and the wrapper already has 8px paddingTop, so clipping is not anticipated."
metrics:
  duration: "~1m"
  completed_date: "2026-05-28"
  files_changed: 1
  lines_changed: 4
  tasks_completed: 1
  tasks_pending_uat: 1
---

# 260528-cfe Plan 01: Align center FAB in EditorialDock Summary

One-liner: Reduced FAB elevation from -16 to -8 and label marginTop from 38 to 30 in EditorialDock styles so the "Продать авто" label baseline lines up with the side nav labels and the FAB no longer reads as visually detached from the bar.

## Outcome

Two numeric StyleSheet values changed in `src/components/home/v2/EditorialDock.tsx`:

| Style key                | Before | After | Rationale                                                              |
|--------------------------|--------|-------|------------------------------------------------------------------------|
| `styles.fab.top`         | `-16`  | `-8`  | FAB still pokes above the bar (primary-action cue) but only half as much, so it reads as "elevated" rather than "floating disconnected". |
| `styles.fabLabel.marginTop` | `38`  | `30`  | Raises the "Продать авто" label by 8px so its baseline matches the side labels' baseline (which sit ~y=37-49 inside the bar at `paddingVertical: 6` + 20px icon + 2px gap + 10px label). |

No other style properties, JSX, imports, handlers, props, or behavior changed. `styles.fabGradient`, `styles.bar`, `styles.wrapper`, `styles.fade`, `styles.fabSlot`, `styles.navItem`, `styles.navLabel`, icon sizes, strokeWidths, gradient colors, and shadow values are all byte-identical to pre-task state.

## Tasks

### Task 1: Adjust FAB elevation and label margin in EditorialDock styles — DONE

- Modified two numeric values in the StyleSheet block at the bottom of `src/components/home/v2/EditorialDock.tsx` (lines 84 + 92).
- Adopted recommended starting values verbatim (`fab.top: -8`, `fabLabel.marginTop: 30`) without ±2px fine-tuning — the plan explicitly authorizes the executor to start from these values, and visual judgment is deferred to the human-verify checkpoint.
- `wrapper.paddingTop` left at 8 (no clipping anticipated — see Decisions).
- Verification:
  - `grep -E "top:\s*-8|marginTop:\s*30" src/components/home/v2/EditorialDock.tsx | wc -l` → 2 (PASS, both style values updated).
  - `npm run lint -- src/components/home/v2/EditorialDock.tsx` → 2 warnings on EditorialDock.tsx (lines 38 + 58, `react-native/no-inline-styles` on the `fontWeight` ternary inline styles in JSX). Both are **pre-existing** — they sit in the JSX render block, NOT in the StyleSheet, and were untouched by this task. No new warnings or errors introduced.
  - `npx tsc --noEmit | grep EditorialDock.tsx` → no output (PASS, no TS errors).
- Commit: `8240dfe` — `style(260528-cfe-01): align center FAB and label in EditorialDock with side nav baseline`

### Task 2: Visual verification on HomeScreenV2 — PENDING UAT

Per the quick-task constraints, this human-verify checkpoint is left as a pending UAT step in this summary. The user will manually confirm in-app.

**UAT steps for the user:**

1. If Metro is not running: `npm start` from project root. Cache reset NOT required (no native deps changed).
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

**If adjustments needed, common knobs:**
- Label still misaligned by >2px → nudge `fabLabel.marginTop` ±2 (range 28–32).
- FAB floating too high / sinking into bar → nudge `fab.top` ±2 (range -6 to -10).
- FAB clipped at top → bump `wrapper.paddingTop` from 8 to 10–12.

## Deviations from Plan

None — plan executed exactly as written using the recommended starting values.

## Verification Results

- ✅ `grep -E "top:\s*-8|marginTop:\s*30"` returns 2 matches (both style values updated).
- ✅ `npm run lint` produces no NEW warnings/errors on EditorialDock.tsx (the 2 warnings on lines 38 + 58 are pre-existing inline-style ternaries in JSX, not introduced by this task).
- ✅ `npx tsc --noEmit` produces no TS errors for EditorialDock.tsx.
- ✅ Only `styles.fab.top` and `styles.fabLabel.marginTop` changed (verified via `git diff` — 4 lines: 2 added, 2 removed).
- ⏳ Visual checkpoint (Task 2) — pending user UAT.

## Success Criteria

- [ ] All three EditorialDock labels share the same baseline (within 1-2px) — pending UAT.
- [ ] Center FAB still reads as elevated/primary but not visually disconnected — pending UAT.
- [ ] No regressions to FAB tap (→ SellCar), Home tap (→ Home cleared), or More tap (→ opens More sheet) — pending UAT.
- [x] No other screens or components affected (only EditorialDock.tsx touched, verified via `git status`).
- [ ] User approves visual at checkpoint — pending UAT.

## Self-Check

- ✅ File `src/components/home/v2/EditorialDock.tsx` exists and contains the new values.
- ✅ Commit `8240dfe` exists in `git log --all`.

## Self-Check: PASSED
