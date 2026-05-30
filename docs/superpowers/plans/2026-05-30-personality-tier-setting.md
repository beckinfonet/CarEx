# Personality Tier Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 3-stop Personality Tier (`Wholesome` / `Sarcastic` / `Unhinged`) that visibly changes the HomeScreenV2 greeting, via an always-visible chip on Home (tap = cycle, long-press = picker sheet), with all copy reviewed per language before merge.

**Architecture:** New `PersonalityContext` (mirrors `LanguageContext`) persists tier to AsyncStorage. `translations.ts` migrates its four greeting pools from `string[]` to `{wholesome, sarcastic, unhinged}` maps; the existing Wholesome lines stay verbatim, Sarcastic + Unhinged are net-new (drafted by Claude, reviewed by the owner per language). The inline `pickGreetingPool` / `currentGreetingSlot` helpers in `HomeScreenV2` move to `src/utils/pickGreetingPool.ts` so they're unit-testable. `HomeScreenV2` reads tier via `usePersonality()`, imports the tier-aware `pickGreetingPool`, and adds a 5th rotation trigger on tier change. `TierChip` and `TierPickerSheet` live in `src/components/home/v2/` alongside `LangSwitchV2` and `GreetingBlock`. Atomic one-PR rollout; no feature flag.

**Tech Stack:** React Native 0.83 · TypeScript 5.8 · `@react-native-async-storage/async-storage` 2.2 · `react-native-linear-gradient` 2.8 · `lucide-react-native` 0.563 · Jest 29 · `react-test-renderer`.

**Spec:** [`docs/superpowers/specs/2026-05-30-personality-tier-setting-design.md`](../specs/2026-05-30-personality-tier-setting-design.md)

---

## Pre-flight

Before Task 1, the engineer should:

- Be on a clean working tree (no uncommitted unrelated changes; the pre-existing `android/version.properties` modification is fine — leave it alone).
- Confirm Node 20+, that `npm install` has been run, and that `npm test` passes on `main`.
- Read the spec sections 1–6 once end-to-end. The plan assumes you have.

### Branch

```bash
git checkout -b feat/personality-tier-setting
```

Single feature branch; all 9 implementation tasks land on it before the one merge.

---

## Task 1: PersonalityContext + tests (TDD)

**Files:**
- Create: `src/context/PersonalityContext.tsx`
- Create test: `src/context/__tests__/PersonalityContext.test.tsx`

This is the spine. Mirrors the `LanguageContext` pattern (`src/context/LanguageContext.tsx`) and the AsyncStorage-backed pattern from `src/context/UIVersionContext.tsx`. Its tests mirror `src/context/__tests__/UIVersionContext.test.tsx`.

### Step 1.1: Write the failing test file (reading paths)

- [ ] Create `src/context/__tests__/PersonalityContext.test.tsx` with the following content:

```tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalityProvider, usePersonality } from '../PersonalityContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
const mockedAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let hookResult: ReturnType<typeof usePersonality>;
function Probe() {
  hookResult = usePersonality();
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PersonalityContext', () => {
  test('defaults to wholesome when AsyncStorage is empty', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    expect(hookResult.tier).toBe('wholesome');
  });

  test('defaults to wholesome when AsyncStorage holds an unknown value', async () => {
    mockedAsync.getItem.mockResolvedValue('chaotic-good');
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    expect(hookResult.tier).toBe('wholesome');
  });

  test('hydrates sarcastic from AsyncStorage on mount', async () => {
    mockedAsync.getItem.mockResolvedValue('sarcastic');
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');
  });
});
```

### Step 1.2: Run the failing tests

- [ ] Run: `npx jest src/context/__tests__/PersonalityContext.test.tsx -v`
- [ ] Expected: FAIL — `Cannot find module '../PersonalityContext'`.

### Step 1.3: Create the minimal PersonalityContext to pass

- [ ] Create `src/context/PersonalityContext.tsx`:

```tsx
import React, {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PersonalityTier = 'wholesome' | 'sarcastic' | 'unhinged';

const STORAGE_KEY = '@carex.personality.tier.v1';
const DEFAULT_TIER: PersonalityTier = 'wholesome';
const CYCLE_ORDER: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];

function isTier(v: unknown): v is PersonalityTier {
  return v === 'wholesome' || v === 'sarcastic' || v === 'unhinged';
}

interface PersonalityContextType {
  tier: PersonalityTier;
  setTier: (tier: PersonalityTier) => void;
  cycleTier: () => void;
}

const PersonalityContext = createContext<PersonalityContextType | undefined>(undefined);

export const PersonalityProvider = ({ children }: { children: ReactNode }) => {
  const [tier, setTierState] = useState<PersonalityTier>(DEFAULT_TIER);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (isTier(stored)) setTierState(stored);
      } catch (e) {
        console.error('[PersonalityContext] hydrate failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setTier = (next: PersonalityTier) => {
    setTierState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((e) => {
      console.error('[PersonalityContext] persist failed', e);
    });
  };

  const cycleTier = () => {
    const idx = CYCLE_ORDER.indexOf(tier);
    const nextIdx = (idx + 1) % CYCLE_ORDER.length;
    setTier(CYCLE_ORDER[nextIdx]);
  };

  return (
    <PersonalityContext.Provider value={{ tier, setTier, cycleTier }}>
      {children}
    </PersonalityContext.Provider>
  );
};

export const usePersonality = () => {
  const ctx = useContext(PersonalityContext);
  if (!ctx) {
    throw new Error('usePersonality must be used within a PersonalityProvider');
  }
  return ctx;
};
```

### Step 1.4: Run the reading-path tests

- [ ] Run: `npx jest src/context/__tests__/PersonalityContext.test.tsx -v`
- [ ] Expected: PASS — all three "reading" tests green.

### Step 1.5: Commit reading-path

- [ ] Commit:

```bash
git add src/context/PersonalityContext.tsx src/context/__tests__/PersonalityContext.test.tsx
git commit -m "feat(personality): PersonalityContext with AsyncStorage hydrate"
```

### Step 1.6: Add the failing setTier + cycleTier tests

- [ ] Append to the existing `describe('PersonalityContext', ...)` block in `src/context/__tests__/PersonalityContext.test.tsx`:

```tsx
  test('setTier persists to AsyncStorage and updates state', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    await act(async () => { hookResult.setTier('unhinged'); });
    await flush();
    expect(mockedAsync.setItem).toHaveBeenCalledWith('@carex.personality.tier.v1', 'unhinged');
    expect(hookResult.tier).toBe('unhinged');
  });

  test('cycleTier walks wholesome -> sarcastic -> unhinged -> wholesome', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('unhinged');

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('wholesome');
  });
```

### Step 1.7: Run the writing-path tests

- [ ] Run: `npx jest src/context/__tests__/PersonalityContext.test.tsx -v`
- [ ] Expected: PASS — all 5 tests green. No code changes required because the implementation in Step 1.3 already supports `setTier` and `cycleTier`.

### Step 1.8: Add the persistence-failure test

- [ ] Append one more test:

```tsx
  test('setTier retains in-memory value when AsyncStorage write rejects', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    mockedAsync.setItem.mockRejectedValueOnce(new Error('quota'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    await act(async () => { hookResult.setTier('sarcastic'); });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
```

### Step 1.9: Run, commit

- [ ] Run: `npx jest src/context/__tests__/PersonalityContext.test.tsx -v`
- [ ] Expected: PASS — 6 tests green.
- [ ] Commit:

```bash
git add src/context/__tests__/PersonalityContext.test.tsx
git commit -m "test(personality): setTier, cycleTier, and persist-failure paths"
```

---

## Task 2: Wire PersonalityProvider into App.tsx

**Files:**
- Modify: `App.tsx` (around lines 98–99)

Per spec §2, `PersonalityProvider` sits **inside** `LanguageProvider` (so its descendants can call `useLanguage()` for sheet previews) and **outside** `NavigationContainer`. The codebase already has `UIVersionProvider` in that slot; we add `PersonalityProvider` immediately inside `LanguageProvider`, wrapping `UIVersionProvider`.

### Step 2.1: Add the import

- [ ] In `App.tsx`, locate the existing `import { LanguageProvider } from './src/context/LanguageContext';` line (currently line 38). Add immediately below it:

```tsx
import { PersonalityProvider } from './src/context/PersonalityContext';
```

### Step 2.2: Add the Provider to the stack

- [ ] Edit `App.tsx` around lines 98–99. Existing tree:

```tsx
            <LanguageProvider>
            <UIVersionProvider>
            <NavigationContainer linking={linking}>
```

Replace with:

```tsx
            <LanguageProvider>
            <PersonalityProvider>
            <UIVersionProvider>
            <NavigationContainer linking={linking}>
```

- [ ] Find the matching closing tags (currently lines 134–136):

```tsx
            </NavigationContainer>
            </UIVersionProvider>
            </LanguageProvider>
```

Replace with:

```tsx
            </NavigationContainer>
            </UIVersionProvider>
            </PersonalityProvider>
            </LanguageProvider>
```

### Step 2.3: Verify the app still type-checks

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: no new errors (any pre-existing errors are not your concern).

### Step 2.4: Verify no test regressed

- [ ] Run: `npm test -- --listTests | head -5 && npm test`
- [ ] Expected: full suite passes. The PersonalityProvider has no effect on consumers yet (no one calls `usePersonality()`), so existing tests are unaffected.

### Step 2.5: Commit

- [ ] Commit:

```bash
git add App.tsx
git commit -m "feat(personality): mount PersonalityProvider in App provider stack"
```

---

## Task 3: Migrate translations.ts to tier-scoped pools (placeholder copy)

**Files:**
- Modify: `src/constants/translations.ts` (RU block: lines ~611–658; EN block: lines ~1322–1369)

Convert the four greeting-pool keys (`greetingVariantsMorning`, `greetingVariantsAfternoon`, `greetingVariantsEvening`, `headlineVariants`) from `string[]` to `{ wholesome: string[]; sarcastic: string[]; unhinged: string[] }` in **both** the RU and EN blocks.

**Wholesome keeps the existing 10 lines verbatim.** Sarcastic + Unhinged are seeded with **clearly-marked placeholder strings** that will be replaced in Task 8 (the copy-review task). Placeholders include a `_REPLACE_` token so a `grep "_REPLACE_" src/` after Task 8 returns zero hits — that grep is part of the rollout gate.

### Step 3.1: Migrate `greetingVariantsMorning` (RU)

- [ ] In `src/constants/translations.ts` at line ~611, replace the current array:

```ts
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
```

with:

```ts
    greetingVariantsMorning: {
      wholesome: [
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
      sarcastic: [
        '_REPLACE_ RU sarcastic morning 1',
        '_REPLACE_ RU sarcastic morning 2',
        '_REPLACE_ RU sarcastic morning 3',
        '_REPLACE_ RU sarcastic morning 4',
        '_REPLACE_ RU sarcastic morning 5',
        '_REPLACE_ RU sarcastic morning 6',
        '_REPLACE_ RU sarcastic morning 7',
        '_REPLACE_ RU sarcastic morning 8',
        '_REPLACE_ RU sarcastic morning 9',
        '_REPLACE_ RU sarcastic morning 10',
      ],
      unhinged: [
        '_REPLACE_ RU unhinged morning 1',
        '_REPLACE_ RU unhinged morning 2',
        '_REPLACE_ RU unhinged morning 3',
        '_REPLACE_ RU unhinged morning 4',
        '_REPLACE_ RU unhinged morning 5',
        '_REPLACE_ RU unhinged morning 6',
        '_REPLACE_ RU unhinged morning 7',
        '_REPLACE_ RU unhinged morning 8',
        '_REPLACE_ RU unhinged morning 9',
        '_REPLACE_ RU unhinged morning 10',
      ],
    },
```

### Step 3.2: Migrate `greetingVariantsAfternoon` (RU)

- [ ] Same pattern for the afternoon pool at line ~623. Wholesome keeps the existing 10 lines verbatim:

```ts
    greetingVariantsAfternoon: {
      wholesome: [
        'Добрый день!', 'Привет, день!', 'Хорошего дня!', 'Полдень в деле!',
        'Денёк что надо!', 'Привет, чемпион!', 'День удачи!', 'Время выбирать!',
        'Здорово, день!', 'Ловите день!',
      ],
      sarcastic: Array.from({ length: 10 }, (_, i) => `_REPLACE_ RU sarcastic afternoon ${i + 1}`),
      unhinged:  Array.from({ length: 10 }, (_, i) => `_REPLACE_ RU unhinged afternoon ${i + 1}`),
    },
```

**Note:** `Array.from(...)` is a typed shortcut. The placeholder strings still grep correctly as `_REPLACE_`. The literal-array form from Step 3.1 is equally valid — pick one style and use it consistently across the remaining six replacements in this task.

### Step 3.3: Migrate `greetingVariantsEvening` (RU)

- [ ] Same pattern at line ~635:

```ts
    greetingVariantsEvening: {
      wholesome: [
        'Добрый вечер!', 'Вечер добрый!', 'Привет, вечер!', 'Совам — салют!',
        'Закат и кайф!', 'Вечер мечты!', 'Вечер, легенда!', 'Привет, ночник!',
        'Чудного вечера!', 'Вечер у руля!',
      ],
      sarcastic: Array.from({ length: 10 }, (_, i) => `_REPLACE_ RU sarcastic evening ${i + 1}`),
      unhinged:  Array.from({ length: 10 }, (_, i) => `_REPLACE_ RU unhinged evening ${i + 1}`),
    },
```

### Step 3.4: Migrate `headlineVariants` (RU)

- [ ] Same pattern at line ~647:

```ts
    headlineVariants: {
      wholesome: [
        'Найдём ваше идеальное авто!', 'Поехали выбирать!', 'Время новой машины!',
        'Ваше авто уже ждёт!', 'Машина мечты — в один тап!', 'Меньше слов, больше колёс!',
        'Один свайп — и она ваша!', 'Заводим? Заводим!', 'Полный бак вариантов!',
        'Гараж скучает по вам!',
      ],
      sarcastic: Array.from({ length: 10 }, (_, i) => `_REPLACE_ RU sarcastic headline ${i + 1}`),
      unhinged:  Array.from({ length: 10 }, (_, i) => `_REPLACE_ RU unhinged headline ${i + 1}`),
    },
```

### Step 3.5: Repeat for the EN block (lines ~1322–1369)

- [ ] In the EN block, apply the same shape transformation to all four pool keys. Wholesome stays the existing 10 lines per pool verbatim; Sarcastic + Unhinged each get 10 `_REPLACE_ EN sarcastic <slot> N` / `_REPLACE_ EN unhinged <slot> N` placeholder strings.

(Pool source lines in EN, for reference: morning at 1322, afternoon at 1334, evening at 1346, headline at 1358.)

### Step 3.6: Verify shape with a grep

- [ ] Run:

```bash
grep -c "_REPLACE_" src/constants/translations.ts
```

- [ ] Expected: `160` (4 slots × 10 lines × 2 tiers × 2 languages). Any other number means a pool is malformed; reread the changed sections.

### Step 3.7: Verify TypeScript

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: errors in `HomeScreenV2.tsx` complaining that `t.greetingVariantsMorning` is no longer a `string[]` (it's an object now). That is **correct** and expected — Task 4 fixes those callsites. Note the file:line of each error; the diagnostics should point at the lines you'll edit in Task 4 (lines 55–57 of HomeScreenV2.tsx and the `rotateVariant('headline', t.headlineVariants)` callsite).

### Step 3.8: Commit

- [ ] Commit:

```bash
git add src/constants/translations.ts
git commit -m "feat(personality): tier-scoped greeting pools (placeholder sarcastic/unhinged)"
```

The commit message intentionally calls out that Sarcastic/Unhinged copy is placeholder — this branch is not mergeable until Task 8 replaces them.

---

## Task 4: Extract tier-aware pickGreetingPool to a utility (TDD) and wire HomeScreenV2 to consume tier

**Files:**
- Create: `src/utils/pickGreetingPool.ts`
- Create test: `src/utils/__tests__/pickGreetingPool.test.ts`
- Modify: `src/screens/HomeScreenV2.tsx` (imports + remove the inline helpers; consume the new hook; add the 5th rotation trigger)

`pickGreetingPool` and its sibling helpers (`currentGreetingSlot`, `GreetingTimeSlot`) are currently inline in `HomeScreenV2.tsx`. We extract them to a utility so they're unit-testable without importing the screen (which would drag in unmocked `react-navigation` modules). After this task the home screen compiles again and rotates correctly on tier change. The chip and sheet are still not on screen — that's Tasks 5/6/7.

### Step 4.1: Write the failing utility tests

- [ ] Create `src/utils/__tests__/pickGreetingPool.test.ts`:

```ts
import { pickGreetingPool, currentGreetingSlot } from '../pickGreetingPool';

const T = {
  greetingVariantsMorning:   { wholesome: ['MW'], sarcastic: ['MS'], unhinged: ['MU'] },
  greetingVariantsAfternoon: { wholesome: ['AW'], sarcastic: ['AS'], unhinged: ['AU'] },
  greetingVariantsEvening:   { wholesome: ['EW'], sarcastic: ['ES'], unhinged: ['EU'] },
};

describe('pickGreetingPool', () => {
  test('returns the wholesome morning pool when (morning, wholesome)', () => {
    expect(pickGreetingPool(T, 'wholesome', 'morning')).toEqual({ slot: 'morning', pool: ['MW'] });
  });

  test('returns the sarcastic afternoon pool when (afternoon, sarcastic)', () => {
    expect(pickGreetingPool(T, 'sarcastic', 'afternoon')).toEqual({ slot: 'afternoon', pool: ['AS'] });
  });

  test('returns the unhinged evening pool when (evening, unhinged)', () => {
    expect(pickGreetingPool(T, 'unhinged', 'evening')).toEqual({ slot: 'evening', pool: ['EU'] });
  });

  test('covers all 9 (slot, tier) combinations', () => {
    const expected: Record<string, string> = {
      'morning|wholesome': 'MW', 'morning|sarcastic': 'MS', 'morning|unhinged': 'MU',
      'afternoon|wholesome': 'AW', 'afternoon|sarcastic': 'AS', 'afternoon|unhinged': 'AU',
      'evening|wholesome': 'EW', 'evening|sarcastic': 'ES', 'evening|unhinged': 'EU',
    };
    (['morning', 'afternoon', 'evening'] as const).forEach((slot) => {
      (['wholesome', 'sarcastic', 'unhinged'] as const).forEach((tier) => {
        const { pool } = pickGreetingPool(T, tier, slot);
        expect(pool[0]).toBe(expected[`${slot}|${tier}`]);
      });
    });
  });

  test('omitting slot defaults to currentGreetingSlot()', () => {
    // Whatever the current real hour is, the default-slot call must agree with the explicit one.
    const expected = pickGreetingPool(T, 'wholesome', currentGreetingSlot());
    const actual = pickGreetingPool(T, 'wholesome');
    expect(actual).toEqual(expected);
  });
});

describe('currentGreetingSlot', () => {
  test('returns one of morning/afternoon/evening for the real wall clock', () => {
    expect(['morning', 'afternoon', 'evening']).toContain(currentGreetingSlot());
  });
});
```

### Step 4.2: Run the failing tests

- [ ] Run: `npx jest src/utils/__tests__/pickGreetingPool.test.ts -v`
- [ ] Expected: FAIL — `Cannot find module '../pickGreetingPool'`.

### Step 4.3: Create the utility file

- [ ] Create `src/utils/pickGreetingPool.ts`:

```ts
import { GreetingSlot } from './greetingVariants';
import type { PersonalityTier } from '../context/PersonalityContext';

/** The three time-of-day greeting slots (the fourth slot, 'headline', is independent). */
export type GreetingTimeSlot = Exclude<GreetingSlot, 'headline'>;

/** Map the current wall-clock hour to a greeting slot. <12 = morning, <18 = afternoon, otherwise evening. */
export function currentGreetingSlot(): GreetingTimeSlot {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/**
 * Pick the right tier-scoped greeting pool for the current slot.
 * Slot defaults to currentGreetingSlot() so callers don't need to know the hour.
 */
export function pickGreetingPool(
  t: any,
  tier: PersonalityTier,
  slot: GreetingTimeSlot = currentGreetingSlot(),
): { slot: GreetingTimeSlot; pool: string[] } {
  const pool =
    slot === 'morning'   ? t.greetingVariantsMorning[tier] :
    slot === 'afternoon' ? t.greetingVariantsAfternoon[tier] :
                           t.greetingVariantsEvening[tier];
  return { slot, pool };
}
```

### Step 4.4: Run the tests

- [ ] Run: `npx jest src/utils/__tests__/pickGreetingPool.test.ts -v`
- [ ] Expected: PASS — all 5 tests green.

### Step 4.5: Commit the utility + test

- [ ] Commit:

```bash
git add src/utils/pickGreetingPool.ts src/utils/__tests__/pickGreetingPool.test.ts
git commit -m "feat(personality): extract tier-aware pickGreetingPool utility"
```

### Step 4.6: Update HomeScreenV2 imports

- [ ] In `src/screens/HomeScreenV2.tsx`, find the existing import of `rotateVariant, GreetingSlot` from `'../utils/greetingVariants'` (around line 15). Add immediately below it:

```tsx
import { pickGreetingPool, GreetingTimeSlot } from '../utils/pickGreetingPool';
import { usePersonality } from '../context/PersonalityContext';
```

### Step 4.7: Delete the inline helpers

- [ ] In `src/screens/HomeScreenV2.tsx`, delete the inline `currentGreetingSlot`, `GreetingTimeSlot` type alias, and `pickGreetingPool` (currently lines 42–59, the block beginning with `// ---- Quick 260528-hmt — time-of-day pool selector for the rotating greeting kicker ----`). They're now in the utility.

(Note: `timeOfDayKey` at lines 35–40 is unrelated and stays — see spec §4 footnote.)

### Step 4.8: Read tier from the new hook

- [ ] Inside the `HomeScreenV2` component, after the existing `const { t, language, setLanguage } = useLanguage();` line (currently line 65), add:

```tsx
  const { tier } = usePersonality();
```

### Step 4.9: Pass tier to `pickGreetingPool` and tier-index `headlineVariants`

- [ ] In the `useState` initializers (currently lines 70–76), update the calls:

```tsx
  const [greetingText, setGreetingText] = useState<string>(() => {
    const { slot, pool } = pickGreetingPool(t, tier);
    return rotateVariant(slot, pool);
  });
  const [headlineText, setHeadlineText] = useState<string>(() =>
    rotateVariant('headline', t.headlineVariants[tier]),
  );
```

- [ ] In `rotate` (currently lines 78–82), update both calls and add `tier` to deps:

```tsx
  const rotate = useCallback(() => {
    const { slot, pool } = pickGreetingPool(t, tier);
    setGreetingText(rotateVariant(slot, pool));
    setHeadlineText(rotateVariant('headline', t.headlineVariants[tier]));
  }, [t, tier]);
```

### Step 4.10: Add the tier-change rotation effect

- [ ] Immediately after the existing language-change effect (currently lines 87–90), add a 5th-by-position trigger modeled on the language pattern:

```tsx
  // Re-pick whenever the tier changes so the displayed copy matches the active tier pool.
  const tierMountRef = useRef(true);
  useEffect(() => {
    if (tierMountRef.current) { tierMountRef.current = false; return; }
    rotate();
  }, [tier, rotate]);
```

### Step 4.11: Type-check and run all tests

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: clean. The Task 3 errors are gone now that callsites pass `tier` and index into the tier maps.
- [ ] Run: `npm test`
- [ ] Expected: all existing tests pass; PersonalityContext + pickGreetingPool tests pass.

### Step 4.12: Commit

- [ ] Commit:

```bash
git add src/screens/HomeScreenV2.tsx
git commit -m "feat(personality): consume PersonalityContext on HomeScreenV2 + re-rotate on tier change"
```

---

## Task 5: TierChip component (TDD)

**Files:**
- Create: `src/components/home/v2/TierChip.tsx`
- Create test: `src/components/home/v2/__tests__/TierChip.test.tsx`

Pill-shaped chip showing the active tier. Tap = `cycleTier`; long-press = `onOpenPicker`. Uses `LinearGradient` for the Sarcastic/Unhinged background (same dep already used by `BigFeedCard`, `EditorialDock`, `HeroCard`). Uses `lucide-react-native` `Sparkles` and `Flame` for the active-tier icons. Vibration via RN core `Vibration` (no new dep).

### Step 5.1: Write the failing tests

- [ ] Create `src/components/home/v2/__tests__/TierChip.test.tsx`:

```tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { TierChip } from '../TierChip';

describe('TierChip', () => {
  test('renders WHOLESOME label when tier is wholesome', () => {
    const tree = TestRenderer.create(
      <TierChip tier="wholesome" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="Personality: Wholesome" a11yHint="Double tap to switch, long press to pick" />
    );
    const joined = JSON.stringify(tree.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('WHOLESOME');
  });

  test('renders SARCASTIC label when tier is sarcastic', () => {
    const tree = TestRenderer.create(
      <TierChip tier="sarcastic" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
    );
    const joined = JSON.stringify(tree.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('SARCASTIC');
  });

  test('renders UNHINGED label when tier is unhinged', () => {
    const tree = TestRenderer.create(
      <TierChip tier="unhinged" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
    );
    const joined = JSON.stringify(tree.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('UNHINGED');
  });

  test('tap invokes onCycle', () => {
    const onCycle = jest.fn();
    const tree = TestRenderer.create(
      <TierChip tier="wholesome" onCycle={onCycle} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
    );
    const touchable = tree.root.findByType(TouchableOpacity);
    act(() => { (touchable.props as any).onPress(); });
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  test('long-press invokes onOpenPicker', () => {
    const onOpenPicker = jest.fn();
    const tree = TestRenderer.create(
      <TierChip tier="sarcastic" onCycle={() => {}} onOpenPicker={onOpenPicker} a11yLabel="x" a11yHint="x" />
    );
    const touchable = tree.root.findByType(TouchableOpacity);
    act(() => { (touchable.props as any).onLongPress(); });
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  test('exposes accessibility label and hint', () => {
    const tree = TestRenderer.create(
      <TierChip tier="sarcastic" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="Personality: Sarcastic" a11yHint="Double tap to switch, long press to pick" />
    );
    const touchable = tree.root.findByType(TouchableOpacity);
    expect((touchable.props as any).accessibilityLabel).toBe('Personality: Sarcastic');
    expect((touchable.props as any).accessibilityHint).toBe('Double tap to switch, long press to pick');
    expect((touchable.props as any).accessibilityRole).toBe('button');
  });
});
```

### Step 5.2: Run, see it fail

- [ ] Run: `npx jest src/components/home/v2/__tests__/TierChip.test.tsx -v`
- [ ] Expected: FAIL — `Cannot find module '../TierChip'`.

### Step 5.3: Create the TierChip component

- [ ] Create `src/components/home/v2/TierChip.tsx`:

```tsx
import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Vibration } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Sparkles, Flame } from 'lucide-react-native';
import { V2 } from './theme';
import type { PersonalityTier } from '../../../context/PersonalityContext';

export interface TierChipProps {
  tier: PersonalityTier;
  onCycle: () => void;
  onOpenPicker: () => void;
  /** Localized "Personality: <tier>" string for VoiceOver/TalkBack. */
  a11yLabel: string;
  /** Localized "Double tap to switch, long press to pick" hint. */
  a11yHint: string;
}

const LABELS: Record<PersonalityTier, string> = {
  wholesome: 'WHOLESOME',
  sarcastic: 'SARCASTIC',
  unhinged:  'UNHINGED',
};

export const TierChip: React.FC<TierChipProps> = ({
  tier, onCycle, onOpenPicker, a11yLabel, a11yHint,
}) => {
  const handlePress = () => {
    Vibration.vibrate(10);
    onCycle();
  };
  const handleLongPress = () => {
    Vibration.vibrate(15);
    onOpenPicker();
  };

  const label = LABELS[tier];
  const Icon = tier === 'sarcastic' ? Sparkles : tier === 'unhinged' ? Flame : null;
  const iconColor = tier === 'unhinged' ? '#ffd8a3' : '#ffba66';

  const inner = (
    <View style={styles.inner}>
      {Icon ? <Icon size={11} color={iconColor} strokeWidth={2.4} /> : <Text style={styles.dot}>○</Text>}
      <Text
        style={[
          styles.label,
          tier === 'wholesome' && { color: V2.textMuted },
          tier === 'sarcastic' && { color: iconColor },
          tier === 'unhinged'  && { color: iconColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
    >
      {tier === 'wholesome' ? (
        <View style={[styles.pill, styles.pillWholesome]}>{inner}</View>
      ) : (
        <LinearGradient
          colors={
            tier === 'sarcastic'
              ? ['rgba(255,170,77,0.18)', 'rgba(255,77,160,0.16)']
              : ['rgba(255,170,77,0.32)', 'rgba(255,77,160,0.28)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.pill,
            tier === 'sarcastic' && styles.pillSarcastic,
            tier === 'unhinged'  && styles.pillUnhinged,
          ]}
        >
          {inner}
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  pillWholesome: { backgroundColor: V2.surface, borderColor: V2.border },
  pillSarcastic: { borderColor: 'rgba(255,170,77,0.45)' },
  pillUnhinged:  { borderColor: 'rgba(255,170,77,0.7)' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { color: V2.textMuted, fontSize: 11, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
});
```

### Step 5.4: Run the tests

- [ ] Run: `npx jest src/components/home/v2/__tests__/TierChip.test.tsx -v`
- [ ] Expected: PASS — all 6 tests green. (`react-native-linear-gradient` and `lucide-react-native` are already mocked globally in `jest.setup.js`.)

### Step 5.5: Commit

- [ ] Commit:

```bash
git add src/components/home/v2/TierChip.tsx src/components/home/v2/__tests__/TierChip.test.tsx
git commit -m "feat(personality): TierChip component with cycle + long-press picker"
```

---

## Task 6: TierPickerSheet component (TDD)

**Files:**
- Create: `src/components/home/v2/TierPickerSheet.tsx`
- Create test: `src/components/home/v2/__tests__/TierPickerSheet.test.tsx`

Bottom sheet built with RN core `Modal`. Three radio rows; tapping a row calls `onSelect(tier)` and the parent dismisses. Tap backdrop = `onDismiss`. The sheet receives the three preview strings from the caller (the caller knows the active language and pulls them from `translations.ts`) — keeps the component itself ignorant of `useLanguage`.

### Step 6.1: Write the failing tests

- [ ] Create `src/components/home/v2/__tests__/TierPickerSheet.test.tsx`:

```tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity, Modal } from 'react-native';
import { TierPickerSheet } from '../TierPickerSheet';

const PREVIEWS = {
  wholesome: 'Доброе утро, Becky.',
  sarcastic: 'Доброе утро. Опять ищем машину?',
  unhinged:  'Ты вернулся. Машины тоже.',
};

describe('TierPickerSheet', () => {
  test('renders nothing meaningful when visible=false', () => {
    const tree = TestRenderer.create(
      <TierPickerSheet
        visible={false}
        currentTier="sarcastic"
        previews={PREVIEWS}
        labels={{ title: 'PERSONALITY', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
        onSelect={() => {}}
        onDismiss={() => {}}
      />
    );
    const modal = tree.root.findByType(Modal);
    expect((modal.props as any).visible).toBe(false);
  });

  test('shows all three tier rows with previews when visible', () => {
    const tree = TestRenderer.create(
      <TierPickerSheet
        visible={true}
        currentTier="sarcastic"
        previews={PREVIEWS}
        labels={{ title: 'PERSONALITY', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
        onSelect={() => {}}
        onDismiss={() => {}}
      />
    );
    const joined = JSON.stringify(tree.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Wholesome');
    expect(joined).toContain('Sarcastic');
    expect(joined).toContain('Unhinged');
    expect(joined).toContain(PREVIEWS.wholesome);
    expect(joined).toContain(PREVIEWS.sarcastic);
    expect(joined).toContain(PREVIEWS.unhinged);
  });

  test('tapping a tier row calls onSelect with that tier', () => {
    const onSelect = jest.fn();
    const tree = TestRenderer.create(
      <TierPickerSheet
        visible={true}
        currentTier="wholesome"
        previews={PREVIEWS}
        labels={{ title: 'PERSONALITY', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
        onSelect={onSelect}
        onDismiss={() => {}}
      />
    );
    // Each row is a TouchableOpacity with testID="tier-row-<tier>".
    const sarcasticRow = tree.root.findByProps({ testID: 'tier-row-sarcastic' });
    act(() => { (sarcasticRow.props as any).onPress(); });
    expect(onSelect).toHaveBeenCalledWith('sarcastic');
  });

  test('tapping the backdrop calls onDismiss', () => {
    const onDismiss = jest.fn();
    const tree = TestRenderer.create(
      <TierPickerSheet
        visible={true}
        currentTier="wholesome"
        previews={PREVIEWS}
        labels={{ title: 'PERSONALITY', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
        onSelect={() => {}}
        onDismiss={onDismiss}
      />
    );
    const backdrop = tree.root.findByProps({ testID: 'tier-sheet-backdrop' });
    act(() => { (backdrop.props as any).onPress(); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('selected row has accessibilityState.selected=true', () => {
    const tree = TestRenderer.create(
      <TierPickerSheet
        visible={true}
        currentTier="unhinged"
        previews={PREVIEWS}
        labels={{ title: 'PERSONALITY', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
        onSelect={() => {}}
        onDismiss={() => {}}
      />
    );
    const unhingedRow = tree.root.findByProps({ testID: 'tier-row-unhinged' });
    expect((unhingedRow.props as any).accessibilityState).toEqual({ selected: true });
    expect((unhingedRow.props as any).accessibilityRole).toBe('radio');
    const wholesomeRow = tree.root.findByProps({ testID: 'tier-row-wholesome' });
    expect((wholesomeRow.props as any).accessibilityState).toEqual({ selected: false });
  });
});
```

### Step 6.2: Run, see it fail

- [ ] Run: `npx jest src/components/home/v2/__tests__/TierPickerSheet.test.tsx -v`
- [ ] Expected: FAIL — `Cannot find module '../TierPickerSheet'`.

### Step 6.3: Create the TierPickerSheet component

- [ ] Create `src/components/home/v2/TierPickerSheet.tsx`:

```tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { V2 } from './theme';
import type { PersonalityTier } from '../../../context/PersonalityContext';

export interface TierPickerSheetProps {
  visible: boolean;
  currentTier: PersonalityTier;
  /** First-line preview per tier in the active language. */
  previews: Record<PersonalityTier, string>;
  /** Localized row labels + sheet title. */
  labels: {
    title: string;
    wholesome: string;
    sarcastic: string;
    unhinged: string;
  };
  onSelect: (tier: PersonalityTier) => void;
  onDismiss: () => void;
}

const TIERS: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];

export const TierPickerSheet: React.FC<TierPickerSheetProps> = ({
  visible, currentTier, previews, labels, onSelect, onDismiss,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        testID="tier-sheet-backdrop"
        style={styles.backdrop}
        onPress={onDismiss}
      />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.head}>
          <Text style={styles.title}>{labels.title}</Text>
          <TouchableOpacity onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.x}>×</Text>
          </TouchableOpacity>
        </View>

        {TIERS.map((tier) => {
          const selected = tier === currentTier;
          return (
            <TouchableOpacity
              key={tier}
              testID={`tier-row-${tier}`}
              onPress={() => onSelect(tier)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={[styles.dot, selected && styles.dotSelected]} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, selected && styles.rowNameSelected]}>
                  {labels[tier]}
                </Text>
                <Text style={styles.rowPreview}>«{previews[tier]}»</Text>
              </View>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 10, right: 10, bottom: 10,
    backgroundColor: '#0f1827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: V2.border,
    padding: 16,
  },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  x: { color: V2.textMuted, fontSize: 18, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: 'rgba(255,170,77,0.06)' },
  dot: {
    width: 16, height: 16, borderRadius: 999,
    borderWidth: 2, borderColor: '#2a3a55',
    marginTop: 2,
  },
  dotSelected: { borderColor: '#ffba66', backgroundColor: '#ffba66' },
  rowBody: { flex: 1 },
  rowName: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  rowNameSelected: { color: '#ffba66' },
  rowPreview: { color: V2.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  check: { color: '#ffba66', fontSize: 13, fontWeight: '800' },
});
```

### Step 6.4: Run the tests

- [ ] Run: `npx jest src/components/home/v2/__tests__/TierPickerSheet.test.tsx -v`
- [ ] Expected: PASS — all 5 tests green.

### Step 6.5: Commit

- [ ] Commit:

```bash
git add src/components/home/v2/TierPickerSheet.tsx src/components/home/v2/__tests__/TierPickerSheet.test.tsx
git commit -m "feat(personality): TierPickerSheet bottom sheet with radio rows"
```

---

## Task 7: Wire TierChip + TierPickerSheet into HomeScreenV2

**Files:**
- Modify: `src/screens/HomeScreenV2.tsx` (imports, body, the GreetingBlock `trailing` slot)
- Modify: `src/constants/translations.ts` (add 5 new label strings to each of the RU and EN blocks)

### Step 7.1: Add the picker-sheet label strings to translations

- [ ] In the RU block of `src/constants/translations.ts`, add these five keys (anywhere in the block; conventionally next to other RU labels around the existing greeting block):

```ts
    personalityTitle: 'ЛИЧНОСТЬ',
    personalityWholesome: 'Wholesome',
    personalitySarcastic: 'Sarcastic',
    personalityUnhinged: 'Unhinged',
    personalityA11yHint: 'Нажмите чтобы переключить, удерживайте чтобы выбрать',
```

- [ ] In the EN block, add the parallel five:

```ts
    personalityTitle: 'PERSONALITY',
    personalityWholesome: 'Wholesome',
    personalitySarcastic: 'Sarcastic',
    personalityUnhinged: 'Unhinged',
    personalityA11yHint: 'Double tap to switch, long press to pick',
```

(Tier names stay English in both languages — they're brand-name labels, not translatable terms. The handoff doc's appendix is consistent with this.)

### Step 7.2: Import the new components

- [ ] In `src/screens/HomeScreenV2.tsx`, add to the imports near `LangSwitchV2`:

```tsx
import { TierChip } from '../components/home/v2/TierChip';
import { TierPickerSheet } from '../components/home/v2/TierPickerSheet';
```

### Step 7.3: Add picker-sheet open state and `setTier` from the context

- [ ] Update the existing `const { tier } = usePersonality();` (added in Task 4.3) to also destructure `setTier` and `cycleTier`:

```tsx
  const { tier, setTier, cycleTier } = usePersonality();
  const [pickerVisible, setPickerVisible] = useState(false);
```

`useState` is already imported at the top of the file.

### Step 7.4: Wire the chip into the GreetingBlock trailing slot

- [ ] Locate the `<GreetingBlock ... trailing={...} />` JSX (currently around line 179–186). Update the `trailing` prop:

```tsx
      <GreetingBlock
        timeOfDay={greetingText}
        subject={subject}
        headline={headlineText}
        listingsCount={displayedCars.length}
        listingsNoun={t.listingsCount}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TierChip
              tier={tier}
              onCycle={cycleTier}
              onOpenPicker={() => setPickerVisible(true)}
              a11yLabel={`${t.personalityTitle}: ${t[`personality${tier.charAt(0).toUpperCase() + tier.slice(1)}` as keyof typeof t]}`}
              a11yHint={t.personalityA11yHint}
            />
            <LangSwitchV2 language={language} setLanguage={setLanguage} />
          </View>
        }
      />
```

`View` is already imported at the top of the file as part of the `react-native` import block (verify).

### Step 7.5: Render the picker sheet

- [ ] Add the picker sheet immediately *after* the `Header` declaration (before the return statement that uses it):

```tsx
  const previews = {
    wholesome: t.greetingVariantsMorning.wholesome[0],
    sarcastic: t.greetingVariantsMorning.sarcastic[0],
    unhinged:  t.greetingVariantsMorning.unhinged[0],
  };
```

Then inside the JSX returned from `HomeScreenV2` (after the closing `</...>` of whatever wraps `Header`, at the same level as the existing top-level fragment), render the sheet so it overlays everything:

```tsx
      <TierPickerSheet
        visible={pickerVisible}
        currentTier={tier}
        previews={previews}
        labels={{
          title: t.personalityTitle,
          wholesome: t.personalityWholesome,
          sarcastic: t.personalitySarcastic,
          unhinged:  t.personalityUnhinged,
        }}
        onSelect={(next) => {
          setTier(next);
          setTimeout(() => setPickerVisible(false), 150);
        }}
        onDismiss={() => setPickerVisible(false)}
      />
```

If you cannot find the right closing fragment in HomeScreenV2 to slot the sheet at the screen root, render it as a sibling of the existing `FlatList`/scroll content right before the closing tag of the screen's outermost wrapper. The `Modal` portals its content over everything anyway.

### Step 7.6: Type-check and test

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: clean.
- [ ] Run: `npm test`
- [ ] Expected: all tests pass.

### Step 7.7: Commit

- [ ] Commit:

```bash
git add src/screens/HomeScreenV2.tsx src/constants/translations.ts
git commit -m "feat(personality): mount TierChip + TierPickerSheet on Home"
```

---

## Task 8: Draft Sarcastic + Unhinged copy and pass per-language tone review

**Files:**
- Modify: `src/constants/translations.ts` (the 8 placeholder pools created in Task 3)

This is the **rollout gate**. The implementation branch is not mergeable until this task completes for both languages.

### Step 8.1: Draft the 160 lines

- [ ] Draft 10 Sarcastic and 10 Unhinged lines per slot (morning / afternoon / evening / headline) in both RU and EN. **Constraints (spec §1 guardrails + §5 tone rules):**

  - Punches at the **car / listing / situation** — never the user's wallet, taste, or worth.
  - Bilingual parity: each Sarcastic-RU line has a Sarcastic-EN counterpart that lands in its own language. **No literal translation.** Draft each pool in its own language.
  - Sarcastic = wry, knowing, conversational. Unhinged = theatrical, over-the-top, never mean.
  - **First line of each tier's morning pool is the picker-sheet preview** — pick a representative line, not necessarily the funniest. It's what users see when deciding what to opt into.

- [ ] Replace the placeholder arrays in `src/constants/translations.ts` for all 8 net-new pools (RU morning sarcastic, RU morning unhinged, …, EN headline unhinged). Each array is exactly 10 strings.

### Step 8.2: Verify no placeholders remain

- [ ] Run:

```bash
grep -c "_REPLACE_" src/constants/translations.ts
```

- [ ] Expected: `0`. **Non-zero means the branch is not mergeable.**

### Step 8.3: RU tone-review pass (gating)

- [ ] The product owner reads every RU Sarcastic and Unhinged line:
  - Each line is sarcastic or unhinged in its **own register**, not a translation of EN.
  - No line wallet-shames, body-shames, or punches at the user.
  - First line of each Sarcastic-morning and Unhinged-morning pool is a strong representative for the picker sheet.
- [ ] Owner records sign-off in the commit message (e.g. "RU tone review: signed off").

### Step 8.4: EN tone-review pass (gating)

- [ ] Same review, independently, for EN. Sign-off goes in the same commit message.

### Step 8.5: Commit

- [ ] Commit:

```bash
git add src/constants/translations.ts
git commit -m "feat(personality): Sarcastic + Unhinged copy (RU + EN tone-reviewed)"
```

---

## Task 9: Manual QA pass and regression sweep

**Files:** None modified.

Per spec §6. Run on **both iOS and Android** — the haptic and modal behaviors differ between platforms.

### Step 9.1: Run the full unit test suite

- [ ] Run: `npm test`
- [ ] Expected: all green. No skipped or failing tests.

### Step 9.2: Run lint

- [ ] Run: `npm run lint`
- [ ] Expected: no new warnings or errors in files this branch touched.

### Step 9.3: iOS manual QA

- [ ] `npm run ios`. Once the app loads on the simulator:
  - [ ] On Home, confirm `WHOLESOME` chip is visible next to the language pill, neutral surface, muted text — matches today's quiet default.
  - [ ] Confirm the home greeting and headline look **identical to a build off `main`** for a Wholesome user (regression guard).
  - [ ] Tap the chip → label flips to `SARCASTIC` with the amber gradient and Sparkles icon. The greeting + headline visibly change to Sarcastic copy in the active language. A small haptic fires.
  - [ ] Tap again → `UNHINGED` (intensified gradient + Flame icon). Copy changes again.
  - [ ] Tap once more → cycles back to `WHOLESOME`. Original quiet appearance restored.
  - [ ] Long-press the chip → picker sheet animates up from the bottom. Three rows present, each with the tier name and a preview from that tier's morning pool. Currently active tier shows the filled dot, label colored amber, and a `✓`.
  - [ ] Tap a different tier in the sheet → sheet dismisses after ~150ms, chip updates, greeting + headline update.
  - [ ] Tap the backdrop → sheet dismisses with no state change.
  - [ ] Hard-quit the app, relaunch → the chip is on the tier you last selected. (Persistence.)
  - [ ] Flip language with the LangSwitch → greeting + headline pool flip to the other language. Tier is preserved.
  - [ ] Enable VoiceOver. Focus the chip → announces "Personality: Sarcastic, button. Double tap to switch, long press to pick." Open the sheet → each row is focusable and announces its tier name and selected state.

### Step 9.4: Android manual QA

- [ ] `npm run android`. Repeat the entire Step 9.3 checklist on a real device or emulator.
- [ ] Additionally: enable TalkBack and verify the chip and sheet rows announce correctly under Android's accessibility service.
- [ ] Test silent mode: enable silent / Do Not Disturb. Tap the chip — confirm no audible buzz; haptic is suppressed by the OS.

### Step 9.5: Regression sweep

- [ ] Confirm the four other rotation triggers still work:
  - [ ] **Pull-to-refresh** on Home → greeting + headline re-pick (in current tier's pool).
  - [ ] Navigate to **CarDetails** and back → screen-focus trigger fires; greeting re-picks.
  - [ ] **Background the app** for 10 seconds, then return to foreground → AppState trigger fires; greeting re-picks.
  - [ ] **Toggle the language** → greeting + headline re-pick in the new language.
- [ ] Confirm CartContext, AuthContext, FavoritesContext are unaffected (sign in/out, add a car to favorites, check cart — all behave as before).

### Step 9.6: Visual sanity check on the Wholesome default

- [ ] Show the Home screen to someone who hasn't seen the previous design. Ask whether anything looks "default-on-spicy." The Wholesome chip is intentionally quiet (no icon glow, no gradient) — if they say it does, surface as a design issue before merge.

### Step 9.7: Commit / wrap

- [ ] If any fixes were needed during QA, commit them with a clear `fix(personality): <what>` message. If QA was clean, no commit needed.
- [ ] Push the branch and open a PR titled `feat(personality): tier setting (Wholesome/Sarcastic/Unhinged) with home chip + picker`. PR body should reference both the spec and the plan, and confirm the RU + EN tone-review sign-offs (Task 8) and the manual QA pass (Task 9).

---

## Post-merge

- Verify on the deployed build that the chip + sheet behave as designed for at least one real user (the product owner) before announcing the feature internally.
- Open the follow-up specs (deferred per spec §9):
  - Telemetry for tier adoption + distribution.
  - A1 Listing POV monologues (depends on the tier system now being shipped).
  - D1 Shareable branded listing card.
  - Backend mirror of `tier` on the user record (triggered when telemetry needs it).

The slot+tier-keyed anti-repeat registry refactor stays deferred indefinitely; revisit only on real user signal.
