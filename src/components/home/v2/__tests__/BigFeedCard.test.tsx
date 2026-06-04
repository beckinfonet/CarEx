import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { BigFeedCard, BigFeedCardCar } from '../BigFeedCard';

const CAR: BigFeedCardCar = { id: 'a', make: 'Porsche', model: 'Macan', year: 2022, mileage: 14500, bodyType: 'Кроссовер', price: 58900, image: 'https://x' };

describe('BigFeedCard', () => {
  test('renders content and handlers fire', async () => {
    const onPress = jest.fn();
    const onToggleFav = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <BigFeedCard car={CAR} kmSuffix="км" ctaLabel="Открыть" faved={false} onPress={onPress} onToggleFav={onToggleFav} />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Porsche');
    expect(joined).toContain('Macan');
    expect(joined).toContain('58,900');
    expect(joined).toContain('14,500');
    expect(joined).toContain('Открыть');

    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[0].props.onPress(); });
    act(() => { tappables[1].props.onPress(); });
    expect(onPress).toHaveBeenCalledWith(CAR);
    expect(onToggleFav).toHaveBeenCalledWith(CAR);
  });
});
