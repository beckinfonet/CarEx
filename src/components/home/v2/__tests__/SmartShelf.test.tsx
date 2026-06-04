import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, FlatList } from 'react-native';
import { SmartShelf } from '../SmartShelf';

const CARS = [
  { id: 'a', make: 'Audi', model: 'Q5', year: 2021, mileage: 41000, price: 38500, image: 'https://x' },
  { id: 'b', make: 'BMW',  model: 'X5', year: 2023, mileage: 12000, price: 52000, image: 'https://x' },
];

describe('SmartShelf', () => {
  test('returns null when cars is empty', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <SmartShelf kicker="K" title="T" cars={[]} kmSuffix="км" onCardPress={jest.fn()} />
      );
    });
    expect(tree!.toJSON()).toBeNull();
  });

  test('renders header and a FlatList with the cars', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <SmartShelf kicker="JUST" title="Fresh" cars={CARS} kmSuffix="км" onCardPress={jest.fn()} />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('JUST');
    expect(joined).toContain('Fresh');
    expect(tree!.root.findAllByType(FlatList)[0].props.data).toHaveLength(2);
  });
});
