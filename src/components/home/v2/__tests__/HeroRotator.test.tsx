import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { HeroRotator } from '../HeroRotator';
import type { HeroCardCar } from '../HeroCard';

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
