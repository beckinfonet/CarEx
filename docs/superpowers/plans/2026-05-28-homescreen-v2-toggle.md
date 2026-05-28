# HomeScreen v2 + v1/v2 Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-device v1↔v2 design toggle, the v2 "Editorial" HomeScreen, and the v2 SearchResults screen — strictly cosmetic, no backend changes.

**Architecture:** Extract a shared `useHomeListings` hook from current `HomeScreen.tsx` (single source of truth for data + filters). Add a `UIVersionContext` (AsyncStorage-backed, default `'v1'`) read by router screens that pick `HomeScreen` (v1) vs `HomeScreenV2`. A new `SearchResultsV2` is pushed from the v2 home search pill. Promoted-listing structure (Big vs Small card hierarchy) is preserved in components; gold/ember/match/delta ornaments are cut until backend data exists.

**Tech Stack:** React Native 0.83 · TypeScript · `react-native-linear-gradient` (new) · Manrope + JetBrainsMono fonts (new) · `react-native-reanimated` (existing) · Jest + react-test-renderer (existing).

**Source-of-truth references:**
- Spec: `docs/superpowers/specs/2026-05-28-homescreen-v2-toggle-design.md`
- Design handoff: `docs/design-handoff/` (README + JSX + screenshots)

---

## Phase 0 — Foundations

Tasks in this phase must complete in order and **each is committed independently** so v1 behavior can be verified at every checkpoint.

### Task 0.1: Write characterization tests for `useHomeListings`

**Files:**
- Create: `src/hooks/__tests__/useHomeListings.test.tsx`

These tests describe the desired hook behavior — same behavior as the current `HomeScreen.tsx` filter/sort pipeline. They fail until Task 0.2 extracts the hook.

- [ ] **Step 1: Create the test file with the full test suite**

```tsx
// src/hooks/__tests__/useHomeListings.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import axios from 'axios';
import { useHomeListings } from '../useHomeListings';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setParams: jest.fn() }),
  useIsFocused: () => true,
  useRoute: () => ({ params: {} }),
}));

const SAMPLE_CARS = [
  { _id: 'a', makeId: '1', modelId: '10', make: 'BMW',    model: 'X5',    year: 2023, price: 52000, mileage: 12000, fuel: 'Бензин', currency: 'USD', listingStatus: 'active', bodyType: 'Кроссовер', transmission: 'Автомат', imageUrls: ['x'] },
  { _id: 'b', makeId: '2', modelId: '20', make: 'Audi',   model: 'Q5',    year: 2021, price: 38500, mileage: 41000, fuel: 'Бензин', currency: 'USD', listingStatus: 'active', bodyType: 'Кроссовер', transmission: 'Автомат', imageUrls: ['x'] },
  { _id: 'c', makeId: '1', modelId: '11', make: 'BMW',    model: 'X3',    year: 2021, price: 42000, mileage: 38000, fuel: 'Бензин', currency: 'USD', listingStatus: 'active', bodyType: 'Кроссовер', transmission: 'Автомат', imageUrls: ['x'] },
  { _id: 'd', makeId: '3', modelId: '30', make: 'Toyota', model: 'Camry', year: 2020, price: 24500, mileage: 78000, fuel: 'Бензин', currency: 'USD', listingStatus: 'sold',   bodyType: 'Седан',     transmission: 'Автомат', imageUrls: ['x'] },
];

let hookResult: ReturnType<typeof useHomeListings>;
function Probe(props: { opts?: Parameters<typeof useHomeListings>[0] }) {
  hookResult = useHomeListings(props.opts);
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.get.mockResolvedValue({ data: SAMPLE_CARS });
});

describe('useHomeListings', () => {
  test('fetches cars on mount and drops sold listings from displayedCars', async () => {
    await act(async () => { TestRenderer.create(<Probe />); });
    await flush();
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(hookResult.cars).toHaveLength(4);
    expect(hookResult.displayedCars).toHaveLength(3);
    expect(hookResult.displayedCars.find((c) => c.id === 'd')).toBeUndefined();
  });

  test('filters by selectedMake', async () => {
    await act(async () => { TestRenderer.create(<Probe />); });
    await flush();
    act(() => { hookResult.setSelectedMake({ id: '1', name: 'BMW' }); });
    expect(hookResult.displayedCars.map((c) => c.id).sort()).toEqual(['a', 'c']);
  });

  test('filters by selectedMake + selectedModel', async () => {
    await act(async () => { TestRenderer.create(<Probe />); });
    await flush();
    act(() => {
      hookResult.setSelectedMake({ id: '1', name: 'BMW' });
      hookResult.setSelectedModel({ id: '10', name: 'X5' });
    });
    expect(hookResult.displayedCars.map((c) => c.id)).toEqual(['a']);
  });

  test('sorts ascending by price via toggleQuickSort("sortPrice")', async () => {
    await act(async () => { TestRenderer.create(<Probe />); });
    await flush();
    act(() => { hookResult.toggleQuickSort('sortPrice'); });
    expect(hookResult.displayedCars.map((c) => c.price)).toEqual([38500, 42000, 52000]);
  });

  test('clearAll resets all filters', async () => {
    await act(async () => { TestRenderer.create(<Probe />); });
    await flush();
    act(() => {
      hookResult.setSelectedMake({ id: '1', name: 'BMW' });
      hookResult.toggleQuickSort('sortPrice');
    });
    expect(hookResult.displayedCars).toHaveLength(2);
    act(() => { hookResult.clearAll(); });
    expect(hookResult.selectedMake).toBeNull();
    expect(hookResult.activeFilters).toEqual({});
    expect(hookResult.displayedCars).toHaveLength(3);
  });

  test('availableModels lists unique models for the selected make', async () => {
    await act(async () => { TestRenderer.create(<Probe />); });
    await flush();
    act(() => { hookResult.setSelectedMake({ id: '1', name: 'BMW' }); });
    expect(hookResult.availableModels.map((m) => m.name).sort()).toEqual(['X3', 'X5']);
  });

  test('opts.initialFilters seeds activeFilters on first render', async () => {
    const opts = { initialFilters: { Цена: { min: '30000', max: '50000' } } };
    await act(async () => { TestRenderer.create(<Probe opts={opts} />); });
    await flush();
    expect(hookResult.displayedCars.map((c) => c.id).sort()).toEqual(['b', 'c']);
  });
});
```

- [ ] **Step 2: Run the test suite (expect failure — hook doesn't exist yet)**

Run: `npx jest src/hooks/__tests__/useHomeListings.test.tsx`
Expected: `Cannot find module '../useHomeListings'` for every test.

- [ ] **Step 3: Commit the tests**

```bash
git add src/hooks/__tests__/useHomeListings.test.tsx
git commit -m "test(home): characterization tests for useHomeListings extraction"
```

---

### Task 0.2: Extract `useHomeListings` from `HomeScreen.tsx`

**Files:**
- Create: `src/hooks/useHomeListings.ts`

The hook owns: car fetch, filter state (`selectedMake/Model/Category`, `activeFilters`, `filtersVisible`), derivations (`displayedCars`, `availableModels`), and handlers. Pre-sort step prepends a `(promoted desc, createdAt desc)` ordering before any user sort applies — collapses to "newest first" today since no listing has `promoted: true`.

- [ ] **Step 1: Create the hook file**

```ts
// src/hooks/useHomeListings.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import { API_URL } from '../constants/config';
import { CATEGORIES } from '../constants/mockData';

export type ActiveFilters = { [key: string]: any };
export type SelectedRef = { id: string; name: string } | null;

export interface UseHomeListingsOpts {
  initialFilters?: ActiveFilters;
}

export function useHomeListings(opts: UseHomeListingsOpts = {}) {
  const isFocused = useIsFocused();

  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMake, setSelectedMake] = useState<SelectedRef>(null);
  const [selectedModel, setSelectedModel] = useState<SelectedRef>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(opts.initialFilters ?? {});
  const [filtersVisible, setFiltersVisible] = useState(false);

  const fetchCars = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars`);
      const apiCars = response.data.map((car: any) => ({
        id: car._id,
        makeId: car.makeId,
        modelId: car.modelId,
        make: car.make || car.makeName,
        model: car.model || car.modelName,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        fuel: car.fuel,
        currency: car.currency,
        image: (car.imageUrls && car.imageUrls.length > 0) ? car.imageUrls[0] : (car.imageUrl || 'https://via.placeholder.com/400x300'),
        imageUrls: car.imageUrls || (car.imageUrl ? [car.imageUrl] : []),
        listingStatus: car.listingStatus || 'active',
        ...car,
      }));
      setCars(apiCars);
    } catch (error) {
      console.error('Failed to fetch cars:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchCars();
    }
  }, [isFocused, fetchCars]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchCars();
  }, [fetchCars]);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (car.listingStatus === 'sold') return false;
      const makeIdStr = car.makeId != null ? String(car.makeId) : null;
      const modelIdStr = car.modelId != null ? String(car.modelId) : null;
      const carMakeLower = car.make?.toLowerCase() ?? '';
      const carModelLower = car.model?.toLowerCase() ?? '';
      const selectedMakeNameLower = selectedMake?.name?.toLowerCase() ?? '';
      const selectedModelNameLower = selectedModel?.name?.toLowerCase() ?? '';

      const modelNameMatches = (a: string, b: string) =>
        a === b || (a && b && (a.startsWith(b) || b.startsWith(a)));

      const matchesSearch =
        (!selectedMake && !selectedModel) ||
        (selectedMake && !selectedModel && (
          makeIdStr === selectedMake.id ||
          carMakeLower === selectedMakeNameLower
        )) ||
        (selectedMake && selectedModel && (
          (makeIdStr === selectedMake.id && modelIdStr === selectedModel.id) ||
          (makeIdStr === selectedMake.id && !modelIdStr && modelNameMatches(carModelLower, selectedModelNameLower)) ||
          (carMakeLower === selectedMakeNameLower && modelNameMatches(carModelLower, selectedModelNameLower))
        ));

      let matchesFilters = true;
      if (activeFilters['Год']) {
        const { min, max } = activeFilters['Год'];
        if (min && car.year < parseInt(min)) matchesFilters = false;
        if (max && car.year > parseInt(max)) matchesFilters = false;
      }
      if (activeFilters['Цена']) {
        const { min, max } = activeFilters['Цена'];
        if (min && car.price < parseInt(min)) matchesFilters = false;
        if (max && car.price > parseInt(max)) matchesFilters = false;
      }
      if (activeFilters['Пробег']) {
        const { min, max } = activeFilters['Пробег'];
        if (min && car.mileage < parseInt(min)) matchesFilters = false;
        if (max && car.mileage > parseInt(max)) matchesFilters = false;
      }
      if (activeFilters['Топливо'] && activeFilters['Топливо'] !== car.fuel) matchesFilters = false;
      if (activeFilters['КПП'] && activeFilters['КПП'] !== car.transmission) matchesFilters = false;

      if (!selectedCategory) return matchesSearch && matchesFilters;

      const category = CATEGORIES.find((c) => c.id === selectedCategory);
      if (!category) return matchesSearch && matchesFilters;

      const bodyType = car.bodyType || '';
      const matchesCategory =
        bodyType.toLowerCase().includes(category.name.toLowerCase()) ||
        category.name.toLowerCase().includes(bodyType.toLowerCase()) ||
        (category.id === 2 && bodyType.toLowerCase().includes('suv'));

      return matchesSearch && matchesCategory && matchesFilters;
    });
  }, [cars, selectedMake, selectedModel, selectedCategory, activeFilters]);

  const displayedCars = useMemo(() => {
    // Pre-sort: (promoted desc, createdAt desc). Today collapses to newest-first
    // since no listing has promoted=true. Lights up automatically when backend
    // adds the flag.
    const presorted = [...filteredCars].sort((a, b) => {
      const ap = a.promoted ? 1 : 0;
      const bp = b.promoted ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

    const sortPrice = activeFilters['sortPrice'];
    const sortMileage = activeFilters['sortMileage'];
    const sortYear = activeFilters['sortYear'];
    if (!sortPrice && !sortMileage && !sortYear) return presorted;

    return [...presorted].sort((a, b) => {
      if (sortPrice) {
        const cmp = sortPrice === 'asc' ? (a.price ?? 0) - (b.price ?? 0) : (b.price ?? 0) - (a.price ?? 0);
        if (cmp !== 0) return cmp;
      }
      if (sortMileage) {
        const cmp = sortMileage === 'asc' ? (a.mileage ?? 0) - (b.mileage ?? 0) : (b.mileage ?? 0) - (a.mileage ?? 0);
        if (cmp !== 0) return cmp;
      }
      if (sortYear) {
        const cmp = sortYear === 'asc' ? (a.year ?? 0) - (b.year ?? 0) : (b.year ?? 0) - (a.year ?? 0);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [filteredCars, activeFilters]);

  const availableModels = useMemo(() => {
    if (!selectedMake) return [];
    const carMakeLower = (c: any) => c.make?.toLowerCase() ?? '';
    const selectedMakeNameLower = selectedMake.name?.toLowerCase() ?? '';
    const matchesMake = (car: any) => {
      if (car.listingStatus === 'sold') return false;
      const mid = car.makeId != null ? String(car.makeId) : null;
      return mid === selectedMake.id || carMakeLower(car) === selectedMakeNameLower;
    };
    const seen = new Set<string>();
    const models: { id: string; name: string }[] = [];
    for (const car of cars.filter(matchesMake)) {
      const name = (car.model || car.modelName || '').trim();
      if (!name) continue;
      const key = (car.modelId != null ? String(car.modelId) : name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      models.push({ id: car.modelId != null ? String(car.modelId) : name, name });
    }
    models.sort((a, b) => a.name.localeCompare(b.name));
    return models;
  }, [cars, selectedMake]);

  const applyFilter = useCallback((filterType: string, value: any) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value === null || (typeof value === 'object' && !value.min && !value.max)) {
        delete next[filterType];
      } else {
        next[filterType] = value;
      }
      return next;
    });
  }, []);

  const toggleQuickSort = useCallback((filterType: 'sortPrice' | 'sortMileage' | 'sortYear') => {
    setActiveFilters((prev) => {
      const current = prev[filterType];
      const nextDir = current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc';
      const next = { ...prev };
      delete next['sortPrice'];
      delete next['sortMileage'];
      delete next['sortYear'];
      if (nextDir) next[filterType] = nextDir;
      return next;
    });
  }, []);

  const resetQuickSort = useCallback(() => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      delete next['sortPrice'];
      delete next['sortMileage'];
      delete next['sortYear'];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedMake(null);
    setSelectedModel(null);
    setSelectedCategory(null);
    setActiveFilters({});
    setFiltersVisible(false);
  }, []);

  return {
    cars,
    loading,
    refreshing,
    refresh,
    selectedMake, setSelectedMake,
    selectedModel, setSelectedModel,
    selectedCategory, setSelectedCategory,
    activeFilters,
    filtersVisible, setFiltersVisible,
    displayedCars,
    availableModels,
    applyFilter,
    toggleQuickSort,
    resetQuickSort,
    clearAll,
  };
}
```

- [ ] **Step 2: Run hook tests (expect all pass)**

Run: `npx jest src/hooks/__tests__/useHomeListings.test.tsx`
Expected: All 7 tests PASS.

- [ ] **Step 3: Run full Jest suite (expect no regressions)**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHomeListings.ts
git commit -m "feat(home): extract useHomeListings hook from HomeScreen"
```

---

### Task 0.3: Refactor `HomeScreen.tsx` to consume `useHomeListings`

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

Goal: v1 Home keeps rendering byte-for-byte the same UI. Only the state-management plumbing changes.

- [ ] **Step 1: Replace state declarations and handlers with hook consumption**

Open `src/screens/HomeScreen.tsx`. Replace lines from `const [selectedMake, setSelectedMake] = ...` through `const handleQuickSortReset = ...` (currently lines ~32-268) with:

```tsx
  const {
    cars,
    loading,
    refreshing,
    refresh: onRefresh,
    selectedMake, setSelectedMake,
    selectedModel, setSelectedModel,
    selectedCategory, setSelectedCategory,
    activeFilters,
    filtersVisible, setFiltersVisible,
    displayedCars,
    availableModels,
    applyFilter: handleApplyFilter,
    toggleQuickSort: handleQuickSortToggle,
    resetQuickSort: handleQuickSortReset,
    clearAll,
  } = useHomeListings();

  const [modalVisible, setModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.clearFilters) {
      clearAll();
      navigation.setParams({ clearFilters: false });
    }
  }, [route.params?.clearFilters, clearAll, navigation]);

  // Android back handler: unwind filters, then exit prompt
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      const hasOtherFilters = selectedCategory != null || Object.keys(activeFilters).length > 0;
      if (selectedMake && selectedModel) { setSelectedModel(null); return true; }
      if (selectedMake || hasOtherFilters) { clearAll(); return true; }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) { BackHandler.exitApp(); return true; }
      lastBackPressRef.current = now;
      ToastAndroid.show(t.pressBackAgainToExit, ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, t.pressBackAgainToExit, selectedMake, selectedModel, selectedCategory, activeFilters, setSelectedModel, clearAll]);

  const handleCarPress = (car: any) => {
    navigation.navigate('CarDetails', { carId: car.id, carData: car });
  };
  const handleFilterPress = (filter: string) => {
    setCurrentFilterType(filter);
    setModalVisible(true);
  };
  const handleProfilePress = () => {
    if (user) navigation.navigate('Profile');
    else navigation.navigate('Login');
  };
```

Then add the hook import at the top:

```tsx
import { useHomeListings } from '../hooks/useHomeListings';
```

Remove now-unused imports: `axios`, `API_URL` if not used elsewhere. Verify by Cmd+F in the file.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors. (If pre-existing errors exist, they should be the same count as before.)

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass, including the new hook tests.

- [ ] **Step 4: Manual visual regression check**

```
1. Run the app: npm run ios (or npm run android)
2. Open Home. Verify it renders identically to before — same header,
   same search bar, same filter chips, same carousel, same car list.
3. Tap a filter, apply it. Verify list filters correctly.
4. Pull-to-refresh. Verify it works.
5. Press Android back button (if on Android) — verify filter unwind.
```

If anything looks different from before, do **not** continue — investigate the diff.

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "refactor(home): consume useHomeListings; preserve v1 behavior"
```

---

### Task 0.4: Create `UIVersionContext` + `useUIVersion`

**Files:**
- Create: `src/context/UIVersionContext.tsx`
- Create: `src/context/__tests__/UIVersionContext.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/context/__tests__/UIVersionContext.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UIVersionProvider, useUIVersion } from '../UIVersionContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const mockedAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let hookResult: ReturnType<typeof useUIVersion>;
function Probe() {
  hookResult = useUIVersion();
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => { jest.clearAllMocks(); });

describe('UIVersionContext', () => {
  test('defaults to v1 with inviteDismissed=false when AsyncStorage is empty', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    expect(hookResult.version).toBe('v1');
    expect(hookResult.inviteDismissed).toBe(false);
  });

  test('hydrates v2 from AsyncStorage on mount', async () => {
    mockedAsync.getItem.mockImplementation(async (k) => {
      if (k === 'ui_design_version') return 'v2';
      if (k === 'ui_design_invite_dismissed_v2') return 'true';
      return null;
    });
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    expect(hookResult.version).toBe('v2');
    expect(hookResult.inviteDismissed).toBe(true);
  });

  test('setVersion persists to AsyncStorage', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    await act(async () => { hookResult.setVersion('v2'); });
    await flush();
    expect(mockedAsync.setItem).toHaveBeenCalledWith('ui_design_version', 'v2');
    expect(hookResult.version).toBe('v2');
  });

  test('dismissInvite persists and updates state', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    await act(async () => { hookResult.dismissInvite(); });
    await flush();
    expect(mockedAsync.setItem).toHaveBeenCalledWith('ui_design_invite_dismissed_v2', 'true');
    expect(hookResult.inviteDismissed).toBe(true);
  });

  test('useUIVersion throws outside provider', () => {
    expect(() => {
      let result: any;
      function Bad() { result = useUIVersion(); return null; }
      TestRenderer.create(<Bad />);
    }).toThrow(/UIVersionProvider/);
  });
});
```

- [ ] **Step 2: Run tests (expect failure — module missing)**

Run: `npx jest src/context/__tests__/UIVersionContext.test.tsx`
Expected: `Cannot find module '../UIVersionContext'`.

- [ ] **Step 3: Implement the context**

```tsx
// src/context/UIVersionContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UIVersion = 'v1' | 'v2';

interface UIVersionContextValue {
  version: UIVersion;
  setVersion: (v: UIVersion) => void;
  inviteDismissed: boolean;
  dismissInvite: () => void;
}

const STORAGE_KEY_VERSION = 'ui_design_version';
const STORAGE_KEY_INVITE  = 'ui_design_invite_dismissed_v2';

const UIVersionContext = createContext<UIVersionContextValue | null>(null);

export const UIVersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [version, setVersionState] = useState<UIVersion>('v1');
  const [inviteDismissed, setInviteDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedVersion, storedDismissed] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_VERSION),
          AsyncStorage.getItem(STORAGE_KEY_INVITE),
        ]);
        if (storedVersion === 'v2') setVersionState('v2');
        if (storedDismissed === 'true') setInviteDismissed(true);
      } catch (e) {
        console.error('UIVersionContext hydration failed:', e);
      }
    })();
  }, []);

  const setVersion = useCallback((v: UIVersion) => {
    setVersionState(v);
    AsyncStorage.setItem(STORAGE_KEY_VERSION, v).catch((e) =>
      console.error('UIVersionContext setVersion persist failed:', e)
    );
  }, []);

  const dismissInvite = useCallback(() => {
    setInviteDismissed(true);
    AsyncStorage.setItem(STORAGE_KEY_INVITE, 'true').catch((e) =>
      console.error('UIVersionContext dismissInvite persist failed:', e)
    );
  }, []);

  return (
    <UIVersionContext.Provider value={{ version, setVersion, inviteDismissed, dismissInvite }}>
      {children}
    </UIVersionContext.Provider>
  );
};

export function useUIVersion(): UIVersionContextValue {
  const ctx = useContext(UIVersionContext);
  if (!ctx) throw new Error('useUIVersion must be used within a UIVersionProvider');
  return ctx;
}
```

- [ ] **Step 4: Run tests (expect pass)**

Run: `npx jest src/context/__tests__/UIVersionContext.test.tsx`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/UIVersionContext.tsx src/context/__tests__/UIVersionContext.test.tsx
git commit -m "feat(ui-version): add UIVersionContext + useUIVersion hook"
```

---

### Task 0.5: Create `useTypography`

**Files:**
- Create: `src/hooks/useTypography.ts`
- Create: `src/hooks/__tests__/useTypography.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
// src/hooks/__tests__/useTypography.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { UIVersionProvider } from '../../context/UIVersionContext';
import { useTypography } from '../useTypography';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
}));

let result: ReturnType<typeof useTypography>;
function Probe() { result = useTypography(); return null; }

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
}

describe('useTypography', () => {
  test('returns undefined font families when version is v1', async () => {
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    expect(result.display).toBeUndefined();
    expect(result.mono).toBeUndefined();
    expect(result.weights.bold).toBe('700');
  });
});
```

- [ ] **Step 2: Run (expect fail)**

Run: `npx jest src/hooks/__tests__/useTypography.test.tsx`
Expected: `Cannot find module '../useTypography'`.

- [ ] **Step 3: Implement**

```ts
// src/hooks/useTypography.ts
import { useUIVersion } from '../context/UIVersionContext';

export interface TypographyFamilies {
  display: string | undefined;
  mono:    string | undefined;
  weights: {
    regular:  '400';
    medium:   '500';
    semibold: '600';
    bold:     '700';
    black:    '800';
  };
}

const WEIGHTS = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '800',
} as const;

export function useTypography(): TypographyFamilies {
  const { version } = useUIVersion();
  return {
    display: version === 'v2' ? 'Manrope'              : undefined,
    mono:    version === 'v2' ? 'JetBrainsMono-Medium' : undefined,
    weights: WEIGHTS,
  };
}
```

- [ ] **Step 4: Run tests (expect pass)**

Run: `npx jest src/hooks/__tests__/useTypography.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTypography.ts src/hooks/__tests__/useTypography.test.tsx
git commit -m "feat(ui-version): add useTypography hook"
```

---

### Task 0.6: Mount `UIVersionProvider` in `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add provider to the stack**

Open `App.tsx`. Find the provider chain (search for `LanguageProvider`). Wrap `LanguageProvider`'s children with `UIVersionProvider` so the new provider sits **inside** `LanguageProvider` and **outside** `NavigationContainer`.

Before:
```tsx
<LanguageProvider>
  <NavigationContainer linking={linking}>
    ...
  </NavigationContainer>
</LanguageProvider>
```

After:
```tsx
<LanguageProvider>
  <UIVersionProvider>
    <NavigationContainer linking={linking}>
      ...
    </NavigationContainer>
  </UIVersionProvider>
</LanguageProvider>
```

Add import at top:
```tsx
import { UIVersionProvider } from './src/context/UIVersionContext';
```

- [ ] **Step 2: Run full suite (no regressions)**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Manual sanity check**

```
npm run ios (or android)
Verify the app boots normally to Home. (Provider is inert until consumed.)
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(ui-version): mount UIVersionProvider in App.tsx"
```

---

### Task 0.7: Add font assets and link them

**Files:**
- Create: `src/assets/fonts/Manrope-Regular.ttf`
- Create: `src/assets/fonts/Manrope-Medium.ttf`
- Create: `src/assets/fonts/Manrope-SemiBold.ttf`
- Create: `src/assets/fonts/Manrope-Bold.ttf`
- Create: `src/assets/fonts/Manrope-ExtraBold.ttf`
- Create: `src/assets/fonts/JetBrainsMono-Medium.ttf`
- Create: `src/assets/fonts/JetBrainsMono-SemiBold.ttf`
- Create: `src/assets/fonts/JetBrainsMono-Bold.ttf`
- Create: `react-native.config.js`

- [ ] **Step 1: Download fonts from Google Fonts**

Manrope: https://fonts.google.com/specimen/Manrope → Download family → unzip → copy `.ttf` files for Regular, Medium, SemiBold, Bold, ExtraBold to `src/assets/fonts/`.

JetBrains Mono: https://fonts.google.com/specimen/JetBrains+Mono → Download family → unzip → copy `.ttf` files for Medium, SemiBold, Bold to `src/assets/fonts/`.

Verify with `ls src/assets/fonts/`:
```
JetBrainsMono-Bold.ttf
JetBrainsMono-Medium.ttf
JetBrainsMono-SemiBold.ttf
Manrope-Bold.ttf
Manrope-ExtraBold.ttf
Manrope-Medium.ttf
Manrope-Regular.ttf
Manrope-SemiBold.ttf
```

- [ ] **Step 2: Verify PostScript names with Font Book (macOS)**

Open Font Book.app → drag each .ttf in → click "Info" → confirm the "PostScript name" matches the file basename (e.g., `Manrope-Bold` for `Manrope-Bold.ttf`). If any mismatch, note it — the `fontFamily` string in RN must match the PostScript name, not the file name.

- [ ] **Step 3: Create `react-native.config.js`**

```js
// react-native.config.js
module.exports = {
  project: { ios: {}, android: {} },
  assets: ['./src/assets/fonts/'],
};
```

- [ ] **Step 4: Run the asset linker**

Run: `npx react-native-asset`
Expected output mentions copying fonts to iOS Info.plist and Android assets directory.

- [ ] **Step 5: Clean rebuild iOS**

```bash
cd ios && rm -rf build && cd ..
npm run ios
```
Expected: app boots; no font-related errors in Xcode console.

- [ ] **Step 6: Clean rebuild Android**

```bash
npm run android:clean
npm run android
```
Expected: app boots; no font-related errors in Logcat.

- [ ] **Step 7: Smoke-test fonts on screen (temporary)**

Temporarily edit `src/screens/HomeScreen.tsx`: add this line above the SafeAreaView return:

```tsx
console.log('FONT PROBE:', 'Manrope-Bold should render below if linked correctly');
```

And add a probe `<Text>` somewhere visible:
```tsx
<Text style={{ fontFamily: 'Manrope-Bold', fontSize: 28, color: '#FFD166' }}>
  Manrope probe — should look like Manrope ExtraBold
</Text>
<Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 16, color: '#67E8B6' }}>
  JetBrains Mono probe — fixed-width
</Text>
```

Verify both lines render in the bundled font (not the system fallback). On iOS, system fallback is San Francisco; on Android, Roboto. If the probe text looks identical to surrounding text, the font isn't linked — investigate before continuing.

- [ ] **Step 8: Remove the probe Text and console.log**

Revert the temporary HomeScreen edit completely.

- [ ] **Step 9: Commit**

```bash
git add src/assets/fonts/ react-native.config.js ios/carEx/Info.plist android/app/src/main/assets/fonts/
git commit -m "build(fonts): bundle Manrope + JetBrainsMono assets and link"
```

(The `react-native-asset` script may have also touched the Xcode project file; if so, include it: `git add ios/carEx.xcodeproj/project.pbxproj`.)

---

### Task 0.8: Install `react-native-linear-gradient`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/Podfile.lock`

- [ ] **Step 1: Install the package**

```bash
npm install react-native-linear-gradient
cd ios && pod install && cd ..
```

- [ ] **Step 2: Add jest mock for the native component**

Open `jest.setup.js`. Append:

```js
// react-native-linear-gradient — stub to a passthrough View.
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LinearGradient = (props) => React.createElement(View, props, props.children);
  LinearGradient.displayName = 'LinearGradient';
  return { __esModule: true, default: LinearGradient, LinearGradient };
});
```

- [ ] **Step 3: Smoke-test in the app**

Temporarily edit `src/screens/HomeScreen.tsx`: add:

```tsx
import LinearGradient from 'react-native-linear-gradient';
// ...
<LinearGradient
  colors={['rgba(8,9,12,0)', 'rgba(8,9,12,1)']}
  style={{ height: 60, width: '100%' }}
/>
```

Run the app; verify a vertical fade gradient renders. Then revert the temporary edit.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass (jest mock prevents native-module crash).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock jest.setup.js
git commit -m "build: add react-native-linear-gradient dep + jest mock"
```

---

### Task 0.9: Create v2 theme tokens

**Files:**
- Create: `src/components/home/v2/theme.ts`

- [ ] **Step 1: Write the theme file**

```ts
// src/components/home/v2/theme.ts
// v2 ("Editorial") design tokens. Separate from src/constants/theme.ts so v1
// components continue using COLORS/SIZES unchanged. Gold tokens (gold,
// goldGlow) intentionally omitted — all gold ornaments are cut from this
// milestone (see spec §5 cut list).
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
  radius: { hero: 24, big: 22, small: 16.5, shelf: 18, pill: 999 } as const,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/v2/theme.ts
git commit -m "feat(home-v2): add v2 design token bag"
```

---

## Phase 1 — v2 Components

Each component is a separate task with a render smoke test. The handoff JSX at `docs/design-handoff/carex-editorial.jsx` and `docs/design-handoff/carex-search-results.jsx` is the visual source of truth — translate CSS to RN `StyleSheet` per the cut list in spec §5.

Each task follows this pattern: write the component + render smoke test → run test → commit.

### Task 1.1: `FloatingSearchPill`

**Files:**
- Create: `src/components/home/v2/FloatingSearchPill.tsx`
- Create: `src/components/home/v2/__tests__/FloatingSearchPill.test.tsx`

**Spec ref:** §5.1. **Handoff ref:** `carex-editorial.jsx` → `const FloatingSearch = ...`.

**Cuts from handoff:** real backdrop blur (use flat `rgba(19,21,27,0.92)`).

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/FloatingSearchPill.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface FloatingSearchPillProps {
  placeholder: string;
  onPress: () => void;
  onFiltersPress: () => void;
}

export const FloatingSearchPill: React.FC<FloatingSearchPillProps> = ({
  placeholder, onPress, onFiltersPress,
}) => {
  const typo = useTypography();
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.85}>
        <Search size={17} color={V2.text} strokeWidth={2} />
        <Text style={[styles.placeholder, { fontFamily: typo.display, fontWeight: typo.weights.medium }]}>
          {placeholder}
        </Text>
        <TouchableOpacity style={styles.filtersButton} onPress={onFiltersPress}>
          <SlidersHorizontal size={16} color="#04101f" strokeWidth={2.4} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingLeft: 18,
    paddingRight: 6,
    backgroundColor: 'rgba(19,21,27,0.92)',
    borderWidth: 1,
    borderColor: V2.borderHi,
    borderRadius: V2.radius.pill,
    gap: 10,
  },
  placeholder: {
    flex: 1,
    color: V2.textFaint,
    fontSize: 14,
  },
  filtersButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: V2.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Write the render smoke test**

```tsx
// src/components/home/v2/__tests__/FloatingSearchPill.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { FloatingSearchPill } from '../FloatingSearchPill';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
}));

const wrap = (el: React.ReactElement) => <UIVersionProvider>{el}</UIVersionProvider>;

describe('FloatingSearchPill', () => {
  test('renders placeholder and calls handlers', async () => {
    const onPress = jest.fn();
    const onFiltersPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(wrap(
        <FloatingSearchPill placeholder="Что вы ищете?" onPress={onPress} onFiltersPress={onFiltersPress} />
      ));
    });
    const root = tree!.root;
    const touchables = root.findAllByType(TouchableOpacity);
    act(() => { touchables[0].props.onPress(); });
    act(() => { touchables[1].props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onFiltersPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test (expect pass)**

Run: `npx jest src/components/home/v2/__tests__/FloatingSearchPill.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/FloatingSearchPill.tsx src/components/home/v2/__tests__/FloatingSearchPill.test.tsx
git commit -m "feat(home-v2): add FloatingSearchPill"
```

---

### Task 1.2: `GreetingBlock`

**Files:**
- Create: `src/components/home/v2/GreetingBlock.tsx`
- Create: `src/components/home/v2/__tests__/GreetingBlock.test.tsx`

**Spec ref:** §5.2. **Handoff ref:** `carex-editorial.jsx` → `const Greeting = ...`.

**Cuts from handoff:** the "3 поиска" saved-searches chip.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/GreetingBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface GreetingBlockProps {
  /** Localized morning/afternoon/evening string, e.g. "Доброе утро". */
  timeOfDay: string;
  city: string;
  /** Localized headline, e.g. "Найдём ваше идеальное авто." */
  headline: string;
  /** Live count of listings currently displayed. */
  listingsCount: number;
  /** Localized noun "объявлений" / "listings". */
  listingsNoun: string;
}

export const GreetingBlock: React.FC<GreetingBlockProps> = ({
  timeOfDay, city, headline, listingsCount, listingsNoun,
}) => {
  const typo = useTypography();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.kicker, { fontFamily: typo.display }]}>
        {timeOfDay} · {city}
      </Text>
      <Text style={[styles.headline, { fontFamily: typo.display }]}>
        {headline}
      </Text>
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Sparkles size={12} color={V2.blue} strokeWidth={2.4} />
          <Text style={[styles.chipText, { fontFamily: typo.display, color: V2.blue }]}>
            {listingsCount} {listingsNoun}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper:   { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 6 },
  kicker:    {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.4,
    textTransform: 'uppercase', color: V2.textMuted, marginBottom: 6,
  },
  headline:  {
    fontSize: 30, fontWeight: '800', letterSpacing: -1.05,
    color: V2.text, lineHeight: 30,
  },
  chipRow:   { flexDirection: 'row', marginTop: 12, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: V2.radius.pill,
    backgroundColor: 'rgba(77,163,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(77,163,255,0.28)',
  },
  chipText:  { fontSize: 12, fontWeight: '700' },
});
```

- [ ] **Step 2: Write the test**

```tsx
// src/components/home/v2/__tests__/GreetingBlock.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { GreetingBlock } from '../GreetingBlock';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

describe('GreetingBlock', () => {
  test('renders time-of-day, city, headline, and count chip', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <GreetingBlock
            timeOfDay="Доброе утро"
            city="Москва"
            headline="Найдём ваше идеальное авто."
            listingsCount={42}
            listingsNoun="объявлений"
          />
        </UIVersionProvider>
      );
    });
    const texts = tree!.root.findAllByType(Text).map((n) => n.props.children);
    const joined = JSON.stringify(texts);
    expect(joined).toContain('Доброе утро');
    expect(joined).toContain('Москва');
    expect(joined).toContain('Найдём ваше идеальное авто.');
    expect(joined).toContain(42);
    expect(joined).toContain('объявлений');
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/GreetingBlock.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/GreetingBlock.tsx src/components/home/v2/__tests__/GreetingBlock.test.tsx
git commit -m "feat(home-v2): add GreetingBlock"
```

---

### Task 1.3: `HeroCard`

**Files:**
- Create: `src/components/home/v2/HeroCard.tsx`
- Create: `src/components/home/v2/__tests__/HeroCard.test.tsx`

**Spec ref:** §5.4. **Handoff ref:** `carex-editorial.jsx` → `const HeroFeatured = ...`.

**Cuts from handoff:** gold halo block, gold border variant, ember/flame icon block, gold kicker variant. `"Сегодня"` pulsing-dot pill renders only when `createdAt` is within 24h.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/HeroCard.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface HeroCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  bodyType?: string;
  price: number;
  image: string;
  createdAt?: string;
}

export interface HeroCardProps {
  car: HeroCardCar;
  /** Localized "СВЕЖЕЕ ПРЕДЛОЖЕНИЕ" kicker. */
  kicker: string;
  /** Localized "Сегодня" label for fresh pill. */
  todayLabel: string;
  /** Localized "Смотреть" CTA. */
  ctaLabel: string;
  /** Localized "км" suffix. */
  kmSuffix: string;
  /** Page indicator: total cards in rotator and current index. */
  pageIndex: number;
  pageCount: number;
  onPress: (car: HeroCardCar) => void;
}

function isFresh(createdAt?: string): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  car, kicker, todayLabel, ctaLabel, kmSuffix, pageIndex, pageCount, onPress,
}) => {
  const typo = useTypography();
  const fresh = isFresh(car.createdAt);

  return (
    <View style={styles.outer}>
      <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(car)} style={styles.card}>
        <View style={styles.photoWrap}>
          <Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(8,9,12,0)', 'rgba(8,9,12,0.55)', 'rgba(8,9,12,0.95)']}
            locations={[0.35, 0.75, 1]}
            style={StyleSheet.absoluteFill as any}
          />
          <View style={styles.topRow}>
            {fresh && (
              <View style={styles.todayPill}>
                <View style={styles.todayDot} />
                <Text style={[styles.todayText, { fontFamily: typo.display }]}>{todayLabel}</Text>
              </View>
            )}
            <View style={styles.pageDots}>
              {Array.from({ length: pageCount }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === pageIndex ? styles.dotActive : styles.dotIdle,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.bottomBlock}>
            <Text style={[styles.kicker, { fontFamily: typo.display, color: V2.blue }]}>
              {kicker}
            </Text>
            <Text style={[styles.makeModel, { fontFamily: typo.display }]}>
              {car.make} {car.model}
            </Text>
            <Text style={[styles.specs, { fontFamily: typo.mono }]}>
              {car.year} · {car.mileage.toLocaleString('en-US')} {kmSuffix}
              {car.bodyType ? ` · ${car.bodyType}` : ''}
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { fontFamily: typo.mono }]}>
                ${car.price.toLocaleString('en-US')}
              </Text>
              <View style={styles.cta}>
                <Text style={[styles.ctaText, { fontFamily: typo.display }]}>{ctaLabel}</Text>
                <ChevronRight size={16} color="#08090C" strokeWidth={2.4} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 14 },
  card: {
    borderRadius: V2.radius.hero,
    overflow: 'hidden',
    backgroundColor: V2.surfaceHi,
    borderWidth: 1,
    borderColor: V2.border,
  },
  photoWrap: { aspectRatio: 5 / 4, backgroundColor: '#1a1e28' },
  photo: { width: '100%', height: '100%' },
  topRow: {
    position: 'absolute', top: 16, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: V2.radius.pill,
    backgroundColor: 'rgba(8,9,12,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: V2.green },
  todayText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: V2.text,
  },
  pageDots: { flexDirection: 'row', gap: 6 },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 22, backgroundColor: V2.text },
  dotIdle:   { width: 6,  backgroundColor: 'rgba(255,255,255,0.35)' },

  bottomBlock: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  kicker: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.32,
    textTransform: 'uppercase', marginBottom: 6,
  },
  makeModel: {
    fontSize: 26, fontWeight: '800', letterSpacing: -0.78,
    color: V2.text, marginBottom: 4,
  },
  specs: { fontSize: 13, color: V2.textMuted, marginBottom: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  price: { fontSize: 30, fontWeight: '800', letterSpacing: -0.9, color: V2.text },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: V2.text,
  },
  ctaText: { fontSize: 14, fontWeight: '800', color: '#08090C', letterSpacing: -0.14 },
});
```

- [ ] **Step 2: Write tests**

```tsx
// src/components/home/v2/__tests__/HeroCard.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { HeroCard, HeroCardCar } from '../HeroCard';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const baseCar: HeroCardCar = {
  id: 'a', make: 'BMW', model: 'X5', year: 2023, mileage: 12000,
  bodyType: 'Кроссовер', price: 52000, image: 'https://x',
};
const freshCar = { ...baseCar, createdAt: new Date().toISOString() };
const oldCar   = { ...baseCar, createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() };

const wrap = (el: React.ReactElement) => <UIVersionProvider>{el}</UIVersionProvider>;

describe('HeroCard', () => {
  test('renders make+model, formatted price, and specs', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(wrap(
        <HeroCard car={baseCar} kicker="K" todayLabel="Сегодня" ctaLabel="Смотреть" kmSuffix="км" pageIndex={0} pageCount={1} onPress={jest.fn()} />
      ));
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('BMW');
    expect(joined).toContain('X5');
    expect(joined).toContain('$52,000');
    expect(joined).toContain('12,000');
    expect(joined).toContain('Кроссовер');
  });

  test('shows todayPill only for fresh cars', async () => {
    let freshTree: TestRenderer.ReactTestRenderer | null = null;
    let oldTree:   TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      freshTree = TestRenderer.create(wrap(
        <HeroCard car={freshCar} kicker="K" todayLabel="Сегодня" ctaLabel="Смотреть" kmSuffix="км" pageIndex={0} pageCount={1} onPress={jest.fn()} />
      ));
      oldTree = TestRenderer.create(wrap(
        <HeroCard car={oldCar}   kicker="K" todayLabel="Сегодня" ctaLabel="Смотреть" kmSuffix="км" pageIndex={0} pageCount={1} onPress={jest.fn()} />
      ));
    });
    const freshTexts = JSON.stringify(freshTree!.root.findAllByType(Text).map((n) => n.props.children));
    const oldTexts   = JSON.stringify(oldTree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(freshTexts).toContain('Сегодня');
    expect(oldTexts).not.toContain('Сегодня');
  });

  test('onPress fires with the car', async () => {
    const onPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(wrap(
        <HeroCard car={baseCar} kicker="K" todayLabel="Сегодня" ctaLabel="Смотреть" kmSuffix="км" pageIndex={0} pageCount={1} onPress={onPress} />
      ));
    });
    act(() => { tree!.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
    expect(onPress).toHaveBeenCalledWith(baseCar);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/components/home/v2/__tests__/HeroCard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/HeroCard.tsx src/components/home/v2/__tests__/HeroCard.test.tsx
git commit -m "feat(home-v2): add HeroCard"
```

---

### Task 1.4: `HeroRotator`

**Files:**
- Create: `src/components/home/v2/HeroRotator.tsx`
- Create: `src/components/home/v2/__tests__/HeroRotator.test.tsx`

**Spec ref:** §5.3. **Handoff ref:** `carex-editorial.jsx` (rotator behavior described in README; the JSX shows a single hero).

`FlatList` horizontal, `pagingEnabled`, snapping at full card width. No auto-advance.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/HeroRotator.tsx
import React, { useState, useCallback } from 'react';
import { FlatList, Dimensions, View, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { HeroCard, HeroCardCar } from './HeroCard';

export interface HeroRotatorProps {
  cars: HeroCardCar[];
  kicker: string;
  todayLabel: string;
  ctaLabel: string;
  kmSuffix: string;
  onCardPress: (car: HeroCardCar) => void;
}

export const HeroRotator: React.FC<HeroRotatorProps> = ({
  cars, kicker, todayLabel, ctaLabel, kmSuffix, onCardPress,
}) => {
  const [index, setIndex] = useState(0);
  const { width } = Dimensions.get('window');

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  }, [width]);

  if (cars.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={cars}
        keyExtractor={(c) => c.id}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index: i }) => (
          <View style={{ width }}>
            <HeroCard
              car={item}
              kicker={kicker}
              todayLabel={todayLabel}
              ctaLabel={ctaLabel}
              kmSuffix={kmSuffix}
              pageIndex={i}
              pageCount={cars.length}
              onPress={onCardPress}
            />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginTop: 8 },
});
```

- [ ] **Step 2: Write test**

```tsx
// src/components/home/v2/__tests__/HeroRotator.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { HeroRotator } from '../HeroRotator';
import type { HeroCardCar } from '../HeroCard';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const CARS: HeroCardCar[] = [
  { id: 'a', make: 'BMW',  model: 'X5', year: 2023, mileage: 12000, price: 52000, image: 'https://x' },
  { id: 'b', make: 'Audi', model: 'Q5', year: 2021, mileage: 41000, price: 38500, image: 'https://x' },
];

describe('HeroRotator', () => {
  test('returns null when cars is empty', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <HeroRotator cars={[]} kicker="K" todayLabel="T" ctaLabel="C" kmSuffix="км" onCardPress={jest.fn()} />
        </UIVersionProvider>
      );
    });
    expect(tree!.toJSON()).toBeNull();
  });

  test('renders one FlatList with cars.length items', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <HeroRotator cars={CARS} kicker="K" todayLabel="T" ctaLabel="C" kmSuffix="км" onCardPress={jest.fn()} />
        </UIVersionProvider>
      );
    });
    const flatLists = tree!.root.findAllByType(FlatList);
    expect(flatLists).toHaveLength(1);
    expect(flatLists[0].props.data).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/HeroRotator.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/HeroRotator.tsx src/components/home/v2/__tests__/HeroRotator.test.tsx
git commit -m "feat(home-v2): add HeroRotator"
```

---

### Task 1.5: `ShelfCard`

**Files:**
- Create: `src/components/home/v2/ShelfCard.tsx`
- Create: `src/components/home/v2/__tests__/ShelfCard.test.tsx`

**Spec ref:** §5.6. **Handoff ref:** `carex-editorial.jsx` → `const ShelfCard = ...`.

**Cuts from handoff:** match-score chip, market-delta line, promoted scale-up / gold border / ember icon. Always rendered in the "organic" path.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/ShelfCard.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface ShelfCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  image: string;
}

export interface ShelfCardProps {
  car: ShelfCardCar;
  kmSuffix: string;
  onPress: (car: ShelfCardCar) => void;
}

export const ShelfCard: React.FC<ShelfCardProps> = ({ car, kmSuffix, onPress }) => {
  const typo = useTypography();
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onPress(car)} style={styles.card}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
        <Text style={[styles.priceOverlay, { fontFamily: typo.mono }]}>
          ${car.price.toLocaleString('en-US')}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={1}>
          {car.make} {car.model}
        </Text>
        <Text style={[styles.specs, { fontFamily: typo.mono }]}>
          {car.year} · {car.mileage.toLocaleString('en-US')} {kmSuffix}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 168,
    backgroundColor: V2.surface,
    borderRadius: V2.radius.shelf,
    borderWidth: 1, borderColor: V2.border,
    overflow: 'hidden',
  },
  photoWrap: { aspectRatio: 4 / 3, backgroundColor: '#1a1e28' },
  photo: { width: '100%', height: '100%' },
  priceOverlay: {
    position: 'absolute', left: 10, bottom: 10,
    color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.32,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  info:   { padding: 10, paddingHorizontal: 11, paddingBottom: 12 },
  title:  { fontSize: 13, fontWeight: '700', color: V2.text, letterSpacing: -0.234 },
  specs:  { fontSize: 10.5, color: V2.textMuted, marginTop: 2, fontWeight: '500' },
});
```

- [ ] **Step 2: Write test**

```tsx
// src/components/home/v2/__tests__/ShelfCard.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { ShelfCard, ShelfCardCar } from '../ShelfCard';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const CAR: ShelfCardCar = { id: 'a', make: 'Audi', model: 'Q5', year: 2021, mileage: 41000, price: 38500, image: 'https://x' };

describe('ShelfCard', () => {
  test('renders title, specs, price and fires onPress', async () => {
    const onPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <ShelfCard car={CAR} kmSuffix="км" onPress={onPress} />
        </UIVersionProvider>
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Audi');
    expect(joined).toContain('Q5');
    expect(joined).toContain('$38,500');
    expect(joined).toContain('41,000');

    act(() => { tree!.root.findByType(TouchableOpacity).props.onPress(); });
    expect(onPress).toHaveBeenCalledWith(CAR);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/ShelfCard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/ShelfCard.tsx src/components/home/v2/__tests__/ShelfCard.test.tsx
git commit -m "feat(home-v2): add ShelfCard"
```

---

### Task 1.6: `SmartShelf`

**Files:**
- Create: `src/components/home/v2/SmartShelf.tsx`
- Create: `src/components/home/v2/__tests__/SmartShelf.test.tsx`

**Spec ref:** §5.5. **Handoff ref:** `carex-editorial.jsx` → `const SmartShelf = ...`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/SmartShelf.tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';
import { ShelfCard, ShelfCardCar } from './ShelfCard';

export interface SmartShelfProps {
  kicker: string;
  title: string;
  cars: ShelfCardCar[];
  kmSuffix: string;
  onCardPress: (car: ShelfCardCar) => void;
}

export const SmartShelf: React.FC<SmartShelfProps> = ({ kicker, title, cars, kmSuffix, onCardPress }) => {
  const typo = useTypography();
  if (cars.length === 0) return null;
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { fontFamily: typo.display }]}>{kicker}</Text>
        <Text style={[styles.title,  { fontFamily: typo.display }]}>{title}</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={cars}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 11 }} />}
        renderItem={({ item }) => (
          <ShelfCard car={item} kmSuffix={kmSuffix} onPress={onCardPress} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginTop: 22 },
  header:  { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  kicker:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: V2.blue, marginBottom: 5 },
  title:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.616, color: V2.text },
  listContent: { paddingHorizontal: 18, paddingBottom: 4 },
});
```

- [ ] **Step 2: Write test**

```tsx
// src/components/home/v2/__tests__/SmartShelf.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, FlatList } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { SmartShelf } from '../SmartShelf';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const CARS = [
  { id: 'a', make: 'Audi', model: 'Q5', year: 2021, mileage: 41000, price: 38500, image: 'https://x' },
  { id: 'b', make: 'BMW',  model: 'X5', year: 2023, mileage: 12000, price: 52000, image: 'https://x' },
];

describe('SmartShelf', () => {
  test('returns null when cars is empty', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <SmartShelf kicker="K" title="T" cars={[]} kmSuffix="км" onCardPress={jest.fn()} />
        </UIVersionProvider>
      );
    });
    expect(tree!.toJSON()).toBeNull();
  });

  test('renders header and a FlatList with the cars', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <SmartShelf kicker="JUST" title="Fresh" cars={CARS} kmSuffix="км" onCardPress={jest.fn()} />
        </UIVersionProvider>
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('JUST');
    expect(joined).toContain('Fresh');
    expect(tree!.root.findAllByType(FlatList)[0].props.data).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/SmartShelf.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/SmartShelf.tsx src/components/home/v2/__tests__/SmartShelf.test.tsx
git commit -m "feat(home-v2): add SmartShelf"
```

---

### Task 1.7: `SmallFeedCard`

**Files:**
- Create: `src/components/home/v2/SmallFeedCard.tsx`
- Create: `src/components/home/v2/__tests__/SmallFeedCard.test.tsx`

**Spec ref:** §5.8. **Handoff ref:** `carex-editorial.jsx` → `const SmallFeedCard = ...`.

**Cuts from handoff:** match-score chip on photo, market-delta line. Heart toggle keeps the API call hook but the prop interface in this milestone just exposes `faved` and `onToggleFav`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/SmallFeedCard.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, Gauge } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface SmallFeedCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  bodyType?: string;
  price: number;
  image: string;
}

export interface SmallFeedCardProps {
  car: SmallFeedCardCar;
  kmSuffix: string;
  faved: boolean;
  onPress: (car: SmallFeedCardCar) => void;
  onToggleFav: (car: SmallFeedCardCar) => void;
}

export const SmallFeedCard: React.FC<SmallFeedCardProps> = ({ car, kmSuffix, faved, onPress, onToggleFav }) => {
  const typo = useTypography();
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onPress(car)} style={styles.row}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={1}>
              {car.make} {car.model}
            </Text>
            <Text style={[styles.specs, { fontFamily: typo.mono }]} numberOfLines={1}>
              {car.year}{car.bodyType ? ` · ${car.bodyType}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onToggleFav(car)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.heartButton}
          >
            <Heart
              size={15}
              color={faved ? V2.favorite : V2.textMuted}
              fill={faved ? V2.favorite : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.mileageRow}>
          <Gauge size={11} color={V2.textFaint} strokeWidth={1.8} />
          <Text style={[styles.mileage, { fontFamily: typo.mono }]}>
            {car.mileage.toLocaleString('en-US')} {kmSuffix}
          </Text>
        </View>
        <Text style={[styles.price, { fontFamily: typo.mono }]}>
          ${car.price.toLocaleString('en-US')}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: V2.surface,
    borderRadius: V2.radius.small,
    borderWidth: 1, borderColor: V2.border,
    overflow: 'hidden',
  },
  photoWrap: { width: 124, aspectRatio: 1, backgroundColor: '#1a1e28' },
  photo: { width: '100%', height: '100%' },
  info:  { flex: 1, padding: 11, paddingRight: 13, paddingBottom: 12, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  title:    { fontSize: 14, fontWeight: '800', color: V2.text, letterSpacing: -0.28, lineHeight: 16 },
  specs:    { fontSize: 11, color: V2.textMuted, marginTop: 2, fontWeight: '600' },
  heartButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  mileageRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 6 },
  mileage: { fontSize: 10.5, color: V2.textMuted, fontWeight: '600' },
  price:   { fontSize: 17, fontWeight: '800', color: V2.text, letterSpacing: -0.34, marginTop: 10 },
});
```

- [ ] **Step 2: Write test**

```tsx
// src/components/home/v2/__tests__/SmallFeedCard.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { SmallFeedCard, SmallFeedCardCar } from '../SmallFeedCard';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const CAR: SmallFeedCardCar = { id: 'a', make: 'BMW', model: 'X3', year: 2021, mileage: 38000, bodyType: 'Кроссовер', price: 42000, image: 'https://x' };

describe('SmallFeedCard', () => {
  test('renders content and toggles fav', async () => {
    const onPress = jest.fn();
    const onToggleFav = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <SmallFeedCard car={CAR} kmSuffix="км" faved={false} onPress={onPress} onToggleFav={onToggleFav} />
        </UIVersionProvider>
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('BMW');
    expect(joined).toContain('X3');
    expect(joined).toContain('$42,000');
    expect(joined).toContain('38,000');

    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[0].props.onPress(); }); // row → onPress
    act(() => { tappables[1].props.onPress(); }); // heart → onToggleFav
    expect(onPress).toHaveBeenCalledWith(CAR);
    expect(onToggleFav).toHaveBeenCalledWith(CAR);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/SmallFeedCard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/SmallFeedCard.tsx src/components/home/v2/__tests__/SmallFeedCard.test.tsx
git commit -m "feat(home-v2): add SmallFeedCard"
```

---

### Task 1.8: `BigFeedCard`

**Files:**
- Create: `src/components/home/v2/BigFeedCard.tsx`
- Create: `src/components/home/v2/__tests__/BigFeedCard.test.tsx`

**Spec ref:** §5.7. **Handoff ref:** `carex-editorial.jsx` → `const BigFeedCard = ...`.

**Cuts from handoff:** gold halo, gold border, ember/flame icon, match-score chip, market-delta pill.

**Important:** Top-of-file comment explains the dormant state.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/BigFeedCard.tsx
/**
 * BigFeedCard — used in the v2 home feed when `listing.promoted === true`.
 *
 * Today, no backend listing has `promoted=true`, so this component renders
 * zero times in production. The component exists so that when the backend
 * grows a `promoted` flag in a future phase, promoted listings will
 * automatically render as Big cards in the feed (matching the spec's
 * size-as-promotion hierarchy: Big = paid, Small = organic).
 *
 * Visual ornaments that originally signaled "promoted" in the design
 * handoff — gold halo, gold border, ember icon, match-score chip — are
 * intentionally cut here. The size hierarchy alone (Big vs Small) is the
 * signal. See spec §5 cut list.
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Heart, ChevronRight } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface BigFeedCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  bodyType?: string;
  price: number;
  image: string;
}

export interface BigFeedCardProps {
  car: BigFeedCardCar;
  kmSuffix: string;
  ctaLabel: string;
  faved: boolean;
  onPress: (car: BigFeedCardCar) => void;
  onToggleFav: (car: BigFeedCardCar) => void;
}

export const BigFeedCard: React.FC<BigFeedCardProps> = ({
  car, kmSuffix, ctaLabel, faved, onPress, onToggleFav,
}) => {
  const typo = useTypography();
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(car)} style={styles.card}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(8,9,12,0)', 'rgba(8,9,12,0.92)']}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill as any}
        />
        <TouchableOpacity
          onPress={() => onToggleFav(car)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.heartButton}
        >
          <Heart size={16} color={faved ? V2.favorite : V2.text} fill={faved ? V2.favorite : 'transparent'} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.bottomBlock}>
          <Text style={[styles.makeModel, { fontFamily: typo.display }]}>{car.make} {car.model}</Text>
          <Text style={[styles.specs, { fontFamily: typo.mono }]}>
            {car.year} · {car.mileage.toLocaleString('en-US')} {kmSuffix}{car.bodyType ? ` · ${car.bodyType}` : ''}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { fontFamily: typo.mono }]}>
              ${car.price.toLocaleString('en-US')}
            </Text>
            <View style={styles.cta}>
              <Text style={[styles.ctaText, { fontFamily: typo.display }]}>{ctaLabel}</Text>
              <ChevronRight size={14} color="#08090C" strokeWidth={2.4} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: V2.radius.big,
    overflow: 'hidden',
    backgroundColor: V2.surfaceHi,
    borderWidth: 1, borderColor: V2.border,
  },
  photoWrap: { aspectRatio: 16 / 11, backgroundColor: '#1a1e28' },
  photo:     { width: '100%', height: '100%' },
  heartButton: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(8,9,12,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBlock: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  makeModel: { fontSize: 20, fontWeight: '800', color: V2.text, letterSpacing: -0.5, lineHeight: 21 },
  specs:     { fontSize: 12, color: V2.textMuted, marginTop: 3, fontWeight: '600' },
  priceRow:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  price:     { fontSize: 24, fontWeight: '800', color: V2.text, letterSpacing: -0.72 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: V2.text,
  },
  ctaText: { fontSize: 13, fontWeight: '800', color: '#08090C', letterSpacing: -0.13 },
});
```

- [ ] **Step 2: Write test**

```tsx
// src/components/home/v2/__tests__/BigFeedCard.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { BigFeedCard, BigFeedCardCar } from '../BigFeedCard';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const CAR: BigFeedCardCar = { id: 'a', make: 'Porsche', model: 'Macan', year: 2022, mileage: 14500, bodyType: 'Кроссовер', price: 58900, image: 'https://x' };

describe('BigFeedCard', () => {
  test('renders content and handlers fire', async () => {
    const onPress = jest.fn();
    const onToggleFav = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <BigFeedCard car={CAR} kmSuffix="км" ctaLabel="Открыть" faved={false} onPress={onPress} onToggleFav={onToggleFav} />
        </UIVersionProvider>
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Porsche');
    expect(joined).toContain('Macan');
    expect(joined).toContain('$58,900');
    expect(joined).toContain('14,500');
    expect(joined).toContain('Открыть');

    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[0].props.onPress(); });
    act(() => { tappables[1].props.onPress(); });
    expect(onPress).toHaveBeenCalledWith(CAR);
    expect(onToggleFav).toHaveBeenCalledWith(CAR);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/BigFeedCard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/BigFeedCard.tsx src/components/home/v2/__tests__/BigFeedCard.test.tsx
git commit -m "feat(home-v2): add BigFeedCard (dormant until backend promoted flag)"
```

---

### Task 1.9: `FeedLoader`

**Files:**
- Create: `src/components/home/v2/FeedLoader.tsx`

**Spec ref:** §5.9. Static-looking pulsing dots — using `react-native-reanimated` `withRepeat` for opacity.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/FeedLoader.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from 'react-native-reanimated';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

interface DotProps { delay: number; }
const Dot: React.FC<DotProps> = ({ delay }) => {
  const opacity = useSharedValue(0.35);
  const scale   = useSharedValue(1);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 600 }), -1, true));
    scale.value   = withDelay(delay, withRepeat(withTiming(1.3, { duration: 600 }), -1, true));
  }, [delay, opacity, scale]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
};

export interface FeedLoaderProps {
  caption: string;
}

export const FeedLoader: React.FC<FeedLoaderProps> = ({ caption }) => {
  const typo = useTypography();
  return (
    <View style={styles.wrapper}>
      <View style={styles.dotRow}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </View>
      <Text style={[styles.caption, { fontFamily: typo.display }]}>{caption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 18, alignItems: 'center', gap: 10 },
  dotRow:  { flexDirection: 'row', gap: 5 },
  dot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: V2.textFaint },
  caption: {
    fontSize: 10.5, fontWeight: '700', letterSpacing: 1.26,
    textTransform: 'uppercase', color: V2.textFaint,
  },
});
```

- [ ] **Step 2: Commit (no test — reanimated mock makes this trivial)**

```bash
git add src/components/home/v2/FeedLoader.tsx
git commit -m "feat(home-v2): add FeedLoader (pulsing dots)"
```

---

### Task 1.10: `EditorialDock`

**Files:**
- Create: `src/components/home/v2/EditorialDock.tsx`
- Create: `src/components/home/v2/__tests__/EditorialDock.test.tsx`

**Spec ref:** §5.10. Same 3-slot navigation as the existing `BottomBar`: Главная · [FAB→SellCar] · Ещё. Restyled per design.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/EditorialDock.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Home, Plus, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';
import { RootStackParamList } from '../../../types/navigation';

export interface EditorialDockProps {
  /** Localized labels. */
  homeLabel: string;
  sellLabel: string;
  moreLabel: string;
  onMorePress: () => void;
}

export const EditorialDock: React.FC<EditorialDockProps> = ({ homeLabel, sellLabel, moreLabel, onMorePress }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const typo = useTypography();
  const [active, setActive] = useState<'home' | 'more'>('home');

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(8,9,12,0)', 'rgba(8,9,12,1)']}
        locations={[0, 0.6]}
        style={styles.fade}
        pointerEvents="none"
      />
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => { setActive('home'); navigation.navigate('Home', { clearFilters: true }); }}
        >
          <Home size={20} color={active === 'home' ? V2.blue : V2.textMuted} strokeWidth={active === 'home' ? 2.2 : 1.7} />
          <Text style={[styles.navLabel, { fontFamily: typo.display, color: active === 'home' ? V2.blue : V2.textMuted, fontWeight: active === 'home' ? '700' : '600' }]}>{homeLabel}</Text>
        </TouchableOpacity>
        <View style={styles.fabSlot}>
          <TouchableOpacity onPress={() => navigation.navigate('SellCar')} style={styles.fab}>
            <LinearGradient
              colors={[V2.blue, V2.blueDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Plus size={26} color="#04101f" strokeWidth={2.6} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.fabLabel, { fontFamily: typo.display }]}>{sellLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => { setActive('more'); onMorePress(); }}
        >
          <Menu size={20} color={active === 'more' ? V2.blue : V2.textMuted} strokeWidth={active === 'more' ? 2.2 : 1.7} />
          <Text style={[styles.navLabel, { fontFamily: typo.display, color: active === 'more' ? V2.blue : V2.textMuted, fontWeight: active === 'more' ? '700' : '600' }]}>{moreLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 28,
  },
  fade: { position: 'absolute', top: -40, left: 0, right: 0, height: 40 },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    height: 64,
    backgroundColor: V2.surface,
    borderRadius: 28,
    borderWidth: 1, borderColor: V2.border,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 2,
  },
  navLabel: { fontSize: 10, letterSpacing: -0.1 },
  fabSlot:  { width: 80, alignItems: 'center', justifyContent: 'center' },
  fab:      { position: 'absolute', top: -16, alignItems: 'center', justifyContent: 'center' },
  fabGradient: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: V2.bg,
    shadowColor: V2.blue, shadowOpacity: 0.42, shadowRadius: 26, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  fabLabel: { fontSize: 10, color: V2.text, fontWeight: '700', marginTop: 38 },
});
```

- [ ] **Step 2: Write the test**

```tsx
// src/components/home/v2/__tests__/EditorialDock.test.tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { EditorialDock } from '../EditorialDock';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(),
}));

const navigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate }),
}));

describe('EditorialDock', () => {
  beforeEach(() => navigate.mockClear());

  test('Home tap navigates Home with clearFilters', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <EditorialDock homeLabel="Главная" sellLabel="Продать" moreLabel="Ещё" onMorePress={jest.fn()} />
        </UIVersionProvider>
      );
    });
    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[0].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('Home', { clearFilters: true });
  });

  test('FAB tap navigates SellCar', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <EditorialDock homeLabel="Главная" sellLabel="Продать" moreLabel="Ещё" onMorePress={jest.fn()} />
        </UIVersionProvider>
      );
    });
    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[1].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('SellCar');
  });

  test('More tap invokes onMorePress', async () => {
    const onMorePress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <EditorialDock homeLabel="Главная" sellLabel="Продать" moreLabel="Ещё" onMorePress={onMorePress} />
        </UIVersionProvider>
      );
    });
    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[2].props.onPress(); });
    expect(onMorePress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest src/components/home/v2/__tests__/EditorialDock.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/v2/EditorialDock.tsx src/components/home/v2/__tests__/EditorialDock.test.tsx
git commit -m "feat(home-v2): add EditorialDock (3-slot restyle)"
```

---

### Task 1.11: `ActiveFilterChips`

**Files:**
- Create: `src/components/home/v2/ActiveFilterChips.tsx`

**Spec ref:** §5.12. Reads filter state from props; emits per-chip clear callbacks and a "clear all" call.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/ActiveFilterChips.tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';
import type { ActiveFilters, SelectedRef } from '../../../hooks/useHomeListings';

export interface ActiveFilterChipsProps {
  selectedMake:     SelectedRef;
  selectedModel:    SelectedRef;
  selectedCategory: number | null;
  activeFilters:    ActiveFilters;
  categoryName:     (id: number) => string;
  clearAllLabel:    string;
  onClearMake:      () => void;
  onClearModel:     () => void;
  onClearCategory:  () => void;
  onClearFilter:    (key: string) => void;
  onClearAll:       () => void;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  selectedMake, selectedModel, selectedCategory, activeFilters, categoryName,
  clearAllLabel, onClearMake, onClearModel, onClearCategory, onClearFilter, onClearAll,
}) => {
  const typo = useTypography();
  const filterKeys = Object.keys(activeFilters).filter((k) => !k.startsWith('sort'));
  const hasAny = !!selectedMake || !!selectedModel || selectedCategory != null || filterKeys.length > 0;
  if (!hasAny) return null;

  const renderChip = (label: string, onClear: () => void, key: string) => (
    <TouchableOpacity key={key} style={styles.chip} onPress={onClear} activeOpacity={0.85}>
      <Text style={[styles.chipText, { fontFamily: typo.display }]} numberOfLines={1}>{label}</Text>
      <X size={12} color={V2.text} strokeWidth={2.4} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {selectedMake     && renderChip(selectedMake.name, onClearMake, 'make')}
      {selectedModel    && renderChip(selectedModel.name, onClearModel, 'model')}
      {selectedCategory && renderChip(categoryName(selectedCategory), onClearCategory, 'cat')}
      {filterKeys.map((k) => renderChip(k, () => onClearFilter(k), `f-${k}`))}
      <TouchableOpacity style={styles.clearAll} onPress={onClearAll} activeOpacity={0.85}>
        <Text style={[styles.clearAllText, { fontFamily: typo.display }]}>{clearAllLabel}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 18, paddingVertical: 8, gap: 7, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: V2.radius.pill,
    backgroundColor: 'rgba(77,163,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(77,163,255,0.35)',
  },
  chipText:  { fontSize: 12, fontWeight: '700', color: V2.blue, maxWidth: 140 },
  clearAll:  { paddingHorizontal: 11, paddingVertical: 7 },
  clearAllText: { fontSize: 12, fontWeight: '700', color: V2.textMuted },
});
```

- [ ] **Step 2: Commit (visual-only component; covered by HomeScreenV2 integration)**

```bash
git add src/components/home/v2/ActiveFilterChips.tsx
git commit -m "feat(home-v2): add ActiveFilterChips"
```

---

### Task 1.12: `V2InviteBanner`

**Files:**
- Create: `src/components/home/v2/V2InviteBanner.tsx`

**Spec ref:** §5.11. Renders only on v1 Home when `inviteDismissed` is false. Read both flags directly from `useUIVersion`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/V2InviteBanner.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { V2 } from './theme';
import { useUIVersion } from '../../../context/UIVersionContext';
import { useTypography } from '../../../hooks/useTypography';

export interface V2InviteBannerProps {
  headline:   string;
  tryLabel:   string;
  notNowLabel: string;
}

export const V2InviteBanner: React.FC<V2InviteBannerProps> = ({ headline, tryLabel, notNowLabel }) => {
  const { version, setVersion, inviteDismissed, dismissInvite } = useUIVersion();
  const typo = useTypography();
  const [visible, setVisible] = useState(version === 'v1' && !inviteDismissed);

  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(1);

  useEffect(() => {
    setVisible(version === 'v1' && !inviteDismissed);
  }, [version, inviteDismissed]);

  const slideAndHide = () => {
    translateY.value = withTiming(-40, { duration: 200 });
    opacity.value    = withTiming(0,   { duration: 200 }, (done) => {
      if (done) runOnJS(setVisible)(false);
    });
  };

  const onTry = () => {
    setVersion('v2');
    dismissInvite();
    slideAndHide();
  };
  const onNotNow = () => {
    dismissInvite();
    slideAndHide();
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        <Sparkles size={18} color={V2.blue} strokeWidth={2.2} />
        <Text style={[styles.headline, { fontFamily: typo.display }]} numberOfLines={2}>
          {headline}
        </Text>
        <TouchableOpacity onPress={onTry}><Text style={[styles.try, { fontFamily: typo.display }]}>{tryLabel}</Text></TouchableOpacity>
        <TouchableOpacity onPress={onNotNow}><Text style={[styles.notNow, { fontFamily: typo.display }]}>{notNowLabel}</Text></TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16, marginTop: 8, padding: 12,
    borderRadius: 14,
    backgroundColor: V2.surface,
    borderWidth: 1, borderColor: 'rgba(77,163,255,0.32)',
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { flex: 1, fontSize: 13, fontWeight: '700', color: V2.text },
  try:      { fontSize: 13, fontWeight: '800', color: V2.blue, marginLeft: 4 },
  notNow:   { fontSize: 13, fontWeight: '600', color: V2.textMuted, marginLeft: 8 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/v2/V2InviteBanner.tsx
git commit -m "feat(home-v2): add V2InviteBanner"
```

---

### Task 1.13: `MarketStatsStrip`

**Files:**
- Create: `src/components/home/v2/MarketStatsStrip.tsx`

**Spec ref:** §5.13. Pure presentation; takes pre-computed stats.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/MarketStatsStrip.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface MarketStatsStripProps {
  /** Localized labels for each cell. */
  avgLabel:     string;
  yearLabel:    string;
  mileageLabel: string;
  /** Pre-formatted values; pass "—" when no data. */
  avgValue:     string;
  yearValue:    string;
  mileageValue: string;
}

export const MarketStatsStrip: React.FC<MarketStatsStripProps> = ({
  avgLabel, yearLabel, mileageLabel, avgValue, yearValue, mileageValue,
}) => {
  const typo = useTypography();
  return (
    <View style={styles.strip}>
      <Cell label={avgLabel}     value={avgValue}     typo={typo} />
      <Divider />
      <Cell label={yearLabel}    value={yearValue}    typo={typo} />
      <Divider />
      <Cell label={mileageLabel} value={mileageValue} typo={typo} />
    </View>
  );
};

const Cell: React.FC<{ label: string; value: string; typo: ReturnType<typeof useTypography> }> = ({ label, value, typo }) => (
  <View style={styles.cell}>
    <Text style={[styles.cellLabel, { fontFamily: typo.display }]}>{label}</Text>
    <Text style={[styles.cellValue, { fontFamily: typo.mono }]}>{value}</Text>
  </View>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row', alignItems: 'stretch',
    marginHorizontal: 16, marginTop: 10,
    borderWidth: 1, borderColor: V2.border, borderRadius: 12,
    overflow: 'hidden',
  },
  cell:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  cellLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: V2.textFaint, marginBottom: 2 },
  cellValue: { fontSize: 13, fontWeight: '800', color: V2.text },
  divider:   { width: 1, backgroundColor: V2.border },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/v2/MarketStatsStrip.tsx
git commit -m "feat(search-v2): add MarketStatsStrip"
```

---

### Task 1.14: `FilterChipRow` (SearchResultsV2)

**Files:**
- Create: `src/components/home/v2/FilterChipRow.tsx`

**Spec ref:** §5.14. Horizontal scroll. Leading "Фильтры" chip opens the modal; following chips reflect/clear active filters.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/FilterChipRow.tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SlidersHorizontal, Check } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface FilterChip {
  key: string;
  label: string;
  active: boolean;
}

export interface FilterChipRowProps {
  filtersLabel: string;
  chips: FilterChip[];
  onFiltersPress: () => void;
  onChipPress: (key: string) => void;
}

export const FilterChipRow: React.FC<FilterChipRowProps> = ({ filtersLabel, chips, onFiltersPress, onChipPress }) => {
  const typo = useTypography();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <TouchableOpacity style={[styles.chip, styles.leading]} onPress={onFiltersPress}>
        <SlidersHorizontal size={14} color={V2.text} strokeWidth={2.2} />
        <Text style={[styles.chipText, { fontFamily: typo.display }]}>{filtersLabel}</Text>
      </TouchableOpacity>
      {chips.map((c) => (
        <TouchableOpacity
          key={c.key}
          style={[styles.chip, c.active && styles.chipActive]}
          onPress={() => onChipPress(c.key)}
        >
          {c.active && <Check size={12} color={V2.blue} strokeWidth={2.4} />}
          <Text
            style={[
              styles.chipText,
              { fontFamily: typo.display, color: c.active ? V2.blue : V2.text },
            ]}
            numberOfLines={1}
          >
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row:   { paddingHorizontal: 16, paddingVertical: 10, gap: 7 },
  chip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, height: 32,
    borderRadius: V2.radius.pill,
    backgroundColor: V2.surface,
    borderWidth: 1, borderColor: V2.border,
  },
  leading: { gap: 6 },
  chipActive: { backgroundColor: 'rgba(77,163,255,0.14)', borderColor: 'rgba(77,163,255,0.35)' },
  chipText: { fontSize: 13, fontWeight: '700', color: V2.text },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/v2/FilterChipRow.tsx
git commit -m "feat(search-v2): add FilterChipRow"
```

---

### Task 1.15: `SortSheet`

**Files:**
- Create: `src/components/home/v2/SortSheet.tsx`

**Spec ref:** §5.15. Modal sheet, single-select.

- [ ] **Step 1: Write the component**

```tsx
// src/components/home/v2/SortSheet.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export type SortOption = 'relevance' | 'priceAsc' | 'priceDesc' | 'newest' | 'mileageAsc';

export interface SortSheetProps {
  visible: boolean;
  current: SortOption;
  labels: Record<SortOption, string>;
  onSelect: (opt: SortOption) => void;
  onClose: () => void;
}

const ORDER: SortOption[] = ['relevance', 'priceAsc', 'priceDesc', 'newest', 'mileageAsc'];

export const SortSheet: React.FC<SortSheetProps> = ({ visible, current, labels, onSelect, onClose }) => {
  const typo = useTypography();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {ORDER.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.row}
              onPress={() => { onSelect(opt); onClose(); }}
              activeOpacity={0.85}
            >
              <Text style={[
                styles.label,
                { fontFamily: typo.display, color: current === opt ? V2.blue : V2.text },
              ]}>
                {labels[opt]}
              </Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:    {
    backgroundColor: V2.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: 12, paddingHorizontal: 18, paddingBottom: 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: V2.border,
  },
  row:      { paddingVertical: 14 },
  label:    { fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/v2/SortSheet.tsx
git commit -m "feat(search-v2): add SortSheet"
```

---

## Phase 2 — Translations

### Task 2.1: Add v2 translation keys

**Files:**
- Modify: `src/constants/translations.ts`

**Spec ref:** §10.

- [ ] **Step 1: Add the keys**

Open `src/constants/translations.ts`. Identify the RU object and the EN object. Add each of the keys from the table below to **both** objects.

```ts
// Inside RU object:
goodMorning: 'Доброе утро',
goodAfternoon: 'Добрый день',
goodEvening: 'Добрый вечер',
findYourCar: 'Найдём ваше идеальное авто.',
freshOffer: 'СВЕЖЕЕ ПРЕДЛОЖЕНИЕ',
today: 'Сегодня',
freshOffers: 'Свежие предложения',
justAdded: 'ТОЛЬКО ЧТО ДОБАВЛЕНО',
forYou: 'ЕЩЁ ДЛЯ ВАС',
moreOffers: 'Больше предложений',
basedOnActivity: 'На основе вашей активности',
pickingMore: 'ПОДБИРАЕМ ЕЩЁ…',
view: 'Смотреть',
open: 'Открыть',
searchPlaceholder: 'Что вы ищете?',
listingsCount: 'объявлений',
appearanceTitle: 'Внешний вид',
appearanceClassic: 'Классический',
appearanceClassicDesc: 'Привычный вид CarEx',
appearanceNew: 'Новый (бета)',
appearanceNewDesc: 'Обновлённый дизайн главной и поиска',
newDesignAvailable: 'Новый дизайн доступен',
tryNow: 'Попробовать',
notNow: 'Не сейчас',
marketAvg: 'Ср. рынок',
yearLabel: 'Год',
mileageLabel: 'Пробег',
allResults: 'ВСЕ РЕЗУЛЬТАТЫ',
byRelevance: 'По релевантности',
priceAsc: 'Цена ↑',
priceDesc: 'Цена ↓',
newestFirst: 'Сначала новые',
mileageAscSort: 'Пробег ↑',
showMore: 'Показать ещё',
allCars: 'Все авто',
moscowAndRegion: 'Москва и регион',
clearAll: 'Очистить всё',
filters: 'Фильтры',
moscow: 'Москва',
kmShort: 'км',
```

```ts
// Inside EN object:
goodMorning: 'Good morning',
goodAfternoon: 'Good afternoon',
goodEvening: 'Good evening',
findYourCar: 'Find your perfect car.',
freshOffer: 'FRESH LISTING',
today: 'Today',
freshOffers: 'Fresh listings',
justAdded: 'JUST ADDED',
forYou: 'MORE FOR YOU',
moreOffers: 'More listings',
basedOnActivity: 'Based on your activity',
pickingMore: 'FINDING MORE…',
view: 'View',
open: 'Open',
searchPlaceholder: 'What are you looking for?',
listingsCount: 'listings',
appearanceTitle: 'Appearance',
appearanceClassic: 'Classic',
appearanceClassicDesc: 'The familiar CarEx look',
appearanceNew: 'New (beta)',
appearanceNewDesc: 'Refreshed Home and Search design',
newDesignAvailable: 'New design available',
tryNow: 'Try it',
notNow: 'Not now',
marketAvg: 'Avg market',
yearLabel: 'Year',
mileageLabel: 'Mileage',
allResults: 'ALL RESULTS',
byRelevance: 'By relevance',
priceAsc: 'Price ↑',
priceDesc: 'Price ↓',
newestFirst: 'Newest first',
mileageAscSort: 'Mileage ↑',
showMore: 'Show more',
allCars: 'All cars',
moscowAndRegion: 'Moscow and region',
clearAll: 'Clear all',
filters: 'Filters',
moscow: 'Moscow',
kmShort: 'km',
```

If the project has a `translation-parity.test.ts` (it does — `__tests__/translation-parity.test.ts`), it will fail if RU/EN don't have matching keys. That test serves as the verification step.

- [ ] **Step 2: Run parity test**

Run: `npx jest __tests__/translation-parity.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/constants/translations.ts
git commit -m "i18n(home-v2): add RU+EN keys for v2 home and search"
```

---

## Phase 3 — Compose v2 screens

### Task 3.1: `HomeScreenV2`

**Files:**
- Create: `src/screens/HomeScreenV2.tsx`

**Spec ref:** §6.1.

- [ ] **Step 1: Write the screen**

```tsx
// src/screens/HomeScreenV2.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, StyleSheet, StatusBar, Text, Platform, BackHandler, ToastAndroid, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useIsFocused, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHomeListings } from '../hooks/useHomeListings';
import { useLanguage } from '../context/LanguageContext';
import { useTypography } from '../hooks/useTypography';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES } from '../constants/mockData';
import { V2 } from '../components/home/v2/theme';

import { FloatingSearchPill } from '../components/home/v2/FloatingSearchPill';
import { GreetingBlock } from '../components/home/v2/GreetingBlock';
import { ActiveFilterChips } from '../components/home/v2/ActiveFilterChips';
import { HeroRotator } from '../components/home/v2/HeroRotator';
import { SmartShelf } from '../components/home/v2/SmartShelf';
import { BigFeedCard } from '../components/home/v2/BigFeedCard';
import { SmallFeedCard } from '../components/home/v2/SmallFeedCard';
import { FeedLoader } from '../components/home/v2/FeedLoader';
import { EditorialDock } from '../components/home/v2/EditorialDock';
import { FilterModal } from '../components/FilterModal';

import { RootStackParamList } from '../types/navigation';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type RouteT = RouteProp<RootStackParamList, 'Home'>;

function timeOfDayKey(t: any): string {
  const h = new Date().getHours();
  if (h < 12) return t.goodMorning;
  if (h < 18) return t.goodAfternoon;
  return t.goodEvening;
}

export const HomeScreenV2 = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const isFocused  = useIsFocused();
  const { t }      = useLanguage();
  const { user }   = useAuth();
  const typo       = useTypography();

  const {
    cars, loading, refreshing, refresh,
    selectedMake, setSelectedMake,
    selectedModel, setSelectedModel,
    selectedCategory, setSelectedCategory,
    activeFilters,
    displayedCars,
    applyFilter,
    clearAll,
  } = useHomeListings();

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.clearFilters) {
      clearAll();
      navigation.setParams({ clearFilters: false });
    }
  }, [route.params?.clearFilters, clearAll, navigation]);

  // Android filter unwind back-handler (same logic as v1 HomeScreen)
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      const hasOtherFilters = selectedCategory != null || Object.keys(activeFilters).filter((k) => !k.startsWith('sort')).length > 0;
      if (selectedMake && selectedModel) { setSelectedModel(null); return true; }
      if (selectedMake || hasOtherFilters) { clearAll(); return true; }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) { BackHandler.exitApp(); return true; }
      lastBackPressRef.current = now;
      ToastAndroid.show(t.pressBackAgainToExit, ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, t.pressBackAgainToExit, selectedMake, selectedModel, selectedCategory, activeFilters, setSelectedModel, clearAll]);

  // Slice displayedCars into hero / shelf / feed bands
  const heroCars  = displayedCars.slice(0, 5);
  const shelfCars = displayedCars.slice(5, 13);
  // car.promoted always false today — BigFeedCard never renders.
  const feedCars  = displayedCars.slice(13);

  const handleCarPress  = (car: any) => navigation.navigate('CarDetails', { carId: car.id, carData: car });
  const handleSearchPress = () => navigation.navigate('SearchResults', { initialQuery: '' });
  const handleFiltersPress = () => { setCurrentFilterType('Год'); setFilterModalVisible(true); };
  const handleMorePress = () => {
    if (user) navigation.navigate('Profile');
    else navigation.navigate('Login');
  };

  const Header = (
    <>
      <FloatingSearchPill
        placeholder={t.searchPlaceholder}
        onPress={handleSearchPress}
        onFiltersPress={handleFiltersPress}
      />
      <GreetingBlock
        timeOfDay={timeOfDayKey(t)}
        city={t.moscow}
        headline={t.findYourCar}
        listingsCount={displayedCars.length}
        listingsNoun={t.listingsCount}
      />
      <ActiveFilterChips
        selectedMake={selectedMake}
        selectedModel={selectedModel}
        selectedCategory={selectedCategory}
        activeFilters={activeFilters}
        categoryName={(id) => CATEGORIES.find((c) => c.id === id)?.name ?? ''}
        clearAllLabel={t.clearAll}
        onClearMake={() => { setSelectedMake(null); setSelectedModel(null); }}
        onClearModel={() => setSelectedModel(null)}
        onClearCategory={() => setSelectedCategory(null)}
        onClearFilter={(key) => applyFilter(key, null)}
        onClearAll={clearAll}
      />
      <HeroRotator
        cars={heroCars}
        kicker={t.freshOffer}
        todayLabel={t.today}
        ctaLabel={t.view}
        kmSuffix={t.kmShort}
        onCardPress={handleCarPress}
      />
      <SmartShelf
        kicker={t.justAdded}
        title={t.freshOffers}
        cars={shelfCars}
        kmSuffix={t.kmShort}
        onCardPress={handleCarPress}
      />
      <View style={styles.feedHeader}>
        <Text style={[styles.feedKicker, { fontFamily: typo.display }]}>{t.forYou}</Text>
        <Text style={[styles.feedTitle, { fontFamily: typo.display }]}>{t.moreOffers}</Text>
        <Text style={[styles.feedSubtitle, { fontFamily: typo.mono }]}>{t.basedOnActivity}</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={V2.bg} />
      <FlatList
        style={styles.list}
        data={feedCars}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          item.promoted
            ? <BigFeedCard car={item} kmSuffix={t.kmShort} ctaLabel={t.open} faved={!!item.faved} onPress={handleCarPress} onToggleFav={() => {}} />
            : <SmallFeedCard car={item} kmSuffix={t.kmShort} faved={!!item.faved} onPress={handleCarPress} onToggleFav={() => {}} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
        ListFooterComponent={refreshing ? <FeedLoader caption={t.pickingMore} /> : null}
        ListEmptyComponent={!loading ? <Text style={[styles.empty, { fontFamily: typo.display }]}>{t.noCars}</Text> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={V2.blue} />}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={8}
      />
      <EditorialDock
        homeLabel={t.home}
        sellLabel={t.sellCar}
        moreLabel={t.more}
        onMorePress={handleMorePress}
      />
      <FilterModal
        visible={filterModalVisible}
        type={currentFilterType}
        onClose={() => setFilterModalVisible(false)}
        onApply={applyFilter}
        currentValue={currentFilterType ? activeFilters[currentFilterType] : null}
        t={t}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: V2.bg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 120 },
  feedHeader: { paddingTop: 26, paddingBottom: 12 },
  feedKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: V2.blue, marginBottom: 5 },
  feedTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.616, color: V2.text },
  feedSubtitle: { fontSize: 11.5, color: V2.textMuted, marginTop: 4, fontWeight: '600' },
  empty: { color: V2.textMuted, textAlign: 'center', marginTop: 24, fontSize: 16 },
});
```

Note: `FlatList` doesn't natively share horizontal padding with `ListHeaderComponent` sub-views. The components above set their own horizontal padding internally. Verify in UAT that horizontal alignment is consistent (search pill, greeting, shelf header all align to 18px).

- [ ] **Step 2: Manually verify it doesn't crash on import**

Add a temporary import to a file already running (e.g., a console.log in App.tsx that just references the module):
```tsx
import { HomeScreenV2 } from './src/screens/HomeScreenV2';
console.log('HomeScreenV2 module loaded:', typeof HomeScreenV2);
```
Run the app and check the JS console. Then remove the temporary lines.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreenV2.tsx
git commit -m "feat(home-v2): compose HomeScreenV2"
```

---

### Task 3.2: `HomeScreenRouter`

**Files:**
- Create: `src/screens/HomeScreenRouter.tsx`

- [ ] **Step 1: Write the router**

```tsx
// src/screens/HomeScreenRouter.tsx
import React from 'react';
import { useUIVersion } from '../context/UIVersionContext';
import { HomeScreen } from './HomeScreen';
import { HomeScreenV2 } from './HomeScreenV2';

export const HomeScreenRouter = () => {
  const { version } = useUIVersion();
  return version === 'v2' ? <HomeScreenV2 /> : <HomeScreen />;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeScreenRouter.tsx
git commit -m "feat(home-v2): add HomeScreenRouter"
```

---

### Task 3.3: Wire `HomeScreenRouter` into `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Replace `HomeScreen` reference in the navigator with `HomeScreenRouter`**

Find this in `App.tsx`:
```tsx
import { HomeScreen } from './src/screens/HomeScreen';
// ...
<Stack.Screen name="Home" component={HomeScreen} options={...} />
```

Change to:
```tsx
import { HomeScreenRouter } from './src/screens/HomeScreenRouter';
// ...
<Stack.Screen name="Home" component={HomeScreenRouter} options={...} />
```

Leave the `HomeScreen` direct import untouched if it's used elsewhere (it shouldn't be — it's only the route component). Remove the now-unused import line.

- [ ] **Step 2: Test toggle by hard-coding `'v2'`**

Temporarily edit `src/context/UIVersionContext.tsx`:
```tsx
const [version, setVersionState] = useState<UIVersion>('v2'); // TEMP
```

Run the app. Home should render v2. Tap around — search pill should push (it will crash here because SearchResults route doesn't exist yet, that's expected).

Revert to `'v1'`.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(home-v2): route Home through HomeScreenRouter"
```

---

### Task 3.4: Add `SearchResults` route to `RootStackParamList`

**Files:**
- Modify: `src/types/navigation.ts`

- [ ] **Step 1: Add the route**

Open `src/types/navigation.ts`. Add to the `RootStackParamList` type:
```ts
SearchResults: { initialQuery: string; initialFilters?: { [key: string]: any } };
```

- [ ] **Step 2: Commit**

```bash
git add src/types/navigation.ts
git commit -m "feat(search-v2): add SearchResults route to navigation type"
```

---

### Task 3.5: `SearchResultsV2`

**Files:**
- Create: `src/screens/SearchResultsV2.tsx`

**Spec ref:** §6.2.

- [ ] **Step 1: Write the screen**

```tsx
// src/screens/SearchResultsV2.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, StatusBar, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';

import { useHomeListings } from '../hooks/useHomeListings';
import { useLanguage } from '../context/LanguageContext';
import { useTypography } from '../hooks/useTypography';
import { V2 } from '../components/home/v2/theme';
import { MarketStatsStrip } from '../components/home/v2/MarketStatsStrip';
import { FilterChipRow, FilterChip } from '../components/home/v2/FilterChipRow';
import { BigFeedCard } from '../components/home/v2/BigFeedCard';
import { SmallFeedCard } from '../components/home/v2/SmallFeedCard';
import { SortSheet, SortOption } from '../components/home/v2/SortSheet';
import { FilterModal } from '../components/FilterModal';
import { RootStackParamList } from '../types/navigation';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'SearchResults'>;
type RouteT = RouteProp<RootStackParamList, 'SearchResults'>;

function formatStats(cars: any[]): { avg: string; year: string; mileage: string } {
  if (cars.length === 0) return { avg: '—', year: '—', mileage: '—' };
  const avgPrice = cars.reduce((s, c) => s + (c.price ?? 0), 0) / cars.length;
  const years    = cars.map((c) => c.year).filter((y) => Number.isFinite(y));
  const miles    = cars.map((c) => c.mileage).filter((m) => Number.isFinite(m));
  const fmtK = (n: number) => `${(n / 1000).toFixed(1)}k`;
  const yMin = Math.min(...years) || 0;
  const yMax = Math.max(...years) || 0;
  const mMin = miles.length ? Math.min(...miles) : 0;
  const mMax = miles.length ? Math.max(...miles) : 0;
  return {
    avg:     `$${fmtK(avgPrice)}`,
    year:    `'${String(yMin).slice(-2)}—'${String(yMax).slice(-2)}`,
    mileage: `${Math.round(mMin / 1000)}—${Math.round(mMax / 1000)}k`,
  };
}

export const SearchResultsV2 = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const { t }      = useLanguage();
  const typo       = useTypography();

  const {
    displayedCars,
    activeFilters,
    applyFilter,
    toggleQuickSort,
  } = useHomeListings({ initialFilters: route.params.initialFilters });

  const [revealed, setRevealed] = useState(25);
  const [sort,     setSort]     = useState<SortOption>('relevance');
  const [sortVisible, setSortVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);

  const stats = useMemo(() => formatStats(displayedCars), [displayedCars]);
  const visibleResults = displayedCars.slice(0, revealed);
  const total = displayedCars.length;

  const onSortSelect = (opt: SortOption) => {
    setSort(opt);
    // Map SortOption to hook state
    if (opt === 'priceAsc'   || opt === 'priceDesc')   {
      const want = opt === 'priceAsc' ? 'asc' : 'desc';
      // toggleQuickSort cycles asc→desc→null→asc; force-set instead:
      applyFilter('sortPrice', want);
      applyFilter('sortMileage', null);
      applyFilter('sortYear', null);
    } else if (opt === 'mileageAsc') {
      applyFilter('sortPrice', null);
      applyFilter('sortMileage', 'asc');
      applyFilter('sortYear', null);
    } else if (opt === 'newest') {
      applyFilter('sortPrice', null);
      applyFilter('sortMileage', null);
      applyFilter('sortYear', 'desc');
    } else {
      applyFilter('sortPrice', null);
      applyFilter('sortMileage', null);
      applyFilter('sortYear', null);
    }
  };

  const onChipPress = (key: string) => applyFilter(key, null);

  const chips: FilterChip[] = Object.keys(activeFilters)
    .filter((k) => !k.startsWith('sort'))
    .map((k) => ({ key: k, label: k, active: true }));

  const handleCarPress = (car: any) => navigation.navigate('CarDetails', { carId: car.id, carData: car });

  const Header = (
    <>
      <View style={styles.stickyHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <ChevronLeft size={20} color={V2.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={1}>
            {route.params.initialQuery || t.allCars}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: typo.mono }]}>
            {total} {t.listingsCount} · {t.moscowAndRegion}
          </Text>
        </View>
      </View>
      <MarketStatsStrip
        avgLabel={t.marketAvg}
        yearLabel={t.yearLabel}
        mileageLabel={t.mileageLabel}
        avgValue={stats.avg}
        yearValue={stats.year}
        mileageValue={stats.mileage}
      />
      <FilterChipRow
        filtersLabel={t.filters}
        chips={chips}
        onFiltersPress={() => { setCurrentFilterType('Год'); setFilterModalVisible(true); }}
        onChipPress={onChipPress}
      />
      <View style={styles.sortRow}>
        <Text style={[styles.sortRowLabel, { fontFamily: typo.display }]}>{t.allResults}</Text>
        <TouchableOpacity onPress={() => setSortVisible(true)} style={styles.sortDropdown}>
          <Text style={[styles.sortDropdownText, { fontFamily: typo.display }]}>
            {({
              relevance: t.byRelevance,
              priceAsc: t.priceAsc, priceDesc: t.priceDesc,
              newest: t.newestFirst, mileageAsc: t.mileageAscSort,
            } as Record<SortOption, string>)[sort]}
          </Text>
          <ChevronDown size={14} color={V2.text} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={V2.bg} />
      <FlatList
        data={visibleResults}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          item.promoted
            ? <BigFeedCard car={item} kmSuffix={t.kmShort} ctaLabel={t.open} faved={!!item.faved} onPress={handleCarPress} onToggleFav={() => {}} />
            : <SmallFeedCard car={item} kmSuffix={t.kmShort} faved={!!item.faved} onPress={handleCarPress} onToggleFav={() => {}} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          revealed < total
            ? (
                <TouchableOpacity onPress={() => setRevealed((r) => r + 25)} style={styles.loadMore}>
                  <Text style={[styles.loadMoreText, { fontFamily: typo.display }]}>
                    {t.showMore} {Math.min(25, total - revealed)} {t.listingsCount}
                  </Text>
                </TouchableOpacity>
              )
            : null
        }
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={8}
      />
      <SortSheet
        visible={sortVisible}
        current={sort}
        labels={{
          relevance: t.byRelevance,
          priceAsc:  t.priceAsc,
          priceDesc: t.priceDesc,
          newest:    t.newestFirst,
          mileageAsc: t.mileageAscSort,
        }}
        onSelect={onSortSelect}
        onClose={() => setSortVisible(false)}
      />
      <FilterModal
        visible={filterModalVisible}
        type={currentFilterType}
        onClose={() => setFilterModalVisible(false)}
        onApply={applyFilter}
        currentValue={currentFilterType ? activeFilters[currentFilterType] : null}
        t={t}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: V2.bg },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  stickyHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: V2.border,
    marginHorizontal: -16,
  },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: V2.surface },
  title:    { fontSize: 19, fontWeight: '800', color: V2.text },
  subtitle: { fontSize: 11.5, color: V2.textMuted, fontWeight: '600', marginTop: 2 },
  sortRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  sortRowLabel:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: V2.textMuted },
  sortDropdown:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortDropdownText:{ fontSize: 13, fontWeight: '700', color: V2.text },
  loadMore: { marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: V2.borderHi, alignItems: 'center' },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: V2.text },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/SearchResultsV2.tsx
git commit -m "feat(search-v2): compose SearchResultsV2"
```

---

### Task 3.6: `SearchResultsRouter`

**Files:**
- Create: `src/screens/SearchResultsRouter.tsx`

In v1, the route is reachable only as a no-op redirect to Home — v1 has no separate search screen.

- [ ] **Step 1: Write the router**

```tsx
// src/screens/SearchResultsRouter.tsx
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUIVersion } from '../context/UIVersionContext';
import { SearchResultsV2 } from './SearchResultsV2';
import { RootStackParamList } from '../types/navigation';

export const SearchResultsRouter = () => {
  const { version } = useUIVersion();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // v1 doesn't have a search-results screen — redirect to Home.
  useEffect(() => {
    if (version === 'v1') {
      navigation.replace('Home', { clearFilters: false });
    }
  }, [version, navigation]);

  if (version === 'v1') return null;
  return <SearchResultsV2 />;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/SearchResultsRouter.tsx
git commit -m "feat(search-v2): add SearchResultsRouter"
```

---

### Task 3.7: Add `SearchResults` route to `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add the route to the stack**

Add the import:
```tsx
import { SearchResultsRouter } from './src/screens/SearchResultsRouter';
```

Add to the `Stack.Navigator`:
```tsx
<Stack.Screen
  name="SearchResults"
  component={SearchResultsRouter}
  options={{ headerShown: false }}
/>
```

- [ ] **Step 2: Manual UAT — full v2 round trip**

Temporarily edit `UIVersionContext.tsx` to default `'v2'`. Run the app. Verify:
- Home renders v2.
- Tap the search pill → SearchResults pushes.
- Tap a result → CarDetails pushes.
- Back swipe → returns to SearchResults, then Home.

Revert `UIVersionContext.tsx` to default `'v1'`.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(search-v2): mount SearchResults route in stack"
```

---

## Phase 4 — Cross-screen integration

### Task 4.1: Wire `useTypography` into `CarDetailsScreen`

**Files:**
- Modify: `src/screens/CarDetailsScreen.tsx`

The CarDetails screen has many text styles. Apply the typography helper to every `Text` style — `fontFamily: typo.display` for prose, `fontFamily: typo.mono` for numeric specs (price, mileage, year). Where v1 renders system font, v2 will render Manrope/JetBrains Mono.

- [ ] **Step 1: Add the hook and weave it through styles**

At the top of the component:
```tsx
import { useTypography } from '../hooks/useTypography';
// ...
const typo = useTypography();
```

For every existing `<Text style={styles.something}>...`, wrap the style with the helper's font family. Example:

Before:
```tsx
<Text style={styles.price}>${car.price}</Text>
```

After:
```tsx
<Text style={[styles.price, { fontFamily: typo.mono }]}>${car.price}</Text>
```

For headings and labels use `typo.display`; for numeric / spec text (price, mileage, year, VIN, displacement) use `typo.mono`.

Apply consistently — every `Text` component in the file should have one or the other.

- [ ] **Step 2: Manual UAT**

Toggle to v2 via temp hardcode. Open CarDetails on any listing. Verify the font visibly changes (Manrope reads tighter and slightly geometric vs system). Toggle back to v1, verify CarDetails returns to system font.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All pass — no logic changes.

- [ ] **Step 4: Commit**

```bash
git add src/screens/CarDetailsScreen.tsx
git commit -m "feat(car-details): respect useTypography for v2 font parity"
```

---

### Task 4.2: Add "Внешний вид" row to `AccountSettingsScreen`

**Files:**
- Modify: `src/screens/AccountSettingsScreen.tsx`

**Spec ref:** §7.

- [ ] **Step 1: Inspect the screen and pick an insertion point**

Open `src/screens/AccountSettingsScreen.tsx`. Find an existing settings section as a structural template (likely a language row). Insert the new "Внешний вид" section before notifications or after language — wherever the visual rhythm fits.

- [ ] **Step 2: Add the section**

```tsx
// At top of file (with other imports):
import { useUIVersion, UIVersion } from '../context/UIVersionContext';
import { Check } from 'lucide-react-native';

// Inside the component:
const { version, setVersion } = useUIVersion();

// In the JSX, where other settings sections live:
<View style={styles.section}>
  <Text style={styles.sectionTitle}>{t.appearanceTitle}</Text>
  <TouchableOpacity
    style={styles.row}
    onPress={() => setVersion('v1' as UIVersion)}
    activeOpacity={0.85}
  >
    <View style={styles.radio}>
      {version === 'v1' && <View style={styles.radioDot} />}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{t.appearanceClassic}</Text>
      <Text style={styles.rowDesc}>{t.appearanceClassicDesc}</Text>
    </View>
    {version === 'v1' && <Check size={18} color={COLORS.accent} />}
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.row}
    onPress={() => setVersion('v2' as UIVersion)}
    activeOpacity={0.85}
  >
    <View style={styles.radio}>
      {version === 'v2' && <View style={styles.radioDot} />}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{t.appearanceNew}</Text>
      <Text style={styles.rowDesc}>{t.appearanceNewDesc}</Text>
    </View>
    {version === 'v2' && <Check size={18} color={COLORS.accent} />}
  </TouchableOpacity>
</View>
```

Add the styles to the file's `StyleSheet.create`:
```ts
section:      { marginTop: 24, paddingHorizontal: 16 },
sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 },
row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
rowTitle:     { fontSize: 16, color: COLORS.textPrimary, fontWeight: '600' },
rowDesc:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
```

(If similar style names already exist in the file, namespace yours with `appearance` prefix to avoid collision.)

- [ ] **Step 3: Manual UAT**

Open AccountSettings. Tap "Новый". Confirm radio moves. Navigate back to Home — verify it re-renders as v2. Re-open settings, tap "Классический" — verify Home returns to v1 on next visit.

- [ ] **Step 4: Commit**

```bash
git add src/screens/AccountSettingsScreen.tsx
git commit -m "feat(settings): add 'Внешний вид' v1/v2 toggle row"
```

---

### Task 4.3: Add `V2InviteBanner` to v1 `HomeScreen`

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Mount the banner**

Add the import:
```tsx
import { V2InviteBanner } from '../components/home/v2/V2InviteBanner';
```

Find the `ListHeaderComponent` in `HomeScreen.tsx`'s `FlatList`. Add the banner as the FIRST element inside the fragment:

```tsx
ListHeaderComponent={
  <>
    <V2InviteBanner
      headline={t.newDesignAvailable}
      tryLabel={t.tryNow}
      notNowLabel={t.notNow}
    />
    <View style={styles.searchSection}>
      ...
```

(Banner component internally checks `version === 'v1' && !inviteDismissed`; it returns null when those don't hold, so this mount is always safe.)

- [ ] **Step 2: Manual UAT**

Fresh install (or clear AsyncStorage via dev menu). Open Home — banner appears at top. Tap "Попробовать" — verify v2 takes over. Toggle back to v1 in Settings. Re-open Home — banner does **not** reappear (one-shot persists).

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat(home): add V2InviteBanner to v1 Home"
```

---

### Task 4.4: Add `__DEV__` reset-onboarding debug action

**Files:**
- Modify: `src/screens/AccountSettingsScreen.tsx`

QA needs a way to force-show the invite banner repeatedly.

- [ ] **Step 1: Add a dev-only row at the bottom of Settings**

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
// ...
{__DEV__ && (
  <TouchableOpacity
    style={[styles.row, { marginTop: 24 }]}
    onPress={async () => {
      await AsyncStorage.removeItem('ui_design_invite_dismissed_v2');
      console.log('[DEV] Reset onboarding banner — restart app to see it.');
    }}
  >
    <Text style={[styles.rowTitle, { color: COLORS.textSecondary }]}>
      [DEV] Reset onboarding banner
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/AccountSettingsScreen.tsx
git commit -m "chore(dev): add reset-onboarding debug action (DEV only)"
```

---

## Phase 5 — Manual UAT runbook

### Task 5.1: Final manual UAT pass

This task has no commits. Run through the runbook on both iOS and Android before marking the milestone complete.

- [ ] **Step 1: iOS pass**

Build and run on iOS simulator (or device): `npm run ios`. Walk through:
1. **Cold start as v1.** Verify Home renders identically to pre-milestone (search bar at top, filters, carousel).
2. **Invite banner.** Banner appears at top of Home. Tap "Не сейчас" → it slides up and disappears. Force-quit and relaunch — banner stays dismissed.
3. **Reset onboarding (DEV row).** Tap the [DEV] row in Settings. Relaunch app — banner reappears.
4. **Try v2.** Tap "Попробовать". App switches to v2 Home.
5. **v2 Home.** Verify: floating search pill, greeting block ("Доброе утро · Москва"), hero rotator (swipe through 3-5 cards, dot indicator advances), "Свежие предложения" shelf (horizontal scroll), feed of small cards, pull-to-refresh works, EditorialDock at bottom (Главная · FAB · Ещё), tapping FAB navigates to SellCar.
6. **v2 Search.** Tap search pill → SearchResults pushes. Verify: back button, title, market stats strip (3 cells), filter chips, sort dropdown opens sheet, result list shows Small cards, "Показать ещё" reveals next batch.
7. **CarDetails font swap.** Tap any car → CarDetails opens. Verify text uses Manrope/JetBrains Mono. Settings → switch to v1 → tap same car → verify text reverts to system font.
8. **Filter unwind on back.** v2 Home with a filter applied → tap iOS back gesture → filter unwinds (matches v1 behavior).
9. **Toggle round-trip.** Settings → "Классический" → Home reverts. Settings → "Новый" → Home becomes v2. Repeat 3x.
10. **RU/EN switch.** Toggle language. Verify v2 strings localize (greeting, kicker, CTA, etc).

- [ ] **Step 2: Android pass**

Same runbook with: `npm run android`. Additionally:
- Verify Android hardware back button: presses unwind filters, then exit prompt (existing v1 behavior preserved in v2).
- Verify font rendering on Android (Logcat should show no "could not find typeface" warnings).
- Verify gradient (EditorialDock fade, HeroCard photo overlay) renders correctly on Android.

- [ ] **Step 3: Toggle persistence**

On both platforms: kill the app while in v2. Relaunch — Home should render v2 immediately (toggle persisted). Same for v1.

- [ ] **Step 4: Regression sanity**

On both platforms, in **v1** mode:
- Login flow works
- Sell car form opens
- Profile / MyOrders / Favorites accessible
- Existing CarDetails still scrollable, photos zoom, contact buttons work
- Cart still works (book a service test)

These are out of scope for v2, but must not regress.

- [ ] **Step 5: Record UAT results**

Create `docs/superpowers/uat/2026-XX-XX-homescreen-v2-uat.md` (substitute actual date) with the pass/fail status of each item above, screenshots of v1 Home, v2 Home, v2 SearchResults, and CarDetails (v1 and v2 font side-by-side). Commit.

```bash
git add docs/superpowers/uat/
git commit -m "test(home-v2): UAT runbook results"
```

---

## Out of scope (do not implement)

- Backend `promoted`/`match`/`priceDelta`/`postedAt` fields and the server-side ranker.
- Promoted-card analytics (`promoted_impression`/`click`/`dismiss`).
- Backend-synced toggle preference.
- Disclosure label feature flag (`реклама`).
- Hero rotator auto-advance + visibility-pause.
- v2 redesign of Profile / MyListings / Favorites / Cart / SellCar / Login.
- 5-tab bottom dock with Search + Favorites as new routes.
- New filter UI / new sort options beyond those listed.
- Real backdrop blur on the search pill.
- Image CDN migration (Unsplash placeholders in handoff are reference only).
- Bug fixes / refactors unrelated to the toggle and v2 screens.

If any of these come up during implementation, **stop** and check with the user before proceeding.
