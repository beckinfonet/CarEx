# Handoff · CarEx — Home & Search (Option C, Editorial)

## Overview
This package is the **final spec for Option C** of the CarEx home redesign, plus the matching search‑results screen. CarEx is a Russian‑language used‑car marketplace mobile app. The redesign modernises the visual language and introduces a system for **surfacing paid/promoted listings without using text labels** — promoted cars look like premium recommendations, never like ads.

Option C — "Editorial / Photo‑forward" — is the chosen direction. This bundle contains everything an implementer needs to rebuild it in the production codebase.

## About these files
The `.jsx` files in this folder are **design references created in HTML/React** — interactive prototypes that document intended look and behaviour. They are **not production code to ship**. The task is to recreate the screens in the existing CarEx codebase (native iOS/Android, React Native, Flutter, etc.) using its established navigation primitives, component library, and patterns.

The design tokens, layouts, and behaviour described below are the source of truth. The JSX is the second source of truth for exact pixel values — read it when you need a specific number.

## Fidelity
**High‑fidelity.** Final colours, typography, spacing, sizing, radii, gradients, animations and interactions are all decided and documented below. Photography is placeholder (Unsplash CDN URLs in the JSX) — replace with the production image pipeline.

---

## Screenshots
Captured at 402 px design width.

| File | Shows |
|---|---|
| `screenshots/01-option-C-home.png` | Top of home — sticky search pill, greeting, hero featured card (promoted, BMW X5) |
| `screenshots/02-option-C-home.png` | Smart shelf "Свежие предложения" + start of "Больше предложений" feed with the **BIG promoted tile** (Porsche Macan) |
| `screenshots/03-option-C-home.png` | "Больше предложений" continues — **SMALL organic tiles** (BMW X3, Genesis G80, Tesla Model 3, Range Rover, Mazda CX‑9) |
| `screenshots/04-option-C-home.png` | Bottom of feed — loader + sticky bottom dock |

The search‑results screen is documented below but not screenshotted in this bundle; the JSX is the spec.

---

## Screens

### 1 · Home — Editorial (`carex-editorial.jsx`)
**Purpose:** Discovery‑first home. The user browses fresh inventory, sees personalised matches, and scrolls into deeper recommendations. Top‑to‑bottom anatomy:

1. **Status bar** — system, 54 px reserved.
2. **Floating search pill** — sticky 12 px from top. 48 px tall, full width minus 36 px (18 px side margins). Glass: `rgba(19,21,27,0.85)` background + 20 px backdrop blur, 999 radius. Search icon + placeholder *"Что вы ищете?"* + trailing 36 px circular blue filters button.
3. **Greeting block** (16 22 6 padding)
   - Kicker: `"Доброе утро · Москва"` — 12 px UPPERCASE, 0.12em tracking, muted colour.
   - Headline: `"Найдём ваше идеальное авто."` — 30 / 800 / -0.035em tracking / 1.02 line‑height, two lines.
   - Two metadata chips: *3 поиска* (bookmark icon, default surface), *12 совпадений* (sparkle icon, blue‑tinted).
4. **Hero featured card** (14 px horizontal padding)
   - 5:4 photo, 24 radius, full‑bleed photo with 180° transparent→`#08090C` gradient at 35→100%.
   - Top‑left status pill *"Сегодня"* with green pulsing dot; top‑right 4 page‑indicator pills (active = 22×4, others 6×4).
   - Bottom content: kicker (`"СВЕЖЕЕ ПРЕДЛОЖЕНИЕ"` — blue, 11 / 800 / 0.12em), make+model (26 / 800), specs subline (13 mono / muted), price (30 mono / 800), green ↓market‑delta pill, white CTA *"Смотреть"*.
   - When promoted: gold halo behind, gold border, gold ember icon at top‑right (y=56). See **Promoted listings** below.
5. **Smart shelf — "Свежие предложения"** *(was previously two shelves; the "Под ваш бюджет" shelf has been removed in this revision)*
   - Section header (18 18 12 padding): blue UPPERCASE kicker + 22 / 800 title.
   - Horizontal scroll, 11 px gap between cards, snap‑to‑start, hide scrollbar.
   - Shelf card: **168 px wide**, 4:3 photo with price overlay, info strip below (title 13 / 700, year+km 10.5 mono, optional ↓market‑delta line). Match‑score chip on photo top‑left (organic only).
6. **Vertical "Больше предложений" feed** (margin‑top 26 px)
   - Header: blue UPPERCASE kicker *"ЕЩЁ ДЛЯ ВАС"*, 22 / 800 title *"Больше предложений"*, 11.5 mono subtitle *"На основе вашей активности"*.
   - **Mixed card sizes** — see "Feed: big vs small" section below.
   - Loader at bottom: 3 dots pulsing (`1.2s ease‑in‑out`, staggered 0.16 s) + UPPERCASE caption *"ПОДБИРАЕМ ЕЩЁ…"*. Wire to pagination / infinite scroll.
7. **Bottom dock** — sticky bottom. See **Shared components** below.

#### Feed: big vs small — the size signals paid vs organic
The "Больше предложений" feed mixes **two card sizes**. Size, not a label, signals that a listing is promoted.

**BIG card · `BigFeedCard`** — used for **promoted (paid)** listings.
- Full‑width, 22 radius, **16:11 hero photo** with info overlaid on the bottom of the photo.
- Photo overlay (linear‑gradient bottom‑up from `rgba(8,9,12,0)` at 40% to `rgba(8,9,12,0.92)` at 100%).
- Top‑left: 12 px blue match‑score chip (sparkle icon + `{match}% совпадение`) on a `rgba(8,9,12,0.55)` blurred pill.
- Top‑right: 36 px circular heart button (filled red `#ff5d7a` when saved).
- Top‑right at y=52: **gold ember icon** — 28 px circular gradient badge with flame glyph, pulsing `shimmer` animation. Decorative — never a label.
- Bottom overlay: make+model 20 / 800, specs row 12 mono, price 24 mono / 800, optional green ↓market‑delta pill, white pill CTA *"Открыть ▸"*.
- Photo filter: `saturate(1.16) contrast(1.04) brightness(1.03)` for the promoted "pop".
- Optional gold halo behind (radial gradient, blurred 18 px, intensity‑driven — see Promoted listings).

**SMALL card · `SmallFeedCard`** — used for **organic** listings.
- Horizontal layout: `124 px square photo (1:1) | info`. 16.5 radius, 1 px `border` outline, 11 px gap between cards.
- Photo top‑left: tiny match‑score chip (sparkle + `{match}%`, 10 px font, blue‑tinted).
- Info column (padding 11 13 12):
  - Top row: title `{make} {model}` 14 / 800 (ellipsised) + year + body (11 mono / muted, ellipsised), heart button right‑aligned (28 px transparent, red when saved).
  - Mileage row: gauge icon + `{km}` (10.5 mono / muted).
  - Bottom row: price 17 mono / 800 (white, not blue), optional ↓market‑delta (10 mono, green, no pill).
- **No ember icon, no CTA button, no gold treatment** — these are intentionally muted.

**Mix rule** (current default, driven by the `promotedCount` tweak):
- `promotedCount ≥ 1` → the **first** card in the feed (`d2`, Porsche Macan) renders as Big.
- `promotedCount ≥ 3` → an **additional** Big card (`d5`, Range Rover Velar) appears further down.
- All other cards render as Small.

In production, the server‑side ranker decides which feed positions are promoted; the client just renders Big when `listing.promoted === true`, Small otherwise.

> **Design intent:** the size hierarchy mirrors the search‑results screen (same Big = paid, Small = organic pattern). Across home and search, "bigger card = promoted" reads as a consistent, label‑free signal.

---

### 2 · Search results (`carex-search-results.jsx`)
**Purpose:** User searched a query (example: *"Cadillac Escalade"*) and lands on a 25‑result list. Anatomy:

1. **Sticky header** (10 16 12 padding, blurred bg, 1 px bottom border)
   - Back button 38 px (chevron‑left, surface bg, 12 radius), title block `"Cadillac Escalade"` (19 / 800) + subtitle `"25 авто · Москва и регион"` (11.5 mono), bookmark button 38 px (blue‑tinted when saved).
   - **Market stats strip** below: 3‑cell grid (Ср. рынок $58.4k · Год '17—'24 · Пробег 2—142k). 12 radius outer, 1 px border outline, each cell has 9 / 800 / 0.10em UPPERCASE label + 13 mono value.
2. **Filter chip row** — horizontal scroll, 7 px gap. First chip is *Фильтры* with sliders icon. Then category chips: Год '19+, До $80k, SUV, Автомат, Бензин. Active = blue tint with "✓" prefix.
3. **Hero result** *("⭐ Лучшее совпадение")* — same anatomy as the home hero but 16:11 aspect and a 96% match‑score chip top‑left. The prime promoted slot.
4. **Sort row** — *ВСЕ РЕЗУЛЬТАТЫ* left, *По релевантности ▼* dropdown right.
5. **Result list** — 9 px gap, 16.5 radius cards. **Big vs Small here too** — the same paid/organic pattern as the home feed. Promoted result = full Big card. Organic results = Small `130 px photo (1:1) | info` row with match score top‑left.
6. **Load more** — dashed‑border button *"Показать ещё 17 объявлений"* at the bottom.
7. **Bottom dock**

---

## Design tokens

### Colours
```
/* Surfaces */
bg          #08090C
surface     #13151B
surfaceHi   #1C1F28
surfaceLo   #0E1015

/* Borders */
border      rgba(255,255,255,0.06)
borderHi    rgba(255,255,255,0.14)

/* Text */
text        #F6F7FB
textMuted   rgba(246,247,251,0.62)
textFaint   rgba(246,247,251,0.38)

/* Brand & accents */
blue        #4DA3FF
blueDeep    #1C5FC4
blueGlow    rgba(77,163,255,0.42)
gold        #FFD166       ← promoted-listing visual treatment ONLY
goldGlow    rgba(255,209,102,0.40)
green       #67E8B6       ← price-below-market badge
red         #FF7A8E       ← errors / urgent
favorite    #FF5D7A       ← heart-filled state
```

### Typography
- **Display + body:** Manrope (Google Fonts), weights 400/500/600/700/800. Body letter‑spacing −0.01em; display −0.025em to −0.035em.
- **Numerics & specs:** JetBrains Mono (Google Fonts), weights 500/600/700. Used for prices, mileage, year, market stats. Letter‑spacing −0.02em.

Type scale:
| Token | Size / weight / tracking / line‑height | Used for |
|---|---|---|
| Display XL | 30 / 800 / −0.035em / 1.02 | Greeting headline |
| Display L | 26 / 800 / −0.03em / 1.05 | Hero make+model |
| Display M | 22 / 800 / −0.028em / 1.05 | Section titles |
| Title | 20 / 800 / −0.025em / 1.05 | Big feed card title |
| Title sm | 14 / 800 / −0.02em | Small feed card title |
| Body | 14 / 700 / −0.02em | Chips, search placeholder |
| Caption | 11.5 mono / 600 / −0.005em | Specs, meta |
| Microlabel | 10 / 800 / 0.14em UPPERCASE | Kickers |
| Stat label | 9 / 800 / 0.10em UPPERCASE | Market stats labels |

### Radii
| | |
|---|---|
| Hero card | 22–24 |
| Big feed card | 22 |
| Small feed / result row | 16.5 |
| Shelf card | 18 |
| Chip / pill | 999 |
| FAB | 50% |

### Spacing
- Page horizontal padding: **18 px** (16 px in some search‑results sections).
- Vertical gap between major sections: **18–26 px**.
- Inside cards: **11–14 px** (Small) / **16 px** (Big).

### Shadows / glows
- Hero card normal: `0 12px 30px rgba(0,0,0,0.5)`
- Hero promoted: `0 20px 50px rgba(255,209,102,0.18)` + blurred radial halo behind
- Big feed promoted: `0 14px 40px rgba(255,209,102,0.17)` + blurred halo
- FAB: `0 10px 26px rgba(77,163,255,0.42)`

### Iconography
Custom inline SVGs in `carex-app.jsx → Icon`. Stroke‑only at 1.6–2.6 weight. Names used in Option C: `search`, `sliders`, `heart`, `heart‑fill`, `home`, `plus`, `menu`, `chevron‑right`, `chevron‑down`, `gauge`, `flame`, `sparkle`, `bookmark`. Reimplement in your platform's icon set (SF Symbols, Material Symbols, Lucide all have equivalents).

---

## ★ Promoted listings system (the key business requirement)

**Goal:** surface paid placements that catch the user's eye, **without** any *"Ad"*, *"Sponsored"*, *"VIP"*, *"Реклама"* or equivalent label. Promoted cars look like premium recommendations.

### Two complementary signals
1. **Size** — paid listings render in a larger card than organic ones. Big hero on home & search; Big feed card in the "Больше предложений" mix; Big shelf card optionally with scale=1.02–1.04 inside horizontal shelves.
2. **Visual richness** — promoted cards layer a stack of subtle effects controlled by an `intensity` value (0–3):
   1. **Gold halo behind** — blurred radial `radial-gradient(ellipse at 50% 50%, rgba(255,209,102, A), transparent 70%)`, 18–20 px blur, inset from card.
   2. **Gradient inner border** — 1.5 px padding wrapper with `linear-gradient(155deg, rgba(255,209,102, A), rgba(77,163,255, A/1.7))`, child card matches with smaller radius.
   3. **Elevated surface** — `surfaceHi` (`#1C1F28`) instead of `surface`. No 1 px border on the card itself.
   4. **Vibrant photo** — CSS filter on the `<img>`: `saturate(1.16) contrast(1.04) brightness(1.03)`.
   5. **Gold price tint** — price text uses the gold token (shelf cards only).
   6. **Ember icon** — 22–30 px circular gradient badge with flame glyph, gold→orange, `#1a1308` glyph, glow `0 0 10–14px rgba(255,209,102,0.5)`. Pulses via `shimmer` 2.6 s keyframes (opacity 0.55↔0.85, scale 1↔1.04). Decorative — **never has text next to it.**
   7. **Optional drop‑shadow** — `drop-shadow(0 8–20px GLOW_SIZE rgba(255,209,102, A))`.
   8. **Slight upscaling** — 1.02–1.04 transform scale (shelf cards only).

### Intensity levels
| Level | Glow α | Scale | Use |
|---|---|---|---|
| 0 | 0 | 1.00 | Effectively off — looks organic. QA / regulator mode. |
| 1 | 0.16 | 1.00 | Subtle. Halo barely visible. |
| 2 | 0.30 | 1.02 | **Default.** Clear lift without being obnoxious. |
| 3 | 0.45 | 1.04 | Maximum pop. Highest‑paying tier or premium slot. |

### Placement strategy
Promoted listings live in **three contexts**, each with different prominence:
- **Hero slot** (home, search results) — 1 promoted at a time. Highest CPM.
- **Shelf slot** (home shelves) — 1–2 promoted at strategic indices.
- **Feed slot** (home vertical feed, search‑result list) — **rendered as a Big card** among Small cards. At most 1 in every 5 cards. Don't cluster.

The product team should rotate placements server‑side and avoid repeating the same listing on consecutive sessions.

### Match‑score interplay
When a card is **organic**, it shows a `{N}% совпадение` match‑score chip on the photo. When **promoted**, the match score is **kept** on Big cards (it still helps the user) but the ember icon is added alongside. Never claim a paid placement has artificially inflated match — match comes from the same scorer.

### Compliance back‑pocket
Undisclosed paid placement is regulated in EU (UCPD Article 7), Russia (О рекламе ст. 5), and US (FTC native advertising guides). The codebase **must** support a feature flag that turns on a tiny disclosure label per promoted card:
- 8 px, mono, `rgba(255,255,255,0.55)`, 0.10em letter‑spacing, UPPERCASE.
- Text: `"реклама"` / `"ad"` (localised).
- Top‑left or bottom‑left of the card photo. Low‑contrast but legible — meets the letter of disclosure law without disturbing the visual hierarchy.

In the prototype this is the `showDisclosure` flag. Wire to remote config (`promoted_disclosure_enabled`) so it can be flipped per market without a release.

---

## Shared components

### Bottom dock
Sticky bottom; 8 / 8 / 28 (bottom) padding; transparent→bg gradient fade at top. Inside: 64 px‑tall pill bar, `surface` bg, 28 radius, 1 px `border` outline. Grid: `1fr 1fr 64px 1fr 1fr`. Items: Главная (home), Поиск (search), **FAB slot**, Избранное (heart), Ещё (menu).

**FAB:** absolute, centred in slot, 60 × 60, 50% radius, `linear-gradient(155deg, blue, blueDeep)` bg, 3 px solid bg‑colour border (cut‑out effect), `plus` icon 26 px stroke‑2.6 in `#04101f`, shadow `0 10px 26px blueGlow`.

Nav item: 20 px icon (stroke 2.2 active, 1.7 idle), 10 px label (700 active, 600 idle, −0.01em). Active = blue, idle = textMuted.

### Filter chip
- 32 px height, 0 11 padding, 999 radius.
- Idle: `surface` bg, `border` 1 px, white text.
- Active: `rgba(77,163,255,0.14)` bg, `rgba(77,163,255,0.35)` border, blue text, *"✓"* prefix.

### Market‑stats cell (search results header)
3‑cell grid, 1 px gap on `border` colour (visible dividers), 12 radius outer with 1 px outline. Cell: 8 / 10 padding, centred. Label 9 / 800 / 0.10em UPPERCASE, value 13 mono / 800.

---

## Interactions & behaviour

### Shelves
- Horizontal scroll, native momentum, `scroll-snap-type: x mandatory`, snap‑align start on each card.
- Hide scrollbars.
- Promoted shelf cards: `transform: scale(1.02–1.04)` with 250 ms ease.

### Favourite toggle
- Heart icon button in the corner of every card.
- Tap → toggle local state, animate icon to `heart‑fill` (`#FF5D7A`).
- Persist to server. Immediately reflect on every other instance of the listing (carousel + feed + search results).

### Search
- Tap pill → push search screen with keyboard auto‑focus and recent searches (out of scope of this bundle).
- After search → search‑results screen (Screen 2).

### Filter chips (search results)
- Tap → optimistic toggle, then refetch results.
- Leading *"Фильтры"* chip opens a full‑screen filter sheet (out of scope — reuse existing if present).

### Sort dropdown
- Tap → menu sheet: *По релевантности*, *Цена ↑*, *Цена ↓*, *Сначала новые*, *Сначала с пробегом ↑*.

### Load more
- Search results *"Показать ещё N"* — explicit batch reveal, not infinite scroll. Tap loads next page, then transforms into a loading state.
- Home feed loader — wired to infinite‑scroll trigger. Show pulsing dots while fetching, hide when new page renders.

### Hero pagination
- The hero featured card has 4 page indicators (top‑right). Implement as a 4‑slot rotator with horizontal swipe gestures **or** 5‑second auto‑advance with pause‑on‑hover. Use IntersectionObserver to pause auto‑advance when the user is looking at it.

### Card press
- Whole card is a tap target. On press: `transform: scale(0.99)`, 200 ms ease. On release: scale back, navigate to listing detail.

### Promoted analytics
- `promoted_impression` when a promoted card enters viewport (>50% visible for >500 ms).
- `promoted_click` on tap.
- `promoted_dismiss` if user swipes‑to‑dismiss or scrolls past quickly (<200 ms in viewport).
- Server should rotate promoted creatives per impression budget; don't burn impressions on cards the user never sees.

---

## State / data shape

### Listing object
```ts
{
  id: string,
  make: string,           // "Cadillac"
  model: string,          // "Escalade"
  year: number,           // 2021
  km: string,             // "28 000 км" (pre-localised)
  body: string,           // "Кроссовер" | "Седан" | "Минивэн" | ...
  fuel?: string,
  trans?: string,
  trim?: string,
  price: number,          // 62500 (USD numeric)
  priceDelta: number,     // 2100 (positive = below market; 0 = at/above)
  match: number,          // 0–100
  promoted: boolean,      // ← drives Big vs Small in feed/list
  promotedTier: 1|2|3,    // controls visual intensity
  photo: string,          // CDN URL
  photoAlt?: string,
  posted: string,         // pre-localised "2 ч назад"
  postedAt: ISO8601,
  faved: boolean,
}
```

### App state
- Current language (RU | EN).
- Current city (auto‑detected, user‑overridable).
- Favourites set (synced).
- Saved searches list.
- Active filters (per screen).
- Feature flags: `promoted_disclosure_enabled`, `promoted_max_intensity` (0–3).

---

## Assets
- **Fonts:** Manrope, JetBrains Mono — both Google Fonts, free. Bundle via `@font-face` or the platform's font manager.
- **Photos:** All car photos in the prototypes are Unsplash placeholders (URLs in the JSX). **Replace with the production image CDN** — the Unsplash URLs must not ship.
- **Icons:** Inline SVG `Icon` component in `carex-app.jsx`. Reimplement in your icon system.
- **Brand:** keep the existing CarEx wordmark / logotype.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `README.md` | This document. The spec. |
| `screenshots/` | Reference captures of the home screen (4 progressive scroll positions at 402 px width) |
| `carex-editorial.jsx` | **Source of truth for the home screen** — design tokens (`E`), all card components (`HeroFeatured`, `SmartShelf`, `ShelfCard`, `BigFeedCard`, `SmallFeedCard`), `EditorialDock`, and the main `CarExEditorial` composition |
| `carex-search-results.jsx` | **Source of truth for the search‑results screen** |
| `carex-app.jsx` | **Shared `Icon` component** referenced by both Editorial and Search Results. The `T` design tokens and `CarExApp` component in this file are from Options A/B and are not used by Option C — ignore them. |
| `tweaks-panel.jsx` | Designer‑only tweak controls (intensity slider, etc). **Drop when implementing.** |

When implementing Option C, the active components live in `carex-editorial.jsx` and `carex-search-results.jsx`. `carex-app.jsx` is included only because its `Icon` component is shared.

---

## Out of scope
The following screens / flows are **not** in this redesign and are assumed unchanged from the current production app:
- Onboarding / auth
- Listing detail page (the screen the user lands on after tapping a card)
- *"Продать авто"* flow (the FAB destination)
- Favourites screen
- Profile / Ещё screen
- Search input screen with keyboard + recent searches
- Full‑screen filter sheet (used from the search‑results filter chip)
- Sort menu sheet
- Push notifications, deep links, analytics plumbing

Request a separate handoff if any of these need a refresh too.

---

## Questions for the design team
If anything below is ambiguous when you start implementing, ask before coding:
- **Tier → intensity mapping:** how does the ad‑buy product translate paid tier into `intensity` (1 / 2 / 3)?
- **Promoted‑card cap per scroll session?** (Recommend: max 3 in viewport across all surfaces.)
- **Market‑delta source:** who calculates *"ниже рынка на $X"* — server or client?
- **Match‑score source:** same question.
- **"Сегодня" status pill on hero** — what defines "fresh"? Posted in last 24 h? Last 6 h?
- **Feed mix ratio:** the current default puts 1 Big promoted at the top of the feed and (when tier ≥ 3) a second one further down. Is that the right ratio for the production ranker, or should the spec be tighter (e.g. "every Nth position is promoted")?

---

## Revision log
- **v2** (current) — Removed the *"Под ваш бюджет"* shelf from the home. Replaced the uniform feed‑card grid in *"Больше предложений"* with a **Big + Small mix**: Big = promoted (paid), Small = organic. The Big/Small pattern mirrors the search‑results screen so paid‑vs‑organic reads consistently across the app.
- v1 — Initial Option C handoff with three shelves and uniform feed cards.
