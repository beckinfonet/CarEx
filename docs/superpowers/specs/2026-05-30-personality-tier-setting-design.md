# Spec: Personality Tier Setting (P0 spine)

- **Date:** 2026-05-30
- **Status:** Design — ready for implementation planning
- **Source brief:** [`2026-05-29-fun-engagement-features-handoff.md`](./2026-05-29-fun-engagement-features-handoff.md)
- **Slice of:** P0 of the Fun / Personality Engagement program (handoff §5). This spec covers the **first** P0 item only — the Personality Tier setting itself. A1 Listing POV monologues, D1 Shareable card, and telemetry are deferred to follow-up specs that depend on this one.

---

## 1. Scope & non-goals

### In scope

- A 3-stop **Personality Tier** setting (`Wholesome` / `Sarcastic` / `Unhinged`) persisted per-device via AsyncStorage.
- A new `PersonalityContext` exposing `{ tier, setTier, cycleTier }` and a `usePersonality()` hook, mirroring `LanguageContext`'s pattern (Provider + hook that throws if used outside the Provider).
- A **TierChip** on `HomeScreenV2` in the greeting block's chip row, sitting beside `LangSwitchV2`. **Always visible** (including the `Wholesome` state) so the feature is discoverable from the first launch.
- **Tap-cycle** (Wholesome → Sarcastic → Unhinged → Wholesome) and **long-press → TierPickerSheet** showing each tier with a one-line example greeting in the active language.
- **Tier-scoped greeting pools** in `src/constants/translations.ts` — the existing four pools (`greetingVariantsMorning`, `greetingVariantsAfternoon`, `greetingVariantsEvening`, `headlineVariants`) migrate from `string[]` to `{ wholesome: string[]; sarcastic: string[]; unhinged: string[] }`. The existing 10 lines per pool become the `wholesome` slice unchanged.
- **160 net-new copy lines** (Sarcastic + Unhinged × 4 slots × 10 lines × 2 languages) drafted by Claude at authoring time, tone-reviewed by the product owner per language before merge.
- Default tier for new users: **`wholesome`** (handoff §3.2: "Default tone stays friendly").

### Out of scope (deferred)

- **No runtime AI generation** — all tier copy ships as static strings reviewed before merge. Authoring-time AI drafting *is* in scope per §5.
- A1 Listing POV monologues, D1 Shareable branded card, telemetry / event logging — separate follow-up specs.
- Backend mirror of `tier` on the user record. Local-first now; migration path written but unbuilt (§9).
- Settings-screen entry point on Profile. The Home chip + sheet is the only entry for v1.
- Affecting any copy outside the four greeting slots (no tier-flavored buttons, labels, headers, error messages, etc.).
- Slot+tier-keyed anti-repeat registry refactor — see §4 anti-repeat note.

### Non-negotiable guardrails (handoff §3, carried verbatim)

1. **Punch at the car or situation, never the user's wallet, taste, or worth.** Every drafted line is judged against this. Anything that reads as wallet-shaming is rewritten or cut.
2. **All three tiers ship at once or none ship.** No phased "infrastructure now, copy later." One PR containing context + components + wiring + the full reviewed copy matrix; merge is gated on copy review (see §5).
3. **Bilingual parity is non-negotiable.** Every line has both an RU and EN sibling, each tone-reviewed in its own language.
4. **Default tone stays friendly.** Selecting Wholesome must render exactly the live experience today.

---

## 2. Architecture

### New files

| File | Purpose |
|---|---|
| `src/context/PersonalityContext.tsx` | Provider + `usePersonality()` hook. Mirrors `LanguageContext`: throws if used outside Provider, persists to AsyncStorage on `setTier`, hydrates on mount. |
| `src/components/home/v2/TierChip.tsx` | The Home chip. Tap → `cycleTier()`; long-press → opens `TierPickerSheet`. |
| `src/components/home/v2/TierPickerSheet.tsx` | Bottom sheet with 3 selectable rows, each showing tier name + a deterministic 1-line preview greeting in the active language. |

### Modified files

| File | Change |
|---|---|
| `App.tsx` | Add `<PersonalityProvider>` between `<LanguageProvider>` and `<NavigationContainer>`. PersonalityProvider sits inside LanguageProvider because the picker sheet renders preview copy in the active language. |
| `src/screens/HomeScreenV2.tsx` | Read tier via `usePersonality()`; pass tier-scoped pool to `rotateVariant`; add `<TierChip />` alongside `<LangSwitchV2 />` in GreetingBlock's `trailing` slot; add a 5th rotation trigger on tier change. |
| `src/components/home/v2/GreetingBlock.tsx` | No API change. The `trailing` slot already accepts arbitrary `React.ReactNode`. |
| `src/constants/translations.ts` | Migrate the four greeting pool keys from `string[]` to `{ wholesome; sarcastic; unhinged }` for both RU and EN blocks. |

### Provider stack order

```
GestureHandlerRootView
  → SafeAreaProvider
    → AuthProvider
      → CartProvider
        → StripeProvider
          → LanguageProvider
            → PersonalityProvider          ← NEW
              → NavigationContainer
                → Stack.Navigator
```

### State + persistence

```ts
type PersonalityTier = 'wholesome' | 'sarcastic' | 'unhinged';

const STORAGE_KEY = '@carex.personality.tier.v1';
const DEFAULT_TIER: PersonalityTier = 'wholesome';
const CYCLE_ORDER: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];
```

Behavior:

- **Hydrate on mount.** Read `STORAGE_KEY`. If absent, malformed, or not one of the three valid tiers, fall back to `DEFAULT_TIER`. Failures during read are swallowed and logged with `console.error` — same convention as the rest of the app.
- **`setTier(tier)`** updates in-memory state synchronously, then writes through to AsyncStorage. Write failures retain the in-memory value (the user's choice persists for the session even if the disk write fails).
- **`cycleTier()`** advances to the next tier in `CYCLE_ORDER`, wrapping after `unhinged`. Internally calls `setTier`.
- The Provider exposes `{ tier, setTier, cycleTier }`. Consumers that only need to read the tier should still call `usePersonality()` — there's no separate `useTierValue()`.

### Data shape for tier-scoped pools

**Chosen** — flat slot key, nested tier map:

```ts
// translations.ts (RU block, abbreviated)
greetingVariantsMorning: {
  wholesome: [ /* 10 existing RU lines, unchanged */ ],
  sarcastic: [ /* 10 new RU lines */ ],
  unhinged:  [ /* 10 new RU lines */ ],
},
// same shape for greetingVariantsAfternoon, greetingVariantsEvening, headlineVariants
```

**Rationale.** Smallest change to the existing access pattern: `rotateVariant('morning', t.greetingVariantsMorning[tier])`. Adding a fourth tier later is a single nested key. Considered and rejected:

- **Flat keys** (`greetingVariantsMorningWholesome`, `…Sarcastic`, `…Unhinged`). Triples the key count in `translations.ts` and forces an opaque switch in `pickGreetingPool`.
- **Inverted tier-first** (`t.personality[tier].morning`). Unnatural lookup order — every consumer of the slot already knows the slot first.

### Architecture alternatives considered (and why rejected)

| Option | Why rejected |
|---|---|
| Tier as a property on `AuthContext` | Couples a UI/style preference to identity state; bloats `AuthContext`; makes logout-on-bad-tier-state fragile. |
| Hook-only (`useTier()` with AsyncStorage, no Context) | No reactive re-render across the tree when tier changes. The home greeting must update the moment the picker dismisses. |
| New `PersonalityContext` mirroring `LanguageContext` | **Chosen.** Parallels the language pattern exactly; keeps concerns separated. |

---

## 3. UI components

### `TierChip`

**Shape.** Pill matching `LangSwitchV2`'s height (≈24–26px tall) so the two sit cleanly in the same chip row.

**Visual states.**

| Tier | Background | Border | Label color | Icon |
|---|---|---|---|---|
| `wholesome` | `V2.surface` (neutral) | `V2.border` | `V2.textMuted` | `○` (small ring) |
| `sarcastic` | warm gradient (amber → pink, low intensity) | `rgba(255,170,77,.45)` | amber | `✨` |
| `unhinged` | same gradient, intensified, with a soft glow shadow | `rgba(255,170,77,.7)` | warm cream | `🔥` |

The Wholesome state is deliberately quiet so the default home never *implies* spicy is on. Sarcastic and Unhinged escalate visibly so the user feels the change.

**Interactions.**

- **Tap (`onPress`)** → `cycleTier()`. Predictable, snappy, no extra screen. With only three stops the cycle is tolerable.
- **Long-press (`onLongPress`, ≥400ms)** → opens `TierPickerSheet`. Power users and the cautious first-time user get a deliberate previewable selection without having to commit.
- **Haptic** on every change — light impact. Uses RN core `Vibration.vibrate(10)` to avoid a new dependency. Respects system silent mode (Android: standard Vibration behavior; iOS: no-op when silent).

**Accessibility.**

- `accessibilityRole="button"`
- `accessibilityLabel` localized: e.g. RU "Личность: Sarcastic" / EN "Personality: Sarcastic"
- `accessibilityHint` localized: e.g. RU "Нажмите чтобы переключить, удерживайте чтобы выбрать" / EN "Double tap to switch, long press to pick"

### `TierPickerSheet`

**Container.** Bottom sheet built with RN core `Modal` + a bottom-anchored animated `View` — no new dependency. ≈340px tall, rounded top corners, dim backdrop. Tap backdrop to dismiss.

**Row layout.**

```
○  WHOLESOME
   «Доброе утро, Becky.»

●  SARCASTIC                       ✓
   «Доброе утро. Опять ищем машину?»

○  UNHINGED
   «Ты вернулся. Машины тоже.»
```

- Each row: radio dot + tier name + deterministic 1-line preview.
- **Preview is the first entry** of that tier's *morning* pool in the active language. Deterministic — previews must be stable so the user can compare three tiers without copy reshuffling under them.
- Tapping a row calls `setTier`, shows the selection state for ~150ms (so the user sees their choice register), then dismisses.
- Bilingual: all labels via `useLanguage().t`; previews from the active-language pool.

**Accessibility.**

- Sheet container has `accessibilityViewIsModal={true}` on iOS, equivalent on Android.
- Each row: `accessibilityRole="radio"`, `accessibilityState={{ selected: tier === rowTier }}`, label = "Tier name. Example: <preview>". Announces correctly under VoiceOver/TalkBack.

---

## 4. Greeting consumption (wiring tier into rotation)

### Current flow (HomeScreenV2.tsx, lines 52–82, 179–186)

```ts
function pickGreetingPool(t): { slot, pool: string[] } {
  const slot = currentGreetingSlot();
  const pool =
    slot === 'morning'   ? t.greetingVariantsMorning :
    slot === 'afternoon' ? t.greetingVariantsAfternoon :
                           t.greetingVariantsEvening;
  return { slot, pool };
}

const { slot, pool } = pickGreetingPool(t);
rotateVariant(slot, pool);
rotateVariant('headline', t.headlineVariants);
```

### New flow

```ts
function pickGreetingPool(t, tier: PersonalityTier): { slot, pool: string[] } {
  const slot = currentGreetingSlot();
  const tieredPool =
    slot === 'morning'   ? t.greetingVariantsMorning[tier] :
    slot === 'afternoon' ? t.greetingVariantsAfternoon[tier] :
                           t.greetingVariantsEvening[tier];
  return { slot, pool: tieredPool };
}

const { tier } = usePersonality();
const { slot, pool } = pickGreetingPool(t, tier);
rotateVariant(slot, pool);
rotateVariant('headline', t.headlineVariants[tier]);
```

`rotateVariant` itself is **untouched** — it still takes `(slot, pool)` and returns a string. Tier just determines which pool flows in.

### Re-rotation triggers — adding tier change as a 5th trigger

Existing triggers in `HomeScreenV2`:

1. Initial mount (via lazy `useState` initializer)
2. Language change (`langMountRef` pattern)
3. Screen regains focus (`focusMountRef` pattern)
4. App returns from background to foreground (`AppState` listener)
5. Pull-to-refresh (`onRefresh`)

**New (5th-by-position, 6th-by-count) trigger** — tier change, modeled after the language effect:

```ts
const tierMountRef = useRef(true);
useEffect(() => {
  if (tierMountRef.current) { tierMountRef.current = false; return; }
  rotate();
}, [tier, rotate]);
```

`rotate`'s `useCallback` dependency array grows from `[t]` to `[t, tier]` so it closes over the current tier whenever called.

### Anti-repeat registry — intentionally left as-is

The module-scope `lastIndexBySlot` registry in `src/utils/greetingVariants.ts` is keyed by slot, not slot+tier. After a tier switch this can technically skip a *Sarcastic* index because the previous *Wholesome* line happened to share that index. The distribution skew across a 10-line pool is one position at random — imperceptible — and the content is fresh anyway (different tier). **YAGNI for v1.** Documented in §9 as a follow-up if real users notice.

### `GreetingBlock`

No change. It still receives `timeOfDay`, `subject`, `headline`, `listingsCount`, `listingsNoun`, `trailing`. The `trailing` slot just receives `<><TierChip /> <LangSwitchV2 ... /></>` instead of just `<LangSwitchV2 ... />`.

### Note on `timeOfDayKey` (lines 35–40)

`timeOfDayKey()` is defined but never called anywhere in the file (verified by grep). It returns the literal `t.goodMorning` / `t.goodAfternoon` / `t.goodEvening` (the static labels) — predates `pickGreetingPool` / `rotateVariant`. **Out of scope for this spec.** Removal is a separate trivial PR if desired.

---

## 5. Copy strategy & rollout

### Authoring path

- **Wholesome copy is unchanged.** The 40 existing lines (4 slots × 10 lines) in each language become the `wholesome` slice as-is. No regression risk to the live experience.
- **Sarcastic and Unhinged are net-new.** 4 slots × 10 lines × 2 tiers × 2 languages = **160 new lines.**
- **Claude drafts** at authoring time (in this session or a follow-up). Drafts live on the implementation branch in `translations.ts` and are reviewed in-place before the branch merges to `main` — there is no separate copy-staging file.
- **Tone-review gate** (handoff §3.3, non-negotiable): the product owner reviews each tier × language pool as a unit. The implementation branch does not merge until both Sarcastic and Unhinged pools have been signed off in both RU and EN.

### Sheet preview ordering matters

Per §3, the `TierPickerSheet` shows the **first entry** of each tier's *morning* pool as a stable preview. So the **first line** of each tier's `greetingVariantsMorning` array is intentionally chosen during the copy-review pass as the *most representative* line for that tier — not the funniest, not the spiciest, but the one that best telegraphs "this is what Sarcastic / Unhinged sounds like." Added to the copy-review checklist.

### Rollout: single atomic ship

Per §1 guardrail, all three tiers + both languages ship in **one PR** containing the context, components, HomeScreenV2 wiring, and the full reviewed copy matrix. The chip and sheet are present and live from the moment the PR merges. **No phased "ship infra now, copy later"** and no feature flag — if the copy isn't ready, the PR isn't ready.

### Tone guardrails carried into every draft

1. Punches at the car / listing / situation — never at the user's wallet, taste, or worth.
2. Bilingual parity — every line has both an RU and EN sibling, each reviewed in its own language.
3. Sarcastic and Unhinged escalate *register*, not *cruelty*. Unhinged is *theatrically* over the top, never mean.
4. No autoplay audio, no dark patterns (N/A for text-only, stated for completeness).

---

## 6. Testing

### Unit tests

- `src/context/__tests__/PersonalityContext.test.tsx`
  - Hydrates from AsyncStorage on mount.
  - Defaults to `'wholesome'` when the storage key is absent or holds an unknown value.
  - `setTier` persists to AsyncStorage.
  - `setTier` failure retains in-memory value.
  - `cycleTier` advances wholesome → sarcastic → unhinged → wholesome.
- `src/utils/__tests__/greetingVariants.test.ts` — existing tests pass unchanged (they call `rotateVariant` with literal arrays; the tier-nesting happens upstream).
- New test for `pickGreetingPool(t, tier)` in `HomeScreenV2` — for each `(slot, tier)` pair returns the correct slice.

### Manual / visual QA

- Tap-cycle through all three tiers; verify the chip updates and the home greeting visibly changes.
- Long-press → sheet opens; tap a row; selection persists across hard quit + relaunch.
- All three tiers render correctly in both RU and EN.
- Haptic fires on tap-cycle and on sheet selection; silent mode respected.
- VoiceOver (iOS) and TalkBack (Android): chip has a localized accessibility label; sheet rows are focusable, announce tier + preview, and have correct selected state.
- Regression: Wholesome looks identical to today's live experience.
- The five existing rotation triggers (mount, language, focus, foreground, pull-to-refresh) continue to work; the new tier-change trigger fires exactly once per tier change.

---

## 7. Decisions log (from brainstorm)

| # | Decision | Alternative considered | Rationale |
|---|---|---|---|
| Q1 | Spec just the Personality Tier setting (not the full P0 slice) | Spec full P0; spec tier + A1 together | Smallest unit, lowest risk, unblocks the rest |
| Q2 | Tier rebrands existing greeting pools on day one | Dormant setting (no day-one effect) | Avoids hollow-setting feel; visible payoff for the spine |
| Q3 | 3-stop tier model (Wholesome / Sarcastic / Unhinged) | 2-stop (Wholesome / Spicy) | Sarcastic is the share-bait middle gear — can't drop it |
| Q4 | TierChip on Home in greeting chip row | Settings only; Settings + one-time nudge | Max discoverability for the share-driving feature |
| Q5 | Tap = cycle, long-press = picker (hybrid) | Tap-cycle only; tap-opens-picker only | Snappy default + previewable opt-in |
| Q6 | AsyncStorage now, backend mirror later (deferred) | AsyncStorage only; backend now | YAGNI — defer backend until telemetry needs it |
| Q7 | Claude drafts both languages, owner tone-reviews per language | Block on native copywriter; ship infra + fall back to Wholesome RU | Turns a multi-month staffing blocker into a multi-day review loop |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Claude-drafted RU comedic register lands flat | Per-language tone review (§5) is gating — no merge without sign-off |
| User sees the chip and assumes the home is now spicy by default | Wholesome state is deliberately quiet (neutral surface, muted label, no icon glow) — visibly the "off" state |
| User long-presses by accident on a low-end Android | Long-press threshold ≥400ms; immediate dismissal returns the user to Home with no state change unless they tap a row |
| AsyncStorage write fails on a flaky device | In-memory value retained for the session; logged via `console.error` per app convention |
| Future tier (4th stop) is added later | Nested-tier data shape (§2) supports a single-key addition; cycle order is one-line edit |
| Live user sees the Wholesome experience regress | Existing 40 lines per language are migrated verbatim as the `wholesome` slice — no rewrite |

---

## 9. Deferred (explicitly out of v1, planned)

- **Backend mirror of `tier`** on `/api/users/:firebaseUid`. Trigger: when telemetry or CarEx Wrapped (handoff E1) needs cross-device tier data. Migration plan: add `personalityTier` to the user document with a default of `'wholesome'`; on first device sync after upgrade, push the local tier to the backend; backend value wins on subsequent hydrates.
- **Slot+tier-keyed anti-repeat registry** in `greetingVariants.ts`. Trigger: real user signal that post-switch greetings feel stale. Fix: change `lastIndexBySlot` key from `slot` to `${slot}|${tier}`. ≈10-line change.
- **Telemetry** for tier adoption + distribution + sheet open rate (handoff §6 metrics). Separate spec — depends on this one shipping.
- **A1 Listing POV monologues** consuming the tier. Separate spec — depends on this one shipping.
- **D1 Shareable branded listing card** rendering tier-flavored copy. Separate spec — independent of this one's data model but synergistic.
- **Settings-screen entry point** on Profile. If user research shows chip-only entry is discoverable enough, this stays deferred indefinitely.

---

## 10. How to use this spec

Hand to the `writing-plans` skill (or `/gsd-plan-phase`) to produce an implementation plan covering:

1. New `PersonalityContext` + tests (independent, can start first).
2. `translations.ts` migration (mechanical, but the new keys land empty for Sarcastic/Unhinged until copy review completes).
3. `TierChip` + `TierPickerSheet` components.
4. `HomeScreenV2` wiring (provider consumption, tier-aware `pickGreetingPool`, new rotation trigger).
5. Copy authoring + per-language tone review (gating final merge).
6. Manual QA pass on both platforms.

The plan should treat the copy review pass as a hard gate before any UI is enabled in shipped builds.
