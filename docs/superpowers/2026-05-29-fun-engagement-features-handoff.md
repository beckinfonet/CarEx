# Handoff: Fun / Personality-Driven Engagement Features

- **Date:** 2026-05-29
- **Author:** Product (with Claude)
- **Status:** Brief — ready to hand to Super Powers / GSD for planning
- **App:** CarEx (React Native + TypeScript, bilingual RU/EN, live in production)
- **Goal of this doc:** Capture the vision, guardrails, and a prioritized catalog of "make the app fun + get users posting about it" features so a planning agent can turn the chosen slice into specs → plans → UAT.

---

## 1. Why this exists (north star)

CarEx already has a working **personality layer**: time-of-day funny greetings that rotate without repeating. Users like them. The strategic bet:

> **Personality + surprise = screenshots. Screenshots = organic, free growth.**

Every feature below is judged on one question: **"Would a user screenshot this and post it?"** We are not adding features for utility — we are manufacturing shareable moments inside an app people already open to shop for cars.

A planned next step already exists: an **opt-in "unhinged" mode** (sarcastic, never profane) that punches *at the absurdity of the car/situation*, never at the user. This doc extends that direction.

---

## 2. Current state (what to build on, not around)

The existing greeting system is the architectural template for most of these features. Reuse it.

| File                                       | Role                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `src/utils/greetingVariants.ts`            | Anti-repeat random rotation (`rotateVariant(slot, pool)`); module-scope "last index per slot" registry. |
| `src/utils/greetingSubject.ts`             | Composes the kicker subject (name · city from IANA timezone). Lib-free, fail-safe.                      |
| `src/components/home/v2/GreetingBlock.tsx` | Renders kicker + headline + listings-count chip.                                                        |
| `src/constants/translations.ts`            | Editorial copy pools — **ships exactly 10 entries per slot**, RU + EN.                                  |
| `src/screens/HomeScreenV2.tsx`             | Consumes the greeting on the home screen.                                                               |

**Takeaway for planners:** the "rotate a localized line from a curated pool, don't repeat the last one" pattern is already solved and tested (`src/utils/__tests__/greetingVariants.test.ts`). New personality features should follow it rather than reinventing randomness/copy management.

---

## 3. Design guardrails (non-negotiable)

1. **Punch at the car, not the user's wallet.** Jokes target the absurd listing, the situation, or the car itself — never the user's money, taste, or worth. (The earlier "check your account first" example is the *wrong* side of this line and is explicitly out.)
2. **Spicy is opt-in, tiered, and reversible.** Default tone stays friendly. Sarcasm/unhinged is a setting the user turns on and can turn off instantly. Consider a 3-stop slider: **Wholesome → Sarcastic → Unhinged.**
3. **Bilingual from day one.** This is a Russian-primary app. Humor does **not** translate literally — every copy pool needs a native RU pass *and* an EN pass. Budget copywriting, not just `t()` keys. A joke that lands in EN can be flat or rude in RU.
4. **Never block the job-to-be-done.** Personality decorates the shopping flow; it never gates search, listing, or contact. All of it must be skippable/dismissible.
5. **No dark patterns.** "Delusion meter," roasts, etc. stay affectionate. We are making people smile, not shaming them into engagement.
6. **Accessibility + safety:** sounds/haptics respect system settings; nothing autoplays audio; all generated text is moderation-safe (especially anything AI-generated or user-submitted).

---

## 4. Feature catalog

Grouped by mechanism. Each entry: **concept · share hook · implementation sketch · effort · risk.** Effort is a rough T-shirt size for *first shippable version*.

### A. Give the cars a voice

**A1 — Listing POV monologues** ⭐ *top pick*
- **Concept:** A listing occasionally narrates itself in first person. "Я стою здесь уже 47 дней. Начал разговаривать с забором." / "I've been parked 47 days. I've started talking to the fence."
- **Share hook:** Unexpected on a *real* listing → screenshot bait. Makes stale inventory funnier instead of sadder.
- **Sketch:** New copy pool keyed by listing signals (days-on-market bucket, price-vs-segment, mileage bucket, body type). Reuse `rotateVariant`. Render as a dismissible caption on `CarDetailsScreen`. **Start fully templated (no AI).**
- **Effort:** S–M · **Risk:** Low (templated). Tone QA per language.

**A2 — Absurd backstory generator**
- **Concept:** Tap a button on a car → a short fictional history. "Previously owned by a retired clown. Used exclusively for emotional support and one bank robbery."
- **Share hook:** Each tap = a unique, forwardable artifact.
- **Sketch:** v1 = combinatorial template (owner archetype × quirk × event pools) so it's deterministic, moderation-safe, offline, free. v2 *optionally* AI-backed behind moderation if quality demands it.
- **Effort:** M · **Risk:** Med if AI (cost, moderation, latency); Low if templated.

### B. Built to be forwarded (turn the app into a messaging tool)

**B1 — "Justify it" generator** ⭐ *top pick*
- **Concept:** On a car you can't afford, generate an escalating, unhinged rationalization to text your spouse/roommate. "It's basically an investment. Cars are the new gold. Think of the memories."
- **Share hook:** The *entire point* is forwarding it to a real person → app spreads via DM, not just public posts.
- **Sketch:** Templated escalation ladder (mild → unhinged) tied to the price gap. Native share sheet with prefilled text + branded listing card image (see D1). Only surfaces above a price threshold relative to the user's browsing.
- **Effort:** M · **Risk:** Low–Med (tone; keep it about the car, not the user's finances).

**B2 — Breakup / love letters to cars**
- **Concept:** Dramatic goodbye to a car you didn't buy, or a love letter to one you keep revisiting. Templated, theatrical.
- **Share hook:** Pure performance content; designed to be posted.
- **Effort:** S–M · **Risk:** Low.

**B3 — Savage "tag a friend"**
- **Concept:** Prewritten callouts on relevant listings. "Tag the friend whose check-engine light has been on since 2022."
- **Share hook:** Tagging mechanics are native to social posting.
- **Effort:** S · **Risk:** Low (keep callouts about the *friend's car*, affectionate).

### C. Daily reasons to open

**C1 — Cursed Car of the Day** ⭐ *top pick*
- **Concept:** Surface one deliberately ridiculous *real* listing daily — worst mod, weirdest description, delusional price.
- **Share hook:** "Trainwreck" content is compulsively shared. Also a daily-open habit loop.
- **Sketch:** Lightweight curation/heuristic to nominate candidates (price-vs-segment outliers, keyword flags) → optional human/admin pick via existing admin screens (`AdminModerationScreen.tsx` etc.). Home-screen card slot.
- **Effort:** M · **Risk:** Med — must be affectionate and **must not defame/harm a real seller**. Needs a "punch at the car not the seller" copy rule + a seller opt-out path. Get legal/ToS sanity check.

**C2 — Car horoscope / daily drive forecast**
- **Concept:** "Today's drive forecast" or a "car zodiac." Novelty, zero shopping pressure.
- **Share hook:** Daily-open hook; horoscope screenshots are a known social format.
- **Effort:** S · **Risk:** Low.

### D. Gamify browsing itself

**D1 — Shareable branded listing card** *(enabler — build early)*
- **Concept:** When a user shares any car, auto-generate a clean, branded image card (photo + key specs + CarEx mark + optional personality line).
- **Share hook:** Every share becomes free marketing with attribution; also the rendering surface B1/B2/A1 share through.
- **Sketch:** Off-screen view → `react-native-view-shot` (or equivalent) → native share sheet. This is **infrastructure** that multiplies the value of every other feature — recommend building it in the first slice.
- **Effort:** M · **Risk:** Low–Med (image layout polish per locale).

**D2 — Swipe mode (hot-or-not for inventory)**
- **Concept:** Fast swipe browsing; teaches the app your taste while it's fun.
- **Effort:** M–L · **Risk:** Med (new UX surface, data wiring).

**D3 — Delusion Meter**
- **Concept:** Searching far above budget fills a playful meter; "max delusion" is an achievement worth screenshotting.
- **Guardrail:** Affectionate, about the *cars'* absurd prices, never about the user being broke.
- **Effort:** S–M · **Risk:** Med (easy to tip into wallet-shaming — copy review required).

**D4 — Two-truths-and-a-lie on a listing**
- **Concept:** App shows 3 "facts" about a car; guess the fake. Turns spec-reading into a game.
- **Effort:** M · **Risk:** Low–Med.

### E. The long-game share bomb

**E1 — CarEx Wrapped** ⭐ *high ceiling, seasonal*
- **Concept:** Spotify-Wrapped-style annual recap: cars stalked, most-viewed, your "type," delusion score, funniest moment you triggered.
- **Share hook:** One feature → a coordinated mass-posting wave (a la Spotify Wrapped) once a year.
- **Sketch:** Needs event logging in place *now* to have data later (see §6 telemetry). Build the logging early even if the recap ships in December.
- **Effort:** L · **Risk:** Med (depends on telemetry foundation + privacy review).

### F. Tactile delight (cheap, memorable)

**F1 — Rev-to-refresh**
- **Concept:** Pull-to-refresh triggers an engine-rev sound + haptic. Signature, on-brand.
- **Guardrail:** Respect silent mode / reduce-motion; never autoplay.
- **Effort:** S · **Risk:** Low.

---

## 5. Prioritized roadmap (recommendation)

**P0 — First slice (highest share-per-effort, low risk, reuses greeting engine):**
1. **Personality Tier setting** (Wholesome → Sarcastic → Unhinged) — the spine everything else hangs on; formalizes the planned opt-in unhinged mode.
2. **A1 Listing POV monologues** — templated, reuses `rotateVariant`.
3. **D1 Shareable branded listing card** — enabler that multiplies every future share.
4. **Telemetry: share + reaction events** (§6) — cheap now, unlocks E1 later.

**P1 — Fast follows:**
- **B1 "Justify it" generator**, **C1 Cursed Car of the Day**, **B3 tag-a-friend**, **F1 rev-to-refresh**.

**P2 — Bigger bets / seasonal:**
- **E1 CarEx Wrapped**, **D2 swipe mode**, **A2 backstory generator (AI v2)**, **D3 delusion meter**, **C2 horoscope**.

---

## 6. Telemetry / success metrics

The goal is **posting**, so instrument for it from the first slice:

- **Primary:** share-sheet invocations, by feature + tier; estimated outbound shares.
- **Secondary:** personality-tier adoption + distribution; reaction taps (e.g. a 😂 on a monologue); D1 card generations.
- **Habit:** DAU lift on days with daily features (C1/C2); retention of users who enabled Sarcastic/Unhinged vs default.
- **Guardrail metric:** opt-out / tier-downgrade rate (catches tone that's landing badly), and any report/flag on AI-generated or daily-cursed content.
- **Qualitative:** lightweight "was this funny?" thumbs on a sample, to keep copy pools fresh.

Even a minimal event log (`feature`, `tier`, `locale`, `action`) shipped in P0 is what makes **CarEx Wrapped** possible later.

---

## 7. Open questions for the user / planning agent

1. **Tier model:** 3-stop slider (Wholesome/Sarcastic/Unhinged) or a simple on/off "spicy mode"? Where does it live — Account Settings, or a quick toggle on Home?
2. **AI vs templated:** Are we willing to take on an AI text dependency (cost, latency, moderation) for A2/B1, or stay fully templated for v1? (Recommendation: **templated v1 everywhere**, AI only if quality demands.)
3. **Cursed Car of the Day:** acceptable to feature a *real* seller's listing as "cursed"? Need a seller opt-out + ToS/legal read before building C1.
4. **Localization budget:** who writes the RU copy? Native copywriter vs in-house. This gates *every* personality feature.
5. **Default tone:** does the *default* (opted-out) experience get gently funnier, or stay strictly neutral/professional?
6. **Sound/haptics:** is audio (F1) on-brand, or too much for a marketplace? 

---

## 8. Appendix — copy direction (illustrative only, needs native pass)

**Personality tiers, same situation (a wildly overpriced listing):**
- *Wholesome:* "Dream big — this one's a stretch, but what a stretch."
- *Sarcastic:* "Ambitious price. The car respects the confidence."
- *Unhinged:* "This price has never met a comparable listing and it shows."

**A1 Listing POV (EN / RU sketch):**
- EN: "47 days on the lot. I've named the pigeons."
- RU: «47 дней на стоянке. Я уже дал имена голубям.» *(RU is a sketch — confirm with a native copywriter; rhythm/idiom will differ.)*

> All appendix copy is **direction, not final**. Every line ships only after a per-language tone review (guardrail §3.3).

---

## 9. How to use this doc

- This is a **brief**, not a plan. Hand it to **Super Powers** (`/superpowers` brainstorming → spec → plan) or **GSD** (`/gsd-...`) to turn the chosen P0 slice into a spec under `docs/superpowers/specs/` and a plan under `docs/superpowers/plans/`.
- Recommended first command: take the **P0 slice (§5)** into a brainstorming/spec session, starting with the **Personality Tier setting** since it unblocks everything else.
