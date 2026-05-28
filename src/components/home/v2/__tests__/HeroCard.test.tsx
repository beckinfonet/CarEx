import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { HeroCard, HeroCardCar } from '../HeroCard';

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
    expect(joined).toContain('52,000');
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
