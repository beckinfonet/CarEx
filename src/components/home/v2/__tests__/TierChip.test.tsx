import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { TierChip } from '../TierChip';

describe('TierChip', () => {
  test('renders WHOLESOME label when tier is wholesome', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="wholesome" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="Personality: Wholesome" a11yHint="Double tap to switch, long press to pick" />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('WHOLESOME');
  });

  test('renders SARCASTIC label when tier is sarcastic', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="sarcastic" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('SARCASTIC');
  });

  test('renders UNHINGED label when tier is unhinged', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="unhinged" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('UNHINGED');
  });

  test('tap invokes onCycle', async () => {
    const onCycle = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="wholesome" onCycle={onCycle} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
      );
    });
    const touchable = tree!.root.findByType(TouchableOpacity);
    act(() => { (touchable.props as any).onPress(); });
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  test('long-press invokes onOpenPicker', async () => {
    const onOpenPicker = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="sarcastic" onCycle={() => {}} onOpenPicker={onOpenPicker} a11yLabel="x" a11yHint="x" />
      );
    });
    const touchable = tree!.root.findByType(TouchableOpacity);
    act(() => { (touchable.props as any).onLongPress(); });
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  test('exposes accessibility label and hint', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="sarcastic" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="Personality: Sarcastic" a11yHint="Double tap to switch, long press to pick" />
      );
    });
    const touchable = tree!.root.findByType(TouchableOpacity);
    expect((touchable.props as any).accessibilityLabel).toBe('Personality: Sarcastic');
    expect((touchable.props as any).accessibilityHint).toBe('Double tap to switch, long press to pick');
    expect((touchable.props as any).accessibilityRole).toBe('button');
  });
});
