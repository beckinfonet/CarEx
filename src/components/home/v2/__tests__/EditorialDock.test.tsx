import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { EditorialDock } from '../EditorialDock';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('EditorialDock', () => {
  beforeEach(() => mockNavigate.mockClear());

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
    expect(mockNavigate).toHaveBeenCalledWith('Home', { clearFilters: true });
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
    expect(mockNavigate).toHaveBeenCalledWith('SellCar');
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
