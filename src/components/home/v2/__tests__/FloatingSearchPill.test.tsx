import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { FloatingSearchPill } from '../FloatingSearchPill';

describe('FloatingSearchPill', () => {
  test('renders placeholder and calls handlers', async () => {
    const onPress = jest.fn();
    const onFiltersPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <FloatingSearchPill placeholder="Что вы ищете?" onPress={onPress} onFiltersPress={onFiltersPress} />
      );
    });
    const root = tree!.root;
    const touchables = root.findAllByType(TouchableOpacity);
    act(() => { touchables[0].props.onPress(); });
    act(() => { touchables[1].props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onFiltersPress).toHaveBeenCalledTimes(1);
  });
});
