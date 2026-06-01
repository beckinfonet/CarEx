---
quick_id: 260601-hvx
slug: home-greeting-band-locale-and-tier-polish
date: 2026-06-01
status: complete
---

# Summary — Home Greeting Band: Locale globe + Unhinged ember polish

Implemented the "Option C" design hand-off (CarExLocale.zip /
`design_handoff_greeting_band/README.md`) against the live RN components.

## Changes
- **`src/components/home/v2/theme.ts`** — added `ember` (`#F2BD98`), `emberBd`
  (`rgba(255,176,128,0.30)`), `emberFill` (gradient stop tuple) tokens.
- **`src/components/home/v2/LocaleGlobe.tsx`** — new flag-free `react-native-svg`
  globe (verbatim from bundle); marked decorative (`accessible={false}`).
- **`src/components/home/v2/LangSwitchV2.tsx`** — rewritten as a **single-toggle**
  pill (height 28, paddingLeft 8 / paddingRight 10, gap 6, radius 999). Renders
  `<LocaleGlobe size={16} />` + the active language code (`typo.display`, 11.5px,
  weight 800, letterSpacing 0.34). Tap flips `RU ↔ EN`. `accessibilityRole="button"`
  + `accessibilityLabel="Language: <active>"` + `accessibilityHint`.
- **`src/components/home/v2/TierChip.tsx`** — Unhinged now uses
  `V2.ember*` tokens (icon + label color `V2.ember`, border `V2.emberBd`,
  gradient `V2.emberFill` 0→0.2 vertical drift ≈100deg). Pill now `height: 28`,
  `paddingHorizontal: 11`. Icon `size 12`, `strokeWidth 2.3`. Label `fontSize 10`,
  `letterSpacing 0.5`. Sarcastic colors intentionally untouched (out of scope).
- **`src/components/home/v2/GreetingBlock.tsx`** — replaced the blue-tint
  listings chip with **plain text**: mono count (`typo.mono`, 16/700,
  letterSpacing -0.16, `V2.text`) + UPPERCASE muted noun (`typo.display`,
  12/600, letterSpacing 0.72, `V2.textMuted`), `gap: 6`, baseline-aligned,
  `numberOfLines={1}` + `flexShrink: 1` for long RU strings.

## Out of scope (per hand-off)
- Sarcastic tier color treatment untouched.
- No new translation keys; a11y label uses the language code directly.
- HomeScreenV2 trailing wrapper already at `gap: 6` height-aligned cluster.

## Verification
- `npx tsc --noEmit` — no new type errors in changed files (pre-existing test +
  AuthService errors unrelated).
- `npx eslint <changed files>` — clean.
- Visual smoke: row composition matches the spec (listings text left, tier+globe
  cluster right, all at 28-px shared height).
