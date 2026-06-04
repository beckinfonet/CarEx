import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { LanguageProvider } from '../../../../context/LanguageContext';
import { SmallFeedCard, SmallFeedCardCar } from '../SmallFeedCard';

const CAR: SmallFeedCardCar = { id: 'a', make: 'BMW', model: 'X3', year: 2021, mileage: 38000, bodyType: 'Кроссовер', price: 42000, image: 'https://x' };

describe('SmallFeedCard', () => {
  test('renders content and toggles fav', async () => {
    const onPress = jest.fn();
    const onToggleFav = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <LanguageProvider>
          <SmallFeedCard car={CAR} kmSuffix="км" faved={false} onPress={onPress} onToggleFav={onToggleFav} />
        </LanguageProvider>
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('BMW');
    expect(joined).toContain('X3');
    expect(joined).toContain('42,000');
    expect(joined).toContain('38,000');

    const tappables = tree!.root.findAllByType(TouchableOpacity);
    act(() => { tappables[0].props.onPress(); }); // row → onPress
    act(() => { tappables[1].props.onPress(); }); // heart → onToggleFav
    expect(onPress).toHaveBeenCalledWith(CAR);
    expect(onToggleFav).toHaveBeenCalledWith(CAR);
  });
});
