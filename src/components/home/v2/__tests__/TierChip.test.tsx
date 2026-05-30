import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity, Vibration } from 'react-native';
import { TierChip } from '../TierChip';

describe('TierChip', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('passes through the wholesome label prop', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="wholesome" label="Спокойно" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="Personality: Спокойно" a11yHint="hint" />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Спокойно');
  });

  test('passes through the sarcastic label prop', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="sarcastic" label="Sarcastic" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Sarcastic');
  });

  test('passes through the unhinged label prop', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="unhinged" label="Безумие" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Безумие');
  });

  test('tap invokes onCycle', async () => {
    const onCycle = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="wholesome" label="Wholesome" onCycle={onCycle} onOpenPicker={() => {}} a11yLabel="x" a11yHint="x" />
      );
    });
    const touchable = tree!.root.findByType(TouchableOpacity);
    act(() => { (touchable.props as any).onPress(); });
    expect(onCycle).toHaveBeenCalledTimes(1);
    expect(Vibration.vibrate).toHaveBeenCalledWith(10);
  });

  test('long-press invokes onOpenPicker', async () => {
    const onOpenPicker = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="sarcastic" label="Sarcastic" onCycle={() => {}} onOpenPicker={onOpenPicker} a11yLabel="x" a11yHint="x" />
      );
    });
    const touchable = tree!.root.findByType(TouchableOpacity);
    act(() => { (touchable.props as any).onLongPress(); });
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
    expect(Vibration.vibrate).toHaveBeenCalledWith(15);
  });

  test('exposes accessibility label and hint', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierChip tier="sarcastic" label="Sarcastic" onCycle={() => {}} onOpenPicker={() => {}} a11yLabel="Personality: Sarcastic" a11yHint="Double tap to switch, long press to pick" />
      );
    });
    const touchable = tree!.root.findByType(TouchableOpacity);
    expect((touchable.props as any).accessibilityLabel).toBe('Personality: Sarcastic');
    expect((touchable.props as any).accessibilityHint).toBe('Double tap to switch, long press to pick');
    expect((touchable.props as any).accessibilityRole).toBe('button');
  });
});
