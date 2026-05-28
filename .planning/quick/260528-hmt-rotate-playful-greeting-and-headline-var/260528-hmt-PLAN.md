---
phase: 260528-hmt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/constants/translations.ts
  - src/utils/greetingVariants.ts
  - src/utils/__tests__/greetingVariants.test.ts
  - src/screens/HomeScreenV2.tsx
autonomous: true
requirements: [HMT-01, HMT-02, HMT-03]
must_haves:
  truths:
    - "RU and EN translations each expose 4 variant pools (morning/afternoon/evening/headline) with the exact 10 strings specified per pool — 80 strings total, verbatim"
    - "On a fresh HomeScreenV2 mount, the GreetingBlock kicker shows a phrase from the time-appropriate variant pool and the headline shows a phrase from headlineVariants"
    - "Pulling-to-refresh on HomeScreenV2 picks a different greeting AND a different headline (never identical back-to-back)"
    - "Re-focusing HomeScreenV2 from another screen rotates both the greeting and the headline"
    - "Bringing the app back from background to foreground rotates both the greeting and the headline"
    - "Toggling language (RU↔EN) immediately re-picks both texts in the new language"
    - "GreetingBlock continues to receive a single `timeOfDay` string prop — no API change to the component"
    - "Existing singleton keys (goodMorning/goodAfternoon/goodEvening/findYourCar) are NOT removed — other screens may still reference them"
  artifacts:
    - path: "src/constants/translations.ts"
      provides: "4 RU + 4 EN string[] arrays, 10 entries each"
      contains: "greetingVariantsMorning"
    - path: "src/utils/greetingVariants.ts"
      provides: "pickIndex(), rotateVariant(), __resetVariantRegistry() — no-back-to-back random picker with per-slot memory"
      exports: ["pickIndex", "rotateVariant", "__resetVariantRegistry", "GreetingSlot"]
    - path: "src/utils/__tests__/greetingVariants.test.ts"
      provides: "Unit tests proving no-back-to-back-repeat, single-element pool safety, registry reset"
      contains: "describe"
    - path: "src/screens/HomeScreenV2.tsx"
      provides: "Rotation wiring: initial pick, isFocused-edge trigger, AppState 'active' trigger, RefreshControl onRefresh wrap, language-change re-pick"
      contains: "rotateVariant"
  key_links:
    - from: "src/screens/HomeScreenV2.tsx"
      to: "src/utils/greetingVariants.ts"
      via: "rotateVariant(slot, pool) called from initial useState + rotate callback"
      pattern: "rotateVariant\\("
    - from: "src/screens/HomeScreenV2.tsx"
      to: "useHomeListings().refresh"
      via: "onRefresh callback wraps rotate() + refresh()"
      pattern: "onRefresh=\\{onRefresh\\}"
    - from: "src/screens/HomeScreenV2.tsx"
      to: "AppState.addEventListener"
      via: "'change' event triggers rotate() on transition to 'active'"
      pattern: "AppState\\.addEventListener"
    - from: "src/screens/HomeScreenV2.tsx"
      to: "t.greetingVariantsMorning/Afternoon/Evening + t.headlineVariants"
      via: "pickGreetingPool(t) selects time-of-day pool; headlineVariants used directly"
      pattern: "greetingVariants(Morning|Afternoon|Evening)|headlineVariants"
---

<objective>
Make HomeScreenV2's greeting kicker AND headline rotate across pools of playful, exclamation-mark-heavy variants. The current singletons (`goodMorning`/`goodAfternoon`/`goodEvening` + `findYourCar`) are replaced at the GreetingBlock call site with one of 10 time-appropriate phrases for the kicker and one of 10 phrases for the headline. Rotation triggers on: initial mount, pull-to-refresh, screen re-focus, app foregrounding, and language toggle. The picker guarantees the same string never appears back-to-back for the same slot.

Purpose: The app needs to feel younger and more fun. Static greetings read corporate; a rotating pool of exclamation-driven copy injects personality without redesigning a single component.

Output: 4 RU + 4 EN variant arrays (80 verbatim strings), a `greetingVariants` util with unit tests, and a wired HomeScreenV2 that picks fresh copy on every rotation trigger.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@src/screens/HomeScreenV2.tsx
@src/components/home/v2/GreetingBlock.tsx
@src/hooks/useHomeListings.ts
@src/utils/greetingSubject.ts
@src/context/LanguageContext.tsx

<interfaces>
<!-- Key contracts the executor needs. Use these directly — no codebase exploration. -->

From src/context/LanguageContext.tsx:
- `t` is typed as `typeof TRANSLATIONS.RU`. Adding the 4 new keys to BOTH the `RU` and `EN` blocks in `src/constants/translations.ts` automatically extends the `t` type for all consumers. There is NO separate `TranslationStrings` interface to maintain — the planner outline's mention of one is incorrect; the project relies on `typeof TRANSLATIONS.RU` inference.
- Hook: `useLanguage()` returns `{ language: 'RU' | 'EN', setLanguage, t }`. HomeScreenV2 already destructures all three.

From src/constants/translations.ts (insertion landmarks):
- RU block: line 604 is `listingsCount: 'объявлений',` — the last key in the v2 home cluster before settings copy starts at line 605 (`appearanceTitle:`). Insert the 4 new RU arrays IMMEDIATELY AFTER line 604.
- EN block: line 1246 is `listingsCount: 'listings',` — equivalent landmark. Insert the 4 new EN arrays IMMEDIATELY AFTER line 1246.
- Existing v2 home singletons stay untouched at: RU lines 589-591 (`goodMorning`/`goodAfternoon`/`goodEvening`), line 592 (`findYourCar`); EN lines 1231-1233 + 1234.

From src/hooks/useHomeListings.ts:
- Exposes `refresh: () => Promise<void> | void` and `refreshing: boolean`. HomeScreenV2 currently passes them straight to `<RefreshControl onRefresh={refresh} />` (line 172 of HomeScreenV2.tsx).

From src/screens/HomeScreenV2.tsx (current shape — DO NOT remove unrelated logic):
- Line 32-37: `function timeOfDayKey(t: any): string` — KEEP this function (other places may use the pattern; harmless to leave). The new rotation does NOT replace its callers elsewhere; it only replaces the `timeOfDay={...}` prop at line 107.
- Line 42: `const isFocused = useIsFocused();` — reuse this same value for the rotation edge-trigger effect.
- Line 43: `const { t, language, setLanguage } = useLanguage();` — `language` is the dependency that drives re-pick on RU↔EN toggle.
- Lines 47-56: `useHomeListings()` destructure — `refresh` will be wrapped (not replaced) by `onRefresh`.
- Lines 104-113: `<GreetingBlock />` call — the two props to change are `timeOfDay={timeOfDayKey(t)}` → `timeOfDay={greetingText}` and `headline={t.findYourCar}` → `headline={headlineText}`. All other props stay identical.
- Line 172: `refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={V2.blue} />}` — change `onRefresh={refresh}` to `onRefresh={onRefresh}` (the wrapped version).
- Line 2: `RefreshControl` already imported from `react-native`. `AppState` and `AppStateStatus` must be ADDED to this same import.

From src/components/home/v2/GreetingBlock.tsx (component contract — DO NOT modify):
- Takes `timeOfDay: string`, `subject?: string`, `headline: string`, plus other props. The component receives strings; it doesn't care that they now come from a rotation. No changes needed to this file.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add 4 RU + 4 EN variant arrays to translations.ts (verbatim editorial copy)</name>
  <files>src/constants/translations.ts</files>
  <behavior>
    - After insertion, `TRANSLATIONS.RU.greetingVariantsMorning.length === 10`
    - After insertion, `TRANSLATIONS.EN.headlineVariants[0] === "Find your perfect car!"`
    - `typeof TRANSLATIONS.RU` (which drives `t`'s type in LanguageContext) gains 4 new `string[]` fields, propagating to all consumers
    - All 80 strings are EXACTLY the editorial copy from the planning context — no paraphrasing, no Unicode substitution, no apostrophe normalization
  </behavior>
  <action>
    Edit src/constants/translations.ts in two places.

    INSERT POINT 1 — RU block, immediately AFTER the existing line `listingsCount: 'объявлений',` (currently line 604), BEFORE the line `appearanceTitle: 'Внешний вид',`. Insert exactly this block (preserve the leading 4-space indentation to match neighbours):

    ```
        // ---- Quick 260528-hmt — Playful rotating greeting + headline variants (RU) ----
        greetingVariantsMorning: [
          'Доброе утро!',
          'С добрым утром!',
          'Утро доброе!',
          'Кофе и поехали!',
          'Привет, ранняя пташка!',
          'Подъём, искатель!',
          'Утро, чемпион!',
          'Бодрого утречка!',
          'Здорово, утро!',
          'Утро мечты!',
        ],
        greetingVariantsAfternoon: [
          'Добрый день!',
          'Привет, день!',
          'Хорошего дня!',
          'Полдень в деле!',
          'Денёк что надо!',
          'Привет, чемпион!',
          'День удачи!',
          'Время выбирать!',
          'Здорово, день!',
          'Ловите день!',
        ],
        greetingVariantsEvening: [
          'Добрый вечер!',
          'Вечер добрый!',
          'Привет, вечер!',
          'Совам — салют!',
          'Закат и кайф!',
          'Вечер мечты!',
          'Вечер, легенда!',
          'Привет, ночник!',
          'Чудного вечера!',
          'Вечер у руля!',
        ],
        headlineVariants: [
          'Найдём ваше идеальное авто!',
          'Поехали выбирать!',
          'Время новой машины!',
          'Ваше авто уже ждёт!',
          'Машина мечты — в один тап!',
          'Меньше слов, больше колёс!',
          'Один свайп — и она ваша!',
          'Заводим? Заводим!',
          'Полный бак вариантов!',
          'Гараж скучает по вам!',
        ],
    ```

    INSERT POINT 2 — EN block, immediately AFTER the existing line `listingsCount: 'listings',` (currently line 1246), BEFORE the next sibling key. Insert exactly this block (preserve 4-space indentation):

    ```
        // ---- Quick 260528-hmt — Playful rotating greeting + headline variants (EN) ----
        greetingVariantsMorning: [
          'Good morning!',
          'Rise and shine!',
          "Mornin'!",
          'Hey, sunshine!',
          'Coffee first!',
          'Wakey, wakey!',
          'Hi, early bird!',
          "Up & at 'em!",
          'Top of the morning!',
          'Morning, champ!',
        ],
        greetingVariantsAfternoon: [
          'Good afternoon!',
          'Hey there!',
          'Howdy!',
          'Hi, champ!',
          'Afternoon vibes!',
          'Hey, legend!',
          'Midday hi!',
          'Lunch break?',
          'Hey, you!',
          'Welcome back!',
        ],
        greetingVariantsEvening: [
          'Good evening!',
          'Evening!',
          'Howdy!',
          'Hey, night owl!',
          'Hi, late bird!',
          'Evening, champ!',
          'Sunset hi!',
          'After-hours hi!',
          'Hey, hey!',
          'Welcome, evening!',
        ],
        headlineVariants: [
          'Find your perfect car!',
          "Let's find your ride!",
          'Your next car awaits!',
          'Ready to shop?',
          'Dream car, loading…',
          'Less scrolling, more driving!',
          'One tap to your ride!',
          'Cars on cars on cars!',
          'Pick a winner!',
          'Your garage misses you!',
        ],
    ```

    CRITICAL string-literal notes (apostrophes inside strings):
    - `"Mornin'!"` uses double quotes because the string contains a single quote.
    - `"Up & at 'em!"` uses double quotes for the same reason.
    - `"Let's find your ride!"` uses double quotes for the same reason.
    - All other entries use single quotes to match existing file style.
    - The `…` in `'Dream car, loading…'` is the actual U+2026 HORIZONTAL ELLIPSIS character (matches the existing `pickingMore: 'FINDING MORE…'` style at line 1242). Do NOT replace with three dots.
    - The `—` (em dash) in `'Совам — салют!'` and `'Машина мечты — в один тап!'` is U+2014 EM DASH (matches existing usage in the file).
    - The `ё` in `'Подъём, искатель!'`, `'Денёк что надо!'`, `'Чудного вечера!'`, `'Совам — салют!'` is the actual Cyrillic ё (U+0451), not e.
    - The `&` in `"Up & at 'em!"` is the literal ASCII ampersand.

    DO NOT touch any other keys. DO NOT remove the existing singletons (`goodMorning`, `goodAfternoon`, `goodEvening`, `findYourCar`) — they may be referenced elsewhere; leaving them costs nothing.
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; npx tsc --noEmit --skipLibCheck 2>&amp;1 | tee /tmp/hmt-tsc.log; grep -E "translations\.ts" /tmp/hmt-tsc.log &amp;&amp; echo "TSC FAIL — translations.ts has type errors" &amp;&amp; exit 1; node -e "const {TRANSLATIONS} = require('./src/constants/translations.ts'.replace('.ts','')); const r=TRANSLATIONS.RU; const e=TRANSLATIONS.EN; const ok = r.greetingVariantsMorning.length===10 &amp;&amp; r.greetingVariantsAfternoon.length===10 &amp;&amp; r.greetingVariantsEvening.length===10 &amp;&amp; r.headlineVariants.length===10 &amp;&amp; e.greetingVariantsMorning.length===10 &amp;&amp; e.greetingVariantsAfternoon.length===10 &amp;&amp; e.greetingVariantsEvening.length===10 &amp;&amp; e.headlineVariants.length===10; console.log('counts_ok=', ok); process.exit(ok?0:1);" 2>/dev/null || node -e "const ts=require('fs').readFileSync('src/constants/translations.ts','utf8'); const ru=(ts.match(/greetingVariantsMorning: \[[\s\S]*?\]/g)||[]); const en=(ts.match(/greetingVariantsEvening: \[[\s\S]*?\]/g)||[]); console.log('RU morning blocks:', ru.length, 'EN evening blocks:', en.length); if((ts.match(/greetingVariantsMorning:/g)||[]).length!==2) { console.error('FAIL: greetingVariantsMorning must appear exactly 2x (RU+EN)'); process.exit(1); } if((ts.match(/headlineVariants:/g)||[]).length!==2) { console.error('FAIL: headlineVariants must appear exactly 2x'); process.exit(1); } console.log('OK');"</automated>
    Also run: `grep -c "Кофе и поехали!" src/constants/translations.ts` returns 1, `grep -c "Coffee first!" src/constants/translations.ts` returns 1, `grep -c "Гараж скучает по вам!" src/constants/translations.ts` returns 1, `grep -c "Your garage misses you!" src/constants/translations.ts` returns 1.
  </verify>
  <done>
    - `npx tsc --noEmit --skipLibCheck` produces zero errors attributable to translations.ts
    - All 4 array key names appear exactly twice across the file (once in RU, once in EN)
    - Each of the 80 editorial strings is grep-findable verbatim
    - Existing singletons (`goodMorning`, `goodAfternoon`, `goodEvening`, `findYourCar`) and all other keys remain unchanged
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create greetingVariants util with no-back-to-back picker + unit tests</name>
  <files>src/utils/greetingVariants.ts, src/utils/__tests__/greetingVariants.test.ts</files>
  <behavior>
    - `pickIndex(poolSize, lastIndex)` returns 0 when poolSize <= 1
    - `pickIndex(poolSize, lastIndex)` returns a number in [0, poolSize) that is !== lastIndex when poolSize >= 2 and lastIndex is non-null
    - `pickIndex(poolSize, null)` returns any index in [0, poolSize)
    - `rotateVariant('morning', pool)` returns an element of pool and updates the module's per-slot last-index registry so the next call for 'morning' avoids the same index
    - `rotateVariant('headline', pool)` is independent of greeting slots (separate registry entry)
    - `rotateVariant(slot, [])` returns `undefined` and logs a warning (defensive — pools should never be empty in practice)
    - `rotateVariant(slot, [x])` always returns `x` and does not throw
    - `__resetVariantRegistry()` resets all slot last-indexes to null (used only by tests)
    - 50 consecutive calls to `rotateVariant('morning', poolOf10)` never produce two identical results back-to-back
  </behavior>
  <action>
    Write tests FIRST at src/utils/__tests__/greetingVariants.test.ts, run them (they fail because the util doesn't exist), then implement src/utils/greetingVariants.ts to make them pass. This is a TDD task — RED before GREEN.

    Step 2a (RED): Create src/utils/__tests__/greetingVariants.test.ts with these test cases:
    - `pickIndex returns 0 for poolSize 0` → expect 0
    - `pickIndex returns 0 for poolSize 1` → expect 0
    - `pickIndex avoids lastIndex when poolSize >= 2` → loop 200 times with poolSize=2, lastIndex=0; assert every result is 1
    - `pickIndex with poolSize 5 and lastIndex 2 never returns 2` → loop 500 times; collect a Set of results; assert Set does not include 2 and Set.size >= 2 (proves it isn't always returning the same number)
    - `pickIndex with lastIndex null returns values in [0, poolSize)` → loop 100 times with poolSize=4; assert every result is in {0,1,2,3}
    - `rotateVariant never repeats consecutively for the same slot` → call `__resetVariantRegistry()`, then call `rotateVariant('morning', poolOf10)` 50 times capturing results; for each i>0 assert results[i] !== results[i-1]
    - `rotateVariant maintains independent registries per slot` → reset; alternate 20 calls between 'morning' and 'headline' with the same 2-element pool; assert that within each slot's filtered subsequence there's no back-to-back repeat (the cross-slot interleaving is allowed to repeat)
    - `rotateVariant with single-element pool returns that element repeatedly` → reset; call 5 times with `['only']`; assert all results === 'only'
    - `rotateVariant with empty pool returns undefined and warns` → spy on console.warn; expect result === undefined and warn called once
    - `__resetVariantRegistry clears state` → reset, call once with poolOf2 (now registry has lastIndex 0 or 1), reset again, call again — the new call should be free to pick either index (assert by running 30 times after a reset with poolOf2 and confirming both 0 and 1 appear in the sample)

    Use the project's Jest setup. Import: `import { pickIndex, rotateVariant, __resetVariantRegistry } from '../greetingVariants';`

    Step 2b: Run `npx jest src/utils/__tests__/greetingVariants.test.ts` — it MUST fail (module not found). Commit with message including `test(260528-hmt):`.

    Step 2c (GREEN): Create src/utils/greetingVariants.ts with this surface:

    ```ts
    /**
     * greetingVariants — pick a random element from a pool while guaranteeing
     * it isn't the same one we showed last time for that slot.
     *
     * Used by HomeScreenV2 to rotate the greeting kicker (morning/afternoon/evening)
     * and the headline independently. The "last index per slot" registry is
     * module-scope so any component using the same slot key shares anti-repeat
     * memory for the lifetime of the JS context.
     */

    export type GreetingSlot = 'morning' | 'afternoon' | 'evening' | 'headline';

    const lastIndexBySlot: Record<GreetingSlot, number | null> = {
      morning: null,
      afternoon: null,
      evening: null,
      headline: null,
    };

    export function pickIndex(poolSize: number, lastIndex: number | null): number {
      if (poolSize <= 1) return 0;
      // Pick uniformly from [0, poolSize - 1) and shift past lastIndex to skip it.
      // This guarantees uniform distribution over the (poolSize - 1) allowed slots.
      if (lastIndex == null || lastIndex < 0 || lastIndex >= poolSize) {
        return Math.floor(Math.random() * poolSize);
      }
      const offset = Math.floor(Math.random() * (poolSize - 1));
      return offset < lastIndex ? offset : offset + 1;
    }

    export function rotateVariant<T>(slot: GreetingSlot, pool: T[]): T {
      if (!Array.isArray(pool) || pool.length === 0) {
        // Defensive — pools should never be empty.
        console.warn(`[greetingVariants] empty pool for slot "${slot}"`);
        return undefined as unknown as T;
      }
      const idx = pickIndex(pool.length, lastIndexBySlot[slot]);
      lastIndexBySlot[slot] = idx;
      return pool[idx];
    }

    export function __resetVariantRegistry(): void {
      lastIndexBySlot.morning = null;
      lastIndexBySlot.afternoon = null;
      lastIndexBySlot.evening = null;
      lastIndexBySlot.headline = null;
    }
    ```

    Step 2d: Run jest again — all tests must pass. Commit with message including `feat(260528-hmt):`.

    Do NOT add a refactor commit unless something is genuinely unclear; the GREEN version is already small and self-documenting.

    Notes on the picker math: the `offset < lastIndex ? offset : offset + 1` trick maps a uniform draw from `[0, poolSize - 1)` onto `[0, poolSize) \ {lastIndex}` without rejection sampling — guaranteed O(1) and uniform across the (poolSize - 1) eligible slots. This is intentional and matches the test "never repeats consecutively".
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; npx jest src/utils/__tests__/greetingVariants.test.ts --no-coverage 2>&amp;1 | tail -30</automated>
    Also: `npx tsc --noEmit --skipLibCheck` is clean for both new files; `grep -c "export function pickIndex" src/utils/greetingVariants.ts` returns 1; `grep -c "export function rotateVariant" src/utils/greetingVariants.ts` returns 1.
  </verify>
  <done>
    - src/utils/greetingVariants.ts exists and exports `pickIndex`, `rotateVariant`, `__resetVariantRegistry`, `GreetingSlot`
    - src/utils/__tests__/greetingVariants.test.ts exists with all listed test cases
    - `npx jest src/utils/__tests__/greetingVariants.test.ts` passes 100%
    - No TypeScript errors on either file
    - Git log shows at least one RED commit (`test(260528-hmt):...`) followed by one GREEN commit (`feat(260528-hmt):...`)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire rotation into HomeScreenV2 (mount + refresh + focus + AppState + language)</name>
  <files>src/screens/HomeScreenV2.tsx</files>
  <behavior>
    - On mount, GreetingBlock renders a phrase from the current-hour-appropriate pool and a phrase from headlineVariants — chosen via `rotateVariant`
    - Pulling-to-refresh rotates BOTH texts AND still calls the original `refresh` from useHomeListings (pull-to-refresh still fetches listings)
    - Re-focusing the screen from another route rotates both texts (does NOT fire on initial mount — the initial pick already happened)
    - AppState transitions to `'active'` rotate both texts (skip the very first 'active' event that fires on mount on some Android devices)
    - Toggling language via LangSwitchV2 re-picks both texts so the visible language matches the active locale
    - The hour-of-day pool selection re-evaluates on every rotation (so if the user lingers past noon and then refreshes, they get the afternoon pool)
    - GreetingBlock is called with `timeOfDay={greetingText}` and `headline={headlineText}` — all OTHER props are byte-identical to current code
  </behavior>
  <action>
    Edit src/screens/HomeScreenV2.tsx. Make the following five surgical changes; do NOT modify any unrelated code (Android back handler, useMemo subject, slicing, FlatList config, styles).

    CHANGE 1 — Imports (line 1-2 area):
    - Add `useCallback` to the existing `react` import (currently imports `useEffect, useState, useRef, useMemo`).
    - Add `AppState` and the type `AppStateStatus` to the existing `react-native` import (currently imports `View, FlatList, StyleSheet, StatusBar, Text, Platform, BackHandler, ToastAndroid, RefreshControl`).
    - Add a new import below the existing `greetingSubject` import: `import { rotateVariant, GreetingSlot } from '../utils/greetingVariants';`

    CHANGE 2 — Add a module-scope helper next to `timeOfDayKey` (insert AFTER the existing function at line 37, BEFORE `export const HomeScreenV2`):

    ```ts
    type GreetingTimeSlot = Exclude<GreetingSlot, 'headline'>;

    function currentGreetingSlot(): GreetingTimeSlot {
      const h = new Date().getHours();
      if (h < 12) return 'morning';
      if (h < 18) return 'afternoon';
      return 'evening';
    }

    function pickGreetingPool(t: any): { slot: GreetingTimeSlot; pool: string[] } {
      const slot = currentGreetingSlot();
      const pool =
        slot === 'morning'   ? t.greetingVariantsMorning :
        slot === 'afternoon' ? t.greetingVariantsAfternoon :
                               t.greetingVariantsEvening;
      return { slot, pool };
    }
    ```

    Note: `timeOfDayKey` STAYS in the file. It's no longer called by HomeScreenV2's render, but harmless dead code is acceptable — removing it would be scope creep and there is a small chance another file imports it (it isn't exported, but leaving it documents the migration path).

    CHANGE 3 — Inside the HomeScreenV2 component body, AFTER the `const { user } = useAuth();` line (line 44) and BEFORE the `const typo = useTypography();` line (line 45), insert the rotation state + rotate callback + effects:

    ```ts
      // ---- Quick 260528-hmt — Rotating greeting + headline ----
      const [greetingText, setGreetingText] = useState<string>(() => {
        const { slot, pool } = pickGreetingPool(t);
        return rotateVariant(slot, pool);
      });
      const [headlineText, setHeadlineText] = useState<string>(() =>
        rotateVariant('headline', t.headlineVariants),
      );

      const rotate = useCallback(() => {
        const { slot, pool } = pickGreetingPool(t);
        setGreetingText(rotateVariant(slot, pool));
        setHeadlineText(rotateVariant('headline', t.headlineVariants));
      }, [t]);

      // Re-pick whenever the language flips so the displayed copy matches the active locale.
      // We intentionally depend on `language` (a stable primitive) rather than `t` (object identity).
      const langMountRef = useRef(true);
      useEffect(() => {
        if (langMountRef.current) { langMountRef.current = false; return; }
        rotate();
      }, [language, rotate]);

      // Rotate when the screen regains focus (e.g. user returns from CarDetails).
      // Skip the initial mount so the initial useState pick isn't immediately replaced.
      const focusMountRef = useRef(true);
      useEffect(() => {
        if (focusMountRef.current) { focusMountRef.current = false; return; }
        if (isFocused) rotate();
      }, [isFocused, rotate]);

      // Rotate when the app returns from background to foreground.
      // Skip the very first 'active' transition (some Android builds fire it at launch).
      useEffect(() => {
        let skippedFirst = false;
        const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
          if (s !== 'active') return;
          if (!skippedFirst) { skippedFirst = true; return; }
          rotate();
        });
        return () => sub.remove();
      }, [rotate]);

      // Pull-to-refresh: rotate copy AND fetch listings.
      const onRefresh = useCallback(() => {
        rotate();
        return refresh();
      }, [rotate, refresh]);
    ```

    CHANGE 4 — In the `Header` JSX (lines 104-113), modify exactly two props on `<GreetingBlock />`:
    - Replace `timeOfDay={timeOfDayKey(t)}` with `timeOfDay={greetingText}`
    - Replace `headline={t.findYourCar}` with `headline={headlineText}`
    - Leave `subject`, `listingsCount`, `listingsNoun`, `trailing` exactly as they are.

    CHANGE 5 — Change the FlatList's `refreshControl` (line 172):
    - Replace `onRefresh={refresh}` with `onRefresh={onRefresh}`
    - Leave `refreshing={refreshing}` and `tintColor={V2.blue}` exactly as they are.

    DO NOT change anything else. In particular: do NOT delete `timeOfDayKey`, do NOT touch the back handler, do NOT touch the `subject` useMemo, do NOT touch slicing or styles.
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx &amp;&amp; npx tsc --noEmit --skipLibCheck 2>&amp;1 | grep -E "HomeScreenV2|greetingVariants" | tee /tmp/hmt-tsc-3.log; test ! -s /tmp/hmt-tsc-3.log &amp;&amp; echo "TSC OK" || (echo "TSC FAIL" &amp;&amp; exit 1); npm test -- --testPathIgnorePatterns=none --silent 2>&amp;1 | tail -15