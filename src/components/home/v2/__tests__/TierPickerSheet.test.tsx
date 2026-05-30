import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity, Modal } from 'react-native';
import { TierPickerSheet } from '../TierPickerSheet';

const PREVIEWS = {
  wholesome: 'Доброе утро, Becky.',
  sarcastic: 'Доброе утро. Опять ищем машину?',
  unhinged:  'Ты вернулся. Машины тоже.',
};

describe('TierPickerSheet', () => {
  test('renders nothing meaningful when visible=false', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierPickerSheet
          visible={false}
          currentTier="sarcastic"
          previews={PREVIEWS}
          labels={{ title: 'PERSONALITY', close: 'Close', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
          onSelect={() => {}}
          onDismiss={() => {}}
        />
      );
    });
    const modal = tree!.root.findByType(Modal);
    expect((modal.props as any).visible).toBe(false);
  });

  test('shows all three tier rows with previews when visible', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierPickerSheet
          visible={true}
          currentTier="sarcastic"
          previews={PREVIEWS}
          labels={{ title: 'PERSONALITY', close: 'Close', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
          onSelect={() => {}}
          onDismiss={() => {}}
        />
      );
    });
    const joined = JSON.stringify(tree!.root.findAllByType(Text).map((n) => n.props.children));
    expect(joined).toContain('Wholesome');
    expect(joined).toContain('Sarcastic');
    expect(joined).toContain('Unhinged');
    expect(joined).toContain(PREVIEWS.wholesome);
    expect(joined).toContain(PREVIEWS.sarcastic);
    expect(joined).toContain(PREVIEWS.unhinged);
  });

  test('tapping a tier row calls onSelect with that tier', async () => {
    const onSelect = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierPickerSheet
          visible={true}
          currentTier="wholesome"
          previews={PREVIEWS}
          labels={{ title: 'PERSONALITY', close: 'Close', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
          onSelect={onSelect}
          onDismiss={() => {}}
        />
      );
    });
    const sarcasticRow = tree!.root.findByProps({ testID: 'tier-row-sarcastic' });
    act(() => { (sarcasticRow.props as any).onPress(); });
    expect(onSelect).toHaveBeenCalledWith('sarcastic');
  });

  test('tapping the backdrop calls onDismiss', async () => {
    const onDismiss = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierPickerSheet
          visible={true}
          currentTier="wholesome"
          previews={PREVIEWS}
          labels={{ title: 'PERSONALITY', close: 'Close', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
          onSelect={() => {}}
          onDismiss={onDismiss}
        />
      );
    });
    const backdrop = tree!.root.findByProps({ testID: 'tier-sheet-backdrop' });
    act(() => { (backdrop.props as any).onPress(); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('selected row has accessibilityState.selected=true', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierPickerSheet
          visible={true}
          currentTier="unhinged"
          previews={PREVIEWS}
          labels={{ title: 'PERSONALITY', close: 'Close', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
          onSelect={() => {}}
          onDismiss={() => {}}
        />
      );
    });
    const unhingedRow = tree!.root.findByProps({ testID: 'tier-row-unhinged' });
    expect((unhingedRow.props as any).accessibilityState).toEqual({ selected: true });
    expect((unhingedRow.props as any).accessibilityRole).toBe('radio');
    const wholesomeRow = tree!.root.findByProps({ testID: 'tier-row-wholesome' });
    expect((wholesomeRow.props as any).accessibilityState).toEqual({ selected: false });
  });

  test('tapping the × close button calls onDismiss', async () => {
    const onDismiss = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <TierPickerSheet
          visible={true}
          currentTier="wholesome"
          previews={PREVIEWS}
          labels={{ title: 'PERSONALITY', close: 'Close', wholesome: 'Wholesome', sarcastic: 'Sarcastic', unhinged: 'Unhinged' }}
          onSelect={() => {}}
          onDismiss={onDismiss}
        />
      );
    });
    const closeBtn = tree!.root.findByProps({ testID: 'tier-sheet-close' });
    act(() => { (closeBtn.props as any).onPress(); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
