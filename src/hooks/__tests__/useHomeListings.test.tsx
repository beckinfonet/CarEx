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
