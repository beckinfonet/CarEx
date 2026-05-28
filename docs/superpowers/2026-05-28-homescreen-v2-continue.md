# HomeScreen v2 — Continuation Handoff

**Session paused:** 2026-05-28
**Reason:** A few bugs need fixing before merging to main. Context cleared between sessions.
**Branch:** `feat/homescreen-v2-toggle` (pushed to origin, 37 commits ahead of main)
**Do NOT merge to main yet.**

---

## Resolution log — 2026-05-28 (later session)

All blocker bugs fixed in a follow-up session. **Merge to main approved by operator.**

| # | Bug | Resolution | Commit |
|---|-----|------------|--------|
| 4 | FloatingSearchPill scrolled away with the feed | Hoisted out of FlatList `ListHeaderComponent` into a sibling of the FlatList inside SafeAreaView | `9020cf1` (260528-c4q) |
| 3 | EditorialDock FAB visually off / "Ещё" navigated to Profile instead of opening a popup | First tried numeric FAB alignment (260528-cfe `8240dfe` — superseded), then swapped EditorialDock for the v1 BottomBar verbatim per operator preference | `bc7c80e` (260528-cr4) + `8836ca7` cleanup |
| — | BottomBar clipped by iPhone home indicator after the swap | Added `'bottom'` to SafeAreaView edges in HomeScreenV2 | `4eccbda` (gsd-fast) |
| 2 | RU/EN language toggle removed in v2 | New `LangSwitchV2` v2-tokens-styled pill component; placed in `GreetingBlock`'s `chipRow` to share a row with the "50 объявлений" pill (matching pill heights). Earlier iterations placed it above GreetingBlock (260528-d9a `555cb40` — superseded) and inside FloatingSearchPill (260528-dj9 `8486f4c` — superseded) | `d047081` (260528-dqz) |
| 1 | v2 search pill navigated to a page instead of presenting the v1-style dropdown | Operator opted to keep SearchResultsV2 as a dedicated search page (for future paid content + refined search); added v1 `MakeModelFilterBar` dropdown picker inside SearchResultsV2 and wired Android `BackHandler` to `navigation.goBack()`; chevron-back preserved | `cd56521` (260528-evg) |
| 1b | HeroRotator cards clipped on the right when swiping | `marginHorizontal: -18` on rotator wrapper to negate parent `paddingHorizontal: 18`; pages now snap to full screen width | `c5592db` (gsd-fast) |

### Quick-task artifacts under `.planning/quick/`
- `260528-c4q-make-floatingsearchpill-sticky-at-top-of/`
- `260528-cfe-align-center-fab-in-editorialdock-with-s/` (superseded by cr4)
- `260528-cr4-swap-editorialdock-for-v1-bottombar-in-h/`
- `260528-d9a-re-add-ru-en-language-toggle-to-v2-home-/` (superseded by dj9 → dqz)
- `260528-dj9-inline-langswitchv2-into-floatingsearchp/` (superseded by dqz)
- `260528-dqz-move-langswitchv2-to-greetingblock-chipr/`
- `260528-evg-add-makemodelfilterbar-android-back-hand/`

### Still NOT in the branch (intentionally, per original handoff)
- Font binaries (`src/assets/fonts/README.md` documents the download)
- Manual UAT runbook completion (`docs/superpowers/uat/2026-05-28-homescreen-v2-uat.md`) — operator confirmed each fix interactively during this session
- Promoted-listings backend (out of scope per spec §13)
- The `EditorialDock` component file is left in place as dead code (unused but kept for possible v2 design revival)

### Test status at merge time
- Component-level tests for `FloatingSearchPill` and `GreetingBlock` still pass after the new optional `trailing` prop work — no test file edits were made
- Pre-existing failing test `__tests__/App.test.tsx` (`Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined`) remains untouched — already failing on main before this branch, deferred separately

---

## Where we are

The implementation plan at `docs/superpowers/plans/2026-05-28-homescreen-v2-toggle.md` was executed task-by-task. All 28 execution tasks (Phases 0–4) plus the UAT runbook (Phase 5) shipped as atomic commits. The spec is at `docs/superpowers/specs/2026-05-28-homescreen-v2-toggle-design.md`.

### What lands in this branch
- `useHomeListings` hook extracted from `HomeScreen.tsx` (data + filters single source of truth)
- `UIVersionContext` + `useUIVersion` + `useTypography` hooks (AsyncStorage-backed, default `'v1'`)
- 15 v2 components under `src/components/home/v2/` (FloatingSearchPill, GreetingBlock, HeroCard, HeroRotator, ShelfCard, SmartShelf, SmallFeedCard, BigFeedCard, FeedLoader, EditorialDock, ActiveFilterChips, V2InviteBanner, MarketStatsStrip, FilterChipRow, SortSheet) + `v2/theme.ts`
- `HomeScreenV2` + `SearchResultsV2` + their routers, wired into `App.tsx`
- `CarDetailsScreen` respects `useTypography()` (Manrope/JetBrainsMono on v2, system font on v1)
- `AccountSettingsScreen` has the "Внешний вид" v1↔v2 toggle row + a `__DEV__` reset-onboarding action
- `V2InviteBanner` mounted at top of v1 `HomeScreen`, one-shot per device
- 37 new RU+EN translation keys
- `react-native-linear-gradient` installed + pod install run + jest mock added
- `react-native.config.js` updated with `assets: ['./src/assets/fonts/']`
- Self-contained reanimated stub in `jest.setup.js` (replaces the upstream ESM mock entrypoint that broke once App.tsx pulled reanimated transitively)
- Phase-4 guardrail test in `__tests__/moderation.e2e.integration.test.tsx` bumped from 19 → 20 production deps

### What does NOT land in this branch
- **Font binaries.** `src/assets/fonts/README.md` documents what to download. Until the eight `.ttf` files are placed and `npx react-native-asset` is run, v2 will render with system fonts (everything else works fine — toggle, layout, gradients, dock, banner, etc.).
- **Manual UAT.** Runbook is at `docs/superpowers/uat/2026-05-28-homescreen-v2-uat.md` — iOS + Android checklists. Has not been executed yet.
- Promoted-listings backend (`promoted` / `match` / `priceDelta` flags) — explicitly out of scope per spec §13. The `BigFeedCard` component is built but renders zero times until the backend lights up `listing.promoted === true`.

### Tests at handoff time
- 245 pass / 1 fail. The single failure is `__tests__/App.test.tsx` (`Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined`) — this is **pre-existing** and unrelated to this branch (was already failing on main).

---

## Open bugs to fix next session

> Fill in known issues here before the next session, or surface them as you discover them in UAT.

- [ ] _(bug 1)_
- [ ] _(bug 2)_
- [ ] _(bug 3)_

---

## How to resume

```bash
cd /Users/beckmaldinVL/development/mobileApps/carEx
git checkout feat/homescreen-v2-toggle
git pull origin feat/homescreen-v2-toggle   # in case of pushed fixes
```

1. **If fonts haven't been added yet**, drop the eight `.ttf` files into `src/assets/fonts/` per `src/assets/fonts/README.md`, then `npx react-native-asset`, then clean rebuild iOS (`rm -rf ios/build && npm run ios`) and Android (`npm run android:clean && npm run android`).
2. **To exercise v2 in the app:**
   - Open the app on v1 (default).
   - Open the invite banner at the top of Home and tap "Попробовать" — switches to v2.
   - OR navigate to AccountSettings → "Внешний вид" → "Новый (бета)".
3. **Run tests at any time:** `npm test`. Baseline is 245 pass / 1 pre-existing fail.

---

## Useful file paths

- Spec: `docs/superpowers/specs/2026-05-28-homescreen-v2-toggle-design.md`
- Plan: `docs/superpowers/plans/2026-05-28-homescreen-v2-toggle.md`
- UAT runbook: `docs/superpowers/uat/2026-05-28-homescreen-v2-uat.md`
- Design handoff: `docs/design-handoff/` (README, JSX, screenshots)
- v2 components: `src/components/home/v2/`
- v2 screens: `src/screens/HomeScreenV2.tsx`, `src/screens/SearchResultsV2.tsx`
- Routers: `src/screens/HomeScreenRouter.tsx`, `src/screens/SearchResultsRouter.tsx`
- Context: `src/context/UIVersionContext.tsx`
- Hooks: `src/hooks/useHomeListings.ts`, `src/hooks/useTypography.ts`
- v2 theme tokens: `src/components/home/v2/theme.ts`

---

## Branch state on push

```
b4a0d91 docs(uat): HomeScreen v2 + toggle manual UAT runbook  <- HEAD
d44b8e0 feat(home): add V2InviteBanner to v1 Home
fb99410 feat(settings): add 'Внешний вид' v1/v2 toggle row + DEV reset action
692a89b feat(car-details): respect useTypography for v2 font parity
781ae8c feat(search-v2): mount SearchResults route in stack
5790314 feat(search-v2): add SearchResultsRouter
3986db9 feat(search-v2): compose SearchResultsV2
8dfb3e9 test(jest): self-contained reanimated stub (replace ESM mock entrypoint)
2c27cce feat(home-v2): route Home through HomeScreenRouter
89b13d0 feat(home-v2): add HomeScreenRouter
ff4d27a feat(home-v2): compose HomeScreenV2
6e085c2 feat(search-v2): add SearchResults route to navigation type
357e238 i18n(home-v2): add RU+EN keys for v2 home and search
0496472 feat(search-v2): add SortSheet
e243c63 feat(search-v2): add FilterChipRow
0fbd86d feat(search-v2): add MarketStatsStrip
8bde5a9 feat(home-v2): add V2InviteBanner
8176368 feat(home-v2): add ActiveFilterChips
b3ab340 feat(home-v2): add EditorialDock (3-slot restyle)
40a2318 feat(home-v2): add FeedLoader (pulsing dots)
b711573 feat(home-v2): add BigFeedCard (dormant until backend promoted flag)
ab64165 feat(home-v2): add SmallFeedCard
e0ecbfa feat(home-v2): add SmartShelf
7a40ab5 feat(home-v2): add ShelfCard
2bc392f feat(home-v2): add HeroRotator
bc14b51 feat(home-v2): add HeroCard
91cb78e feat(home-v2): add GreetingBlock
03d7cfb feat(home-v2): add FloatingSearchPill
6942156 feat(home-v2): add v2 design token bag
e3f1bb3 build(linear-gradient): add react-native-linear-gradient dep + jest mock
45f78ff build(fonts): add react-native.config.js + font-asset README
278cad3 feat(ui-version): mount UIVersionProvider in App.tsx
0750a7a feat(ui-version): add useTypography hook
96c0773 feat(ui-version): add UIVersionContext + useUIVersion hook
24d570f refactor(home): consume useHomeListings; preserve v1 behavior
64304cd feat(home): extract useHomeListings hook from HomeScreen
6beee75 test(home): characterization tests for useHomeListings extraction
```
