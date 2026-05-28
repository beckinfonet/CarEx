# Design: HomeScreen v2 (Editorial) with v1↔v2 Toggle

**Date:** 2026-05-28
**Status:** Approved for planning
**Scope:** v2 Home + v2 Search results, with a per-device toggle to switch back to v1.

---

## 1. Context & goal

The design team delivered a high-fidelity "Option C — Editorial / Photo-forward" handoff (committed to this repo at `docs/design-handoff/`) for a refreshed Home + a new Search Results screen. The handoff includes a full token system, component-level JSX references, and a "promoted listings" placement strategy where **card size (Big vs Small) is the only signal of paid placement** — no `Ad` / `Sponsored` / `VIP` / `Реклама` labels.

CarEx has existing customers in production. Forcing the redesign on them risks regressions of muscle memory and complaints. The product decision is to **preserve the current Home screen as v1, ship the redesign as v2, and let each user choose** via a Settings toggle. New users default to v1 too (conservative); we promote v2 only via a one-shot opt-in banner on Home.

The redesign is **strictly cosmetic for this milestone**. No backend changes. Promoted listings is part of the long-term plan; for now the *components* support the size-as-promotion hierarchy, but no listing has `promoted: true` so everything renders organic-style (Small in feeds, organic-sort in Hero). The system is wired so promoted listings will "light up" automatically when the backend grows that flag in a future phase.

## 2. Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Toggle placement | Settings row **+** one-time Home invite banner | Discoverable for existing users without nagging |
| New deps | `react-native-linear-gradient` + Manrope/JetBrainsMono font assets (no BlurView) | 80% fidelity; one fewer native lib to manage |
| Hero behavior | Swipe-only rotator, 3–5 cards, no auto-advance | Simpler; no visibility-tracking worklets |
| Hero data source | `displayedCars` sorted `(promoted desc, createdAt desc)`, top N | Falls back to "newest" today; promoted lights up automatically later |
| Bottom dock | Keep v1 3-slot structure (Home · Sell-FAB · More), restyled | No new screens or tabs required |
| Milestone scope | v2 Home **and** v2 Search results | Coherent "new design" experience when toggled |
| Path interpretation | Cosmetic-faithful: **cut visual ornaments** (gold halo, ember icon, match-score chip, market-delta pill); **keep size-as-promotion structure** | Honest UI today; ornaments come back when their data sources exist |
| Architecture | Shared data hook (`useHomeListings`) + thin router screens | One source of truth for data/filters; v1 stays as a thinner version of the same code |
| Default version | `v1` for everyone (existing + new) | Conservative; revisit after invite-banner data |
| Toggle storage | AsyncStorage, device-scoped, no backend sync | Matches "no backend changes" constraint |
| CarDetails fonts | Use v2 fonts when toggle is v2 (via `useTypography()`) | Avoid typography snap on the discovery path |
| Other screens (Favorites, MyOrders, etc.) | Stay v1 in both toggle states | Applying v2 fonts to layouts not designed for them looks broken |

## 3. Architecture

### 3.1 Toggle infrastructure

`src/context/UIVersionContext.tsx`
- Provider mounted inside `LanguageProvider`, outside `NavigationContainer`.
- Exposes `{ version: 'v1' | 'v2'; setVersion(v); inviteDismissed: boolean; dismissInvite(); }`.
- Persists to AsyncStorage keys `ui_design_version` (default `'v1'`) and `ui_design_invite_dismissed_v2` (default `'false'`).
- Hydrates from AsyncStorage on mount. Until hydrated, renders children with `version = 'v1'` to prevent a flash.

`src/hooks/useUIVersion.ts` — thin `useContext` wrapper that throws when used outside the provider (matches existing `useAuth` / `useLanguage` pattern).

### 3.2 Routing

`src/screens/HomeScreenRouter.tsx`
```ts
export const HomeScreenRouter = () => {
  const { version } = useUIVersion();
  return version === 'v2' ? <HomeScreenV2 /> : <HomeScreen />;
};
```

`src/screens/SearchResultsRouter.tsx` — same shape; v1 fallback is `<HomeScreen />` (v1 has no separate search screen, so any in-app navigation that lands on `SearchResults` while in v1 just shows Home).

`App.tsx` changes:
- Add `<UIVersionProvider>` inside `<LanguageProvider>` and outside `<NavigationContainer>`.
- Existing `Home` route's `component` swaps from `HomeScreen` to `HomeScreenRouter`.
- New `SearchResults` route added to the stack, points at `SearchResultsRouter`.

The `SearchResults` route is mounted unconditionally so deep links work irrespective of toggle, but it's only ever pushed from v2 surfaces.

### 3.3 Shared data hook

`src/hooks/useHomeListings.ts` — extracted from current `HomeScreen.tsx`. Exposes:

```ts
function useHomeListings(opts?: { initialFilters?: ActiveFilters }): {
  // data
  cars: Car[];
  loading: boolean;
  refreshing: boolean;
  refresh(): void;

  // filter state
  selectedMake:     Make    | null; setSelectedMake(m):    void;
  selectedModel:    Model   | null; setSelectedModel(m):   void;
  selectedCategory: number  | null; setSelectedCategory(c):void;
  activeFilters:    ActiveFilters;
  filtersVisible:   boolean;        setFiltersVisible(b):  void;

  // derived
  displayedCars:    Car[];          // filteredCars + sort applied
  availableModels:  Model[];        // models present in current make-only results

  // handlers
  applyFilter(type: string, value: unknown): void;
  toggleQuickSort(filterType: 'sortPrice' | 'sortMileage'): void;
  resetQuickSort(): void;
  clearAll(): void;
}
```

Sort logic gains one new option: `sortYear: 'desc' | 'asc'` for the SearchResults sort sheet's "Сначала новые".

Pre-sort step inside the hook prepends a stable `(promoted desc, createdAt desc)` ordering so the Hero rotator and any promoted feed-card placement reads correctly when backend lights up the flag. Today this collapses to "newest first" since no listing has `promoted: true`.

The Android filter-unwind back handler stays per-screen (it reads `route.params.clearFilters` and uses `ToastAndroid`), but it calls hook setters — no logic duplication.

### 3.4 Typography helper

`src/hooks/useTypography.ts`
```ts
export function useTypography(): {
  display: string | undefined;   // 'Manrope' or undefined (system)
  mono:    string | undefined;   // 'JetBrainsMono-Medium' or undefined
  weights: { regular: '400'; medium: '500'; semibold: '600'; bold: '700'; black: '800'; };
} {
  const { version } = useUIVersion();
  return {
    display: version === 'v2' ? 'Manrope'              : undefined,
    mono:    version === 'v2' ? 'JetBrainsMono-Medium' : undefined,
    weights: { regular: '400', medium: '500', semibold: '600', bold: '700', black: '800' },
  };
}
```

Consumers:
- All v2 components — always.
- `CarDetailsScreen.tsx` — text styles read `display`/`mono` from this helper. v1 returns `undefined` (renders system fonts, no visual change); v2 returns Manrope + JetBrains Mono.
- No other screens for this milestone.

## 4. File layout

```
src/
├── context/
│   └── UIVersionContext.tsx                  [new]
├── hooks/
│   ├── useUIVersion.ts                       [new]
│   ├── useHomeListings.ts                    [new — extracted from HomeScreen]
│   └── useTypography.ts                      [new]
├── screens/
│   ├── HomeScreen.tsx                        [refactored — consumes useHomeListings]
│   ├── HomeScreenV2.tsx                      [new]
│   ├── HomeScreenRouter.tsx                  [new]
│   ├── SearchResultsV2.tsx                   [new]
│   ├── SearchResultsRouter.tsx               [new]
│   ├── CarDetailsScreen.tsx                  [edited — fontFamily via useTypography]
│   └── AccountSettingsScreen.tsx             [edited — adds "Внешний вид" row]
├── components/
│   └── home/
│       └── v2/
│           ├── FloatingSearchPill.tsx
│           ├── GreetingBlock.tsx
│           ├── HeroRotator.tsx
│           ├── HeroCard.tsx
│           ├── SmartShelf.tsx
│           ├── ShelfCard.tsx
│           ├── BigFeedCard.tsx
│           ├── SmallFeedCard.tsx
│           ├── FeedLoader.tsx
│           ├── EditorialDock.tsx
│           ├── V2InviteBanner.tsx
│           ├── ActiveFilterChips.tsx         [HomeScreenV2]
│           ├── MarketStatsStrip.tsx          [SearchResultsV2]
│           ├── FilterChipRow.tsx             [SearchResultsV2]
│           ├── SortSheet.tsx                 [SearchResultsV2]
│           └── theme.ts                      [v2 design tokens, separate from src/constants/theme.ts]
├── assets/
│   └── fonts/                                [new]
│       ├── Manrope-Regular.ttf
│       ├── Manrope-Medium.ttf
│       ├── Manrope-SemiBold.ttf
│       ├── Manrope-Bold.ttf
│       ├── Manrope-ExtraBold.ttf
│       ├── JetBrainsMono-Medium.ttf
│       ├── JetBrainsMono-SemiBold.ttf
│       └── JetBrainsMono-Bold.ttf
└── constants/
    └── translations.ts                        [edited — adds appearance + invite + sort keys]

react-native.config.js                         [new — assets: ['./src/assets/fonts/']]
App.tsx                                        [edited — adds UIVersionProvider + SearchResults route]
```

## 5. Components — v2

All in `src/components/home/v2/`. Each accepts plain data props (no direct context coupling) so they can be exercised in render tests.

### 5.1 `FloatingSearchPill`
Sticky 12px from top, full-width minus 18px side margins. Flat surface `rgba(19,21,27,0.92)` (no real blur per dep choice). Search icon + placeholder + trailing 36×36 circular blue filters button.
- `onPress` → `navigation.navigate('SearchResults', { initialQuery: '' })`
- `onFiltersPress` → opens existing `FilterModal`

### 5.2 `GreetingBlock`
- Kicker: time-of-day + city. Time-of-day computed from device hours (`< 12 → morning`, `< 18 → afternoon`, else `evening`); city hardcoded `"Москва"` / `"Moscow"`.
- Headline: `"Найдём ваше идеальное авто."` (static, localized).
- One metadata chip: `"{N} объявлений"` with live count from `displayedCars.length`.
- **Cut:** `"3 поиска"` chip (no saved-searches feature).

### 5.3 `HeroRotator`
`FlatList` horizontal, `pagingEnabled`, `snapToInterval = screenWidth`, gestures handled by RN core (no custom worklets).
- Props: `cars: Car[]` (3–5 items), `onCardPress(car)`.
- Local state: `heroIndex` for the dot indicator (updated via `onMomentumScrollEnd`).
- Dot indicator: active = 22×4 white, others = 6×4 translucent.

### 5.4 `HeroCard`
The visual atom rendered inside the rotator.
- 5:4 photo, dark gradient overlay bottom (`linear-gradient`), kicker `"СВЕЖЕЕ ПРЕДЛОЖЕНИЕ"`, make+model (26/800), year+km+body (13 mono), price (30 mono / 800), white "Смотреть" CTA.
- `"Сегодня"` pulsing-dot pill renders **only if** `createdAt` is within 24h of now. Pulsing achieved via `react-native-reanimated`.
- **Cut:** gold halo, gold border, gold kicker variant, ember/flame icon.

### 5.5 `SmartShelf`
Section header (blue uppercase kicker + 22/800 title) + horizontal `FlatList` of `ShelfCard`s.
One shelf on v2 Home: kicker `"ТОЛЬКО ЧТО ДОБАВЛЕНО"`, title `"Свежие предложения"`.

### 5.6 `ShelfCard`
168px wide, 4:3 photo with price overlay bottom-left, info strip below (title 13/700, year+km 10.5 mono).
- **Cut:** match-score chip, market-delta line, promoted scale-up / gold border.

### 5.7 `BigFeedCard`
Full-width 16:11 photo card with info overlaid on photo, white "Открыть ▸" CTA.
- Used when `car.promoted === true`. **Today: renders zero times** (no listing has the flag). Component is built and tested but inert until backend supports it.
- **Cut:** ember icon, gold halo, gold border, match-score chip, market-delta pill.
- Top-of-file comment explains the size hierarchy and dormant state.

### 5.8 `SmallFeedCard`
Horizontal 124px square photo + info column. Title 14/800, year+body 11 mono, mileage row with gauge icon, price 17 mono / 800. Heart toggles favorites via existing `AuthService` favorites endpoint (functional carry-over, not new).
- **Cut:** match-score chip, market-delta line.

### 5.9 `FeedLoader`
Three pulsing dots + `"ПОДБИРАЕМ ЕЩЁ…"` caption. Rendered when `loading && cars.length > 0`. Pagination/infinite-scroll plumbing is **not** wired — current Home fetches everything in one call; that stays.

### 5.10 `EditorialDock`
Restyled `BottomBar`, 3 slots (Главная · [FAB→SellCar] · Ещё). Pill-shaped surface with `linear-gradient` fade above the dock, circular 60×60 FAB with blue gradient. Same nav routes as current `BottomBar`.

### 5.11 `V2InviteBanner`
Renders at top of v1 `HomeScreen` when `version === 'v1' && !inviteDismissed`.
- One horizontal row: sparkle icon + `"Новый дизайн доступен"` + two text-style buttons.
- `"Попробовать"` → `setVersion('v2')` + `dismissInvite()`. Re-render flows into `HomeScreenV2`.
- `"Не сейчас"` → `dismissInvite()` only.
- Animated fade+slide-out on dismiss (200ms, via `react-native-reanimated`).
- Shown at most once per device. Toggling back to v1 from Settings does **not** revive it.

### 5.12 `ActiveFilterChips` (HomeScreenV2)
Horizontal scrollable row, rendered only when at least one of `selectedMake`, `selectedModel`, `selectedCategory`, `activeFilters` is set. One chip per active filter, each with `×` to clear via the matching hook setter. Trailing "Очистить всё" chip calls `clearAll()`. Restyled to match v2 tokens.

### 5.13 `MarketStatsStrip` (SearchResultsV2)
3-cell grid computed client-side from `displayedCars`:
- "Ср. рынок $X.Xk" — average of prices
- "Год 'YY—'YY" — min/max year (two-digit)
- "Пробег X—Xk" — min/max mileage rounded to thousands
- If `displayedCars.length === 0`, all cells show `—`.

### 5.14 `FilterChipRow` (SearchResultsV2)
Horizontal `FlatList`, 7px gap. Leading "Фильтры" chip with sliders icon opens existing `FilterModal`. Following chips reflect active filter state, tappable to clear, with checkmark prefix when active.

### 5.15 `SortSheet` (SearchResultsV2)
`Modal` sheet with 5 options: По релевантности, Цена ↑, Цена ↓, Сначала новые, Пробег ↑. Maps to `useHomeListings` setters; "По релевантности" sets no sort (uses `displayedCars` as returned from hook).

## 6. Screens — v2

### 6.1 `HomeScreenV2`

```
SafeAreaView (top edge only)
└── StatusBar (light-content)
    └── FlatList
        ├── ListHeaderComponent:
        │   ├── FloatingSearchPill                [sticky via stickyHeaderIndices]
        │   ├── GreetingBlock
        │   ├── ActiveFilterChips                 [only if any filter is set]
        │   ├── HeroRotator (heroCars)
        │   ├── SmartShelf (shelfCars)
        │   └── FeedSectionHeader
        ├── data: feedCars
        ├── renderItem: car.promoted ? <BigFeedCard/> : <SmallFeedCard/>
        ├── ListFooterComponent: <FeedLoader/> when refreshing
        ├── ListEmptyComponent: empty-state text when !loading
        └── refreshControl: pull-to-refresh
└── EditorialDock                                  [sticky bottom]
└── FilterModal                                    [overlay, reuses existing]
```

Data slicing:
```ts
const heroCars  = displayedCars.slice(0, 5);
const shelfCars = displayedCars.slice(5, 13);
const feedCars  = displayedCars.slice(13);
```
Cut points are placeholders; tune against real inventory volume during implementation. Short inventory just renders fewer items in each section.

Active filter chips: a small horizontal row below the greeting showing active filters with × per chip. v2 hides the inline filter bar behind the pill, so users need a way to see and clear what's active. Reuses tokens from `v2/theme.ts`.

### 6.2 `SearchResultsV2`

```
SafeAreaView
└── StatusBar (light-content)
    └── FlatList
        ├── ListHeaderComponent:
        │   ├── StickyHeader (back + title + subtitle)
        │   ├── MarketStatsStrip
        │   ├── FilterChipRow
        │   ├── HeroResult                        [top result as BigFeedCard]
        │   └── SortRow                            ["ВСЕ РЕЗУЛЬТАТЫ" + sort trigger]
        ├── data: visibleResults                   [client-paginated, initial 25]
        ├── renderItem: car.promoted ? <BigFeedCard/> : <SmallFeedCard/>
        └── ListFooterComponent: LoadMoreButton when revealed < total
└── SortSheet                                      [modal overlay]
└── FilterModal                                    [overlay, reuses existing]
```

Route signature added to `RootStackParamList`:
```ts
SearchResults: { initialQuery: string; initialFilters?: ActiveFilters; };
```

Title: `initialQuery` verbatim; falls back to `"Все авто"` / `"All cars"` when empty.
Subtitle: `"{N} авто · Москва и регион"` — N = `displayedCars.length`.
No bookmark button on header (saved-searches feature does not exist).

Client pagination: `revealed` local state (initial 25, batches of 25). `"Показать ещё N"` button hides when `revealed >= displayedCars.length`. Pure UI sugar — all data is already client-side.

Search results uses its own `useHomeListings({ initialFilters })` instance. This **doubles fetches** on Home → Search navigation (two independent hook instances). Acceptable for this milestone; if it becomes a problem, lift cars into a shared context later.

CarDetails screen is **not** redesigned; both v1 and v2 navigate to the existing `CarDetailsScreen` (with `useTypography()` doing the font swap).

## 7. Settings row UX

`AccountSettingsScreen.tsx` adds one new section between language and notifications:

```
Внешний вид
┌──────────────────────────────────────────────┐
│  ◉  Классический                              │
│     Привычный вид CarEx                       │
│                                               │
│  ○  Новый (бета)                              │
│     Обновлённый дизайн главной и поиска       │
└──────────────────────────────────────────────┘
```

- Tap either option → `setVersion()` immediately. No confirmation modal — switching is reversible from the same row in two taps.
- RU/EN parity via new translation keys: `appearanceTitle`, `appearanceClassic`, `appearanceClassicDesc`, `appearanceNew`, `appearanceNewDesc`.
- Selected option uses existing `COLORS.accent` border + radio icon; unselected uses surface bg.

## 8. Font integration

Files dropped at `src/assets/fonts/` (sourced from Google Fonts, free):
- Manrope: Regular, Medium, SemiBold, Bold, ExtraBold
- JetBrainsMono: Medium, SemiBold, Bold

Add `react-native.config.js`:
```js
module.exports = {
  project: { ios: {}, android: {} },
  assets: ['./src/assets/fonts/'],
};
```

Run `npx react-native-asset` once:
- iOS: writes `UIAppFonts` entries to `Info.plist`, copies files into Xcode resources.
- Android: copies files to `android/app/src/main/assets/fonts/`.

Font asset linking itself does **not** require `pod install`. iOS just needs an Xcode clean rebuild; Android needs a Gradle sync. Plan must schedule this as its own commit so the native rebuild can be verified independently of any dep changes.

Font references in styles use PostScript names: `'Manrope-Regular'`, `'Manrope-Bold'`, `'Manrope-ExtraBold'`, `'JetBrainsMono-Medium'`, `'JetBrainsMono-Bold'`, etc. Verify PostScript names with `Font Book` (macOS) before wiring them into styles — file basename and PostScript name can differ in rare cases.

## 9. Theme tokens

New file `src/components/home/v2/theme.ts`:

```ts
export const V2 = {
  bg:        '#08090C',
  surface:   '#13151B',
  surfaceHi: '#1C1F28',
  surfaceLo: '#0E1015',
  border:    'rgba(255,255,255,0.06)',
  borderHi:  'rgba(255,255,255,0.14)',
  text:      '#F6F7FB',
  textMuted: 'rgba(246,247,251,0.62)',
  textFaint: 'rgba(246,247,251,0.38)',
  blue:      '#4DA3FF',
  blueDeep:  '#1C5FC4',
  blueGlow:  'rgba(77,163,255,0.42)',
  green:     '#67E8B6',
  red:       '#FF7A8E',
  favorite:  '#FF5D7A',
  radius: { hero: 24, big: 22, small: 16.5, shelf: 18, pill: 999 },
} as const;
```

Gold tokens (`gold`, `goldGlow`) **omitted** — all gold ornaments are cut. Add back later when promoted-listing visuals come online.

`src/constants/theme.ts` (v1 `COLORS`, `SIZES`) is **not modified**; v1 components keep using it.

## 10. Translations

New keys added to `src/constants/translations.ts` (both RU and EN):

| Key | RU | EN |
|---|---|---|
| `goodMorning` | Доброе утро | Good morning |
| `goodAfternoon` | Добрый день | Good afternoon |
| `goodEvening` | Добрый вечер | Good evening |
| `findYourCar` | Найдём ваше идеальное авто. | Find your perfect car. |
| `freshOffer` | СВЕЖЕЕ ПРЕДЛОЖЕНИЕ | FRESH LISTING |
| `today` | Сегодня | Today |
| `freshOffers` | Свежие предложения | Fresh listings |
| `justAdded` | ТОЛЬКО ЧТО ДОБАВЛЕНО | JUST ADDED |
| `forYou` | ЕЩЁ ДЛЯ ВАС | MORE FOR YOU |
| `moreOffers` | Больше предложений | More listings |
| `basedOnActivity` | На основе вашей активности | Based on your activity |
| `pickingMore` | ПОДБИРАЕМ ЕЩЁ… | FINDING MORE… |
| `view` | Смотреть | View |
| `open` | Открыть | Open |
| `whatAreYouLooking` | Что вы ищете? | What are you looking for? |
| `searchPlaceholder` | Что вы ищете? | What are you looking for? |
| `listingsCount` | объявлений | listings |
| `appearanceTitle` | Внешний вид | Appearance |
| `appearanceClassic` | Классический | Classic |
| `appearanceClassicDesc` | Привычный вид CarEx | The familiar CarEx look |
| `appearanceNew` | Новый (бета) | New (beta) |
| `appearanceNewDesc` | Обновлённый дизайн главной и поиска | Refreshed Home and Search design |
| `newDesignAvailable` | Новый дизайн доступен | New design available |
| `tryNow` | Попробовать | Try it |
| `notNow` | Не сейчас | Not now |
| `marketAvg` | Ср. рынок | Avg market |
| `year` | Год | Year |
| `mileage` | Пробег | Mileage |
| `allResults` | ВСЕ РЕЗУЛЬТАТЫ | ALL RESULTS |
| `byRelevance` | По релевантности | By relevance |
| `priceAsc` | Цена ↑ | Price ↑ |
| `priceDesc` | Цена ↓ | Price ↓ |
| `newestFirst` | Сначала новые | Newest first |
| `mileageAsc` | Пробег ↑ | Mileage ↑ |
| `showMore` | Показать ещё | Show more |
| `allCars` | Все авто | All cars |
| `moscowAndRegion` | Москва и регион | Moscow and region |

## 11. Testing posture

- **Unit tests** on `useHomeListings`: filter pipeline (make/model/category/price/year/mileage/fuel/transmission combinations), sort stability, `clearAll` resets, new `sortYear` direction, `(promoted desc, createdAt desc)` pre-sort. Critical refactor surface — if these pass, v1 behavior is preserved.
- **Render smoke tests** on `HeroCard`, `ShelfCard`, `BigFeedCard`, `SmallFeedCard`: one happy-path car + one missing-fields car (no photo URL, no mileage, no createdAt). Cheap guard against undefined-property crashes.
- **No E2E** in the project today. Manual UAT on both iOS and Android covers:
  - Toggle switch (Settings v1→v2 and back) — both surfaces re-render correctly.
  - Invite banner one-shot dismissal (both buttons) persists across app restart.
  - Hero rotator swipe, dot indicator updates on `onMomentumScrollEnd`.
  - CarDetails fonts switch between v1 (system) and v2 (Manrope) based on toggle.
  - Pull-to-refresh on both Home and SearchResults.
  - FilterModal still opens from v2 surfaces.
  - Filter back-button unwind on Android in both v1 and v2.
- **Visual regression check** on v1 Home: take a "before" screenshot from the running app, complete the hook extraction commit, take an "after" screenshot, diff. If pixel-identical, v1 is safe.
- **Debug action** in Settings (gated by `__DEV__`): "Reset onboarding banner" — clears `ui_design_invite_dismissed_v2` so QA can force-show the banner.

## 12. Risks & mitigations

1. **Refactor regression on v1 Home.** Extracting `useHomeListings` could change ordering or edge-case behavior.
   - *Mitigation:* extraction in its own commit, **no v2 work yet**; verify v1 visually identical and unit tests pass before any new code lands.

2. **Native build break from font asset link.** `react-native-asset` modifies `Info.plist` and Android assets; custom pod/gradle configs can fail silently.
   - *Mitigation:* font integration in its own commit; full clean build on both platforms before merging.

3. **Inert `BigFeedCard`.** Component built and tested but renders zero times until backend grows `promoted` flag.
   - *Mitigation:* top-of-file comment in `BigFeedCard.tsx` explaining the size hierarchy and dormant state; one-line comment at the feed `.map` in `HomeScreenV2.tsx` noting `car.promoted` is always false today.

4. **Visual whiplash on un-redesigned screens.** v2 user lands in v1-styled Profile, MyOrders, etc.
   - *Mitigation:* scoped explicitly to CarDetails for this milestone. Extending the font helper to more screens is cheap if users complain.

5. **Gesture conflict on hero rotator.** Swipe vs card-tap-to-open-detail.
   - *Mitigation:* `FlatList pagingEnabled` (OS-native snap behavior, no custom gestures) + `TouchableOpacity` per card. Standard RN pattern.

6. **No QA path to force-show the invite banner.** Once dismissed, AsyncStorage key blocks it.
   - *Mitigation:* `__DEV__`-gated "Reset onboarding banner" debug action in Settings.

7. **Default "v1 for everyone" may slow v2 adoption.** Conservative by design.
   - *Mitigation:* revisit after invite-banner accept-rate data; flipping the default is a one-line change. No re-design needed.

8. **Doubled fetches on Home → Search navigation.** Two independent `useHomeListings` instances.
   - *Mitigation:* accept for this milestone; lift cars into a shared context if it becomes a problem.

## 13. Out of scope (explicit)

- Backend `promoted` / `promotedTier` / `match` / `priceDelta` / `postedAt` fields and the server-side ranker (future phase).
- Promoted-card analytics (`promoted_impression`, `promoted_click`, `promoted_dismiss`).
- Backend-synced toggle preference.
- Disclosure label (`реклама`) feature flag — no promoted listings exist.
- Auto-advance / IntersectionObserver-driven pause on the hero rotator.
- v2 redesign of CarDetails / Profile / MyListings / Favorites / Cart / SellCar / Login flows.
- 5-tab bottom dock (Search + Favorites tabs as new routes).
- New filter UI / new sort options beyond those listed.
- BlurView / true glass blur on the search pill.
- Image CDN migration (Unsplash placeholders in the JSX are reference only; production keeps existing image pipeline).
- Bug fixes / refactors / cleanups unrelated to the toggle and v2 screens.

## 14. Commit sequence (preview for the plan)

The plan will sequence work as separate atomic commits so each can be verified independently:

1. Extract `useHomeListings`; refactor `HomeScreen.tsx` to consume it. **No v2 code yet.** Verify v1 visually identical.
2. Add `UIVersionContext` + `useUIVersion` + `useTypography`. Mount provider in `App.tsx`. **No UI consumers yet.**
3. Add font assets + `react-native.config.js`; run `react-native-asset`. Clean iOS rebuild + Android Gradle sync. Render a probe `<Text style={{ fontFamily: 'Manrope-Bold' }}>` somewhere temporary to confirm font loads on both platforms.
4. `npm i react-native-linear-gradient`; `cd ios && pod install`. Add a temporary `<LinearGradient>` smoke check; remove once verified.
5. Add `home/v2/theme.ts`, atomic v2 component files one at a time (with render smoke tests each).
6. Build `HomeScreenV2` + `HomeScreenRouter`. Toggle via dev shortcut to verify v2 renders.
7. Build `SearchResultsV2` + `SearchResultsRouter`. Add route to `App.tsx` and `RootStackParamList`.
8. Wire `useTypography()` into `CarDetailsScreen`.
9. Add Settings row in `AccountSettingsScreen`. RU/EN translations.
10. Add `V2InviteBanner` to v1 `HomeScreen`. Persistence test.
11. Add `__DEV__`-gated "Reset onboarding banner" debug action.
12. Final UAT pass on iOS + Android. Update CHANGELOG / version bump per existing release scripts.
