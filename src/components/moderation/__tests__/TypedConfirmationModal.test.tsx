import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import { TypedConfirmationModal } from '../TypedConfirmationModal';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_target: unknown, k: string) => String(k) }) }),
}));

function makeProps(
  overrides: Partial<React.ComponentProps<typeof TypedConfirmationModal>> = {},
) {
  return {
    visible: true,
    action: 'delete_profile' as const,
    targetEmail: 'target@example.com',
    submitting: false,
    onConfirm: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

function findConfirmButton(root: TestRenderer.ReactTestInstance) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === 'modalConfirm');
}

function findCancelButton(root: TestRenderer.ReactTestInstance) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === 'modalCancel');
}

function render(
  props: Partial<React.ComponentProps<typeof TypedConfirmationModal>> = {},
) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<TypedConfirmationModal {...makeProps(props)} />);
  });
  return tree!;
}

describe('TypedConfirmationModal', () => {
  test('Confirm is disabled when input is empty', () => {
    const tree = render();
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
    expect(confirm?.props.accessibilityState.disabled).toBe(true);
  });

  test('Confirm is disabled when input does not match target.email', () => {
    const tree = render();
    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('mismatch@example.com');
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
  });

  test('Confirm enables when input matches target.email (trim + lowercase)', () => {
    const tree = render();
    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('  TARGET@example.com  ');
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(false);
  });

  test('fires onConfirm() exactly once per Confirm tap when valid', () => {
    const onConfirm = jest.fn();
    const tree = render({ onConfirm });
    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('target@example.com');
    });
    const confirm = findConfirmButton(tree.root);
    act(() => {
      confirm?.props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('warning body switches by action (delete vs revoke vs permaban)', () => {
    const deleteTree = render({ action: 'delete_profile' });
    expect(JSON.stringify(deleteTree.toJSON())).toContain(
      'typedConfirmWarningBodyDelete',
    );

    const revokeTree = render({ action: 'revoke_role' });
    expect(JSON.stringify(revokeTree.toJSON())).toContain(
      'typedConfirmWarningBodyRevoke',
    );

    const banTree = render({ action: 'permanently_banned' });
    expect(JSON.stringify(banTree.toJSON())).toContain(
      'typedConfirmWarningBodyPermaBan',
    );
  });

  test('fires onClose when Cancel is tapped', () => {
    const onClose = jest.fn();
    const tree = render({ onClose });
    const cancel = findCancelButton(tree.root);
    act(() => {
      cancel?.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Confirm button carries COLORS.destructive background (#EF4444)', () => {
    const tree = render();
    const serialized = JSON.stringify(tree.toJSON());
    // #EF4444 is COLORS.destructive per theme.ts
    expect(serialized).toContain('#EF4444');
  });

  test('submitting=true disables Confirm even when input matches', () => {
    const tree = render({ submitting: true });
    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('target@example.com');
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
  });

  // Phase 10 Plan 07 — additive keyboardType prop (Pitfall 3 mitigation)
  test('default keyboardType is "email-address" (regression-lock for existing user-mod call sites)', () => {
    const tree = render();
    const input = tree.root.findByType(TextInput);
    expect(input.props.keyboardType).toBe('email-address');
  });

  test('override keyboardType="default" renders a normal keyboard (with spacebar) for listing-title sentinel', () => {
    const tree = render({ keyboardType: 'default' });
    const input = tree.root.findByType(TextInput);
    expect(input.props.keyboardType).toBe('default');
  });
});
