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

// Canonical saved-search / deep-link keys produced by the backend and parsed by
// routeNotification (NotificationsScreen). The hook's own predicate keys on RU
// labels (`'Цена'`/`'Год'`) + selectedMake/selectedModel, so these would be inert
// without a translation step (CR-03).
const CANONICAL_KEYS = [
  'makeId',
  'modelId',
  'priceMin',
  'priceMax',
  'yearMin',
  'yearMax',
  'bodyType',
];

function hasCanonicalKeys(filters?: ActiveFilters): boolean {
  if (!filters) return false;
  return CANONICAL_KEYS.some((k) => filters[k] != null && filters[k] !== '');
}

/**
 * Reverse-lookup a CATEGORIES id from a canonical bodyType string, mirroring the
 * case-insensitive substring matching filteredCars uses (category.name vs bodyType
 * in EITHER direction, plus the id===2 'suv' special case). Returns null when no
 * category matches, so the deep link still applies make/model/price/year filters
 * without spuriously narrowing the body category.
 */
function categoryIdForBodyType(bodyType: unknown): number | null {
  if (bodyType == null || bodyType === '') return null;
  const bt = String(bodyType).toLowerCase();
  for (const category of CATEGORIES) {
    const name = category.name.toLowerCase();
    if (
      bt.includes(name) ||
      name.includes(bt) ||
      (category.id === 2 && bt.includes('suv'))
    ) {
      return category.id;
    }
  }
  return null;
}

/**
 * Translate canonical deep-link initialFilters (makeId/priceMin/yearMin/...) into
 * the hook's internal model: RU-label range filters + selectedMake/selectedModel
 * seeds + a resolved selectedCategory from bodyType. ADDITIVE and idempotent-safe
 * — only canonical keys are transformed; any already-RU-label or unrelated keys
 * (e.g. 'Цена', 'sortPrice') pass through untouched. When NO canonical key is
 * present the input is returned BYTE-EQUAL (selectedCategory null) so the shared
 * home-screen path is unaffected (CR-03 critical constraint).
 */
export function normalizeInitialFilters(filters?: ActiveFilters): {
  activeFilters: ActiveFilters;
  selectedMake: SelectedRef;
  selectedModel: SelectedRef;
  selectedCategory: number | null;
} {
  if (!hasCanonicalKeys(filters)) {
    return {
      activeFilters: filters ?? {},
      selectedMake: null,
      selectedModel: null,
      selectedCategory: null,
    };
  }

  const src = filters as ActiveFilters;
  const next: ActiveFilters = {};
  // Carry through everything that is NOT a canonical key (e.g. an RU-label
  // filter or a sort flag arriving alongside canonical ones).
  for (const [k, v] of Object.entries(src)) {
    if (!CANONICAL_KEYS.includes(k)) next[k] = v;
  }

  const priceMin = src.priceMin;
  const priceMax = src.priceMax;
  if ((priceMin != null && priceMin !== '') || (priceMax != null && priceMax !== '')) {
    next['Цена'] = {
      ...(priceMin != null && priceMin !== '' ? { min: String(priceMin) } : {}),
      ...(priceMax != null && priceMax !== '' ? { max: String(priceMax) } : {}),
    };
  }

  const yearMin = src.yearMin;
  const yearMax = src.yearMax;
  if ((yearMin != null && yearMin !== '') || (yearMax != null && yearMax !== '')) {
    next['Год'] = {
      ...(yearMin != null && yearMin !== '' ? { min: String(yearMin) } : {}),
      ...(yearMax != null && yearMax !== '' ? { max: String(yearMax) } : {}),
    };
  }

  // bodyType has no RU-label predicate equivalent — carry the raw value through
  // (harmless) AND resolve it to a CATEGORIES id so filteredCars' existing
  // category path actually narrows the list to that body type.
  let selectedCategory: number | null = null;
  if (src.bodyType != null && src.bodyType !== '') {
    next.bodyType = src.bodyType;
    selectedCategory = categoryIdForBodyType(src.bodyType);
  }

  const selectedMake: SelectedRef =
    src.makeId != null && src.makeId !== ''
      ? { id: String(src.makeId), name: '' }
      : null;
  const selectedModel: SelectedRef =
    src.modelId != null && src.modelId !== ''
      ? { id: String(src.modelId), name: '' }
      : null;

  return { activeFilters: next, selectedMake, selectedModel, selectedCategory };
}

export function useHomeListings(opts: UseHomeListingsOpts = {}) {
  const isFocused = useIsFocused();

  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Translate canonical deep-link filters (makeId/priceMin/...) into the hook's
  // internal model on first render. For non-deep-link callers (no canonical keys,
  // including undefined) this returns the input unchanged → the home-screen path
  // is byte-equivalent (CR-03). Lazy initializer so it runs exactly once.
  const [seed] = useState(() => normalizeInitialFilters(opts.initialFilters));

  const [selectedMake, setSelectedMake] = useState<SelectedRef>(seed.selectedMake);
  const [selectedModel, setSelectedModel] = useState<SelectedRef>(seed.selectedModel);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(seed.selectedCategory);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(seed.activeFilters);
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
        image: (car.thumbnailUrls && car.thumbnailUrls.length > 0)
          ? car.thumbnailUrls[0]
          : ((car.imageUrls && car.imageUrls.length > 0) ? car.imageUrls[0] : (car.imageUrl || 'https://via.placeholder.com/400x300')),
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
