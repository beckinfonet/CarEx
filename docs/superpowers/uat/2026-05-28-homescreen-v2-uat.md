# HomeScreen v2 + Toggle — Manual UAT

**Branch:** `feat/homescreen-v2-toggle`
**Plan:** `docs/superpowers/plans/2026-05-28-homescreen-v2-toggle.md`
**Started:** _(fill in)_
**Completed:** _(fill in)_

## Prerequisites before UAT

Two prep steps are needed before v2 will render at full visual fidelity. Both are documented in the implementation but require hands-on actions on this machine.

- [ ] **Drop the eight `.ttf` font files** into `src/assets/fonts/` per the instructions in `src/assets/fonts/README.md`. Files needed:
      `Manrope-Regular.ttf` · `Manrope-Medium.ttf` · `Manrope-SemiBold.ttf` · `Manrope-Bold.ttf` · `Manrope-ExtraBold.ttf` · `JetBrainsMono-Medium.ttf` · `JetBrainsMono-SemiBold.ttf` · `JetBrainsMono-Bold.ttf`.
- [ ] Run `npx react-native-asset` to link the assets.
- [ ] Clean rebuild iOS: `rm -rf ios/build && npm run ios`.
- [ ] Clean rebuild Android: `npm run android:clean && npm run android`.

Without these, v2 will render with system fonts (everything else still works — the toggle, layout, gradient, dock, etc. — but typography will look "wrong").

---

## iOS pass

- [ ] **Cold start as v1.** Home renders identically to pre-milestone (search bar, filters, carousel).
- [ ] **Invite banner appears on v1 Home** at the top. Tap "Не сейчас" — slides up and disappears.
- [ ] Force-quit and relaunch — banner stays dismissed.
- [ ] **[DEV] Reset onboarding banner** row in Settings clears the dismissal; relaunch re-shows banner.
- [ ] **Tap "Попробовать"** on banner — switches to v2 Home.
- [ ] **v2 Home renders correctly:**
      - [ ] Floating search pill at top
      - [ ] Greeting block ("Доброе утро · Москва" + headline + count chip)
      - [ ] Hero rotator (swipe through 3–5 cards, dot indicator advances correctly)
      - [ ] "Свежие предложения" horizontal shelf
      - [ ] Vertical feed of Small cards
      - [ ] EditorialDock at bottom (Главная · gradient FAB · Ещё)
      - [ ] FAB tap navigates to SellCar
      - [ ] Pull-to-refresh works
- [ ] **Tap v2 search pill** → SearchResults pushes.
- [ ] **v2 SearchResults renders correctly:**
      - [ ] Back button works
      - [ ] Title + subtitle ("X объявлений · Москва и регион")
      - [ ] Market stats strip with 3 cells
      - [ ] Filter chip row (Фильтры chip + active filter chips)
      - [ ] Sort dropdown opens SortSheet modal
      - [ ] Result list (Small cards)
      - [ ] "Показать ещё N" button when results exceed 25
- [ ] **Tap a result** → CarDetails opens.
- [ ] **CarDetails fonts**: while in v2, text uses Manrope / JetBrainsMono. Switch toggle to v1 in Settings, tap same car — text reverts to system fonts.
- [ ] **Toggle round-trip** Settings → "Классический" → Home reverts. Settings → "Новый" → Home becomes v2. Repeat 3×.
- [ ] **RU/EN switch** toggling language updates v2 strings (greeting, kicker, CTA, sort labels).

## Android pass

Same checklist as iOS, plus:

- [ ] Hardware back button on v2 Home: unwinds filters, then exit prompt (same v1 behavior).
- [ ] Logcat shows no "could not find typeface" warnings.
- [ ] Gradient renders correctly on EditorialDock fade + HeroCard photo overlay + BigFeedCard photo overlay.

## Persistence

- [ ] Kill the app while in v2. Relaunch — Home renders v2 immediately.
- [ ] Kill the app while in v1. Relaunch — Home renders v1.

## v1 regression sanity (toggle ON v1, both platforms)

- [ ] Login flow works.
- [ ] Sell car form opens.
- [ ] Profile / MyOrders / Favorites accessible.
- [ ] CarDetails still scrollable, photos zoom, contact buttons work.
- [ ] Cart still works (book a service).

## Notes / defects found

_(fill in)_
