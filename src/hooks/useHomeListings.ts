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
