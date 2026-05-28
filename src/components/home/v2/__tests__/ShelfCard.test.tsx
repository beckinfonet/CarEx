import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { ShelfCard, ShelfCardCar } from '../ShelfCard';

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
    expect(joined).toContain('38,500');
    expect(joined).toContain('41,000');

    act(() => { tree!.root.findByType(TouchableOpacity).props.onPress(); });
    expect(onPress).toHaveBeenCalledWith(CAR);
  });
});
