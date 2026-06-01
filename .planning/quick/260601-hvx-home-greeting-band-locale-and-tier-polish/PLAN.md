---
quick_id: 260601-hvx
slug: home-greeting-band-locale-and-tier-polish
date: 2026-06-01
---

# Quick task: Home Greeting Band — Locale + Personality polish (Option C)

Implement the design hand-off in `CarExLocale.zip` →
`design_handoff_greeting_band/README.md` against the live RN components.
Goal: visually align the listings/tier/locale row in `HomeScreenV2` to the
"Option C" spec — listings becomes plain text, the tier+locale cluster sits
at a shared 28-px height with `gap: 6`, the locale gains a colorful (flag-free)
globe + active code single-toggle, and the Unhinged tier softens to ember.

## Files touched
- `src/components/home/v2/theme.ts` — add `ember`, `emberBd`, `emberFill` tokens
- `src/components/home/v2/LocaleGlobe.tsx` — **new** (verbatim from bundle)
- `src/components/home/v2/LangSwitchV2.tsx` — single-toggle (globe + active code), h28
- `src/components/home/v2/TierChip.tsx` — Unhinged → ember tokens; h28; size/weight per spec
- `src/components/home/v2/GreetingBlock.tsx` — replace listings chip with mono+muted text

## Out of scope
- HomeScreenV2 trailing wrapper already provides `gap: 6` (line 212) — no change.
- No translation key changes; `accessibilityLabel` for locale uses existing language
  state (`language` string is RU/EN itself — readable for screen readers without new keys).
- Sarcastic tier color treatment is **not** touched (handoff explicitly out of scope).

## Verification
- `npm run lint` — clean for changed files.
- `npx tsc --noEmit` — no new type errors.
- Smoke-read final composition: listings text + (tier+globe pill) cluster at 28px.
