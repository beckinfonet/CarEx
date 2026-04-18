import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import { ModerationActionModal } from '../ModerationActionModal';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_target: unknown, k: string) => String(k) }) }),
}));

function makeTarget(overrides: Record<string, unknown> = {}) {
  return {
    localId: 'u-1',
    email: 'target@example.com',
    brokerStatus: 'APPROVED',
    moderationStatus: { state: 'active' },
    ...overrides,
  } as unknown as import('../../../services/moderation/ModerationService').SearchUserItem;
}

function render(props: React.ComponentProps<typeof ModerationActionModal>) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<ModerationActionModal {...props} />);
  });
  return tree!;
}

function findConfirmButton(root: TestRenderer.ReactTestInstance) {
  // Confirm button's accessibilityLabel is the confirm-key for the action
  // (confirmSuspend / confirmUnsuspend / confirmRevokeRole / confirmEditProfile)
  return root
    .findAllByType(TouchableOpacity)
    .find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        (n.props.accessibilityLabel as string).startsWith('confirm'),
    );
}

describe('ModerationActionModal', () => {
  test('renders severity, reason, note sections for action="suspend"', () => {
    const tree = render({
      visible: true,
      action: 'suspend',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const serialized = JSON.stringify(tree.toJSON());
    expect(serialized).toContain('severityFeatureLimited');
    expect(serialized).toContain('reasonSpam');
    expect(serialized).toContain('fieldNote');
  });

  test('Confirm disabled for suspend until severity + reason picked', () => {
    const tree = render({
      visible: true,
      action: 'suspend',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
  });

  test('Confirm enabled immediately for unsuspend (no fields required)', () => {
    const tree = render({
      visible: true,
      action: 'unsuspend',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(false);
  });

  test('unsuspend Confirm tap emits { action: "unsuspend", body: { note: undefined } }', () => {
    const onSubmit = jest.fn();
    const tree = render({
      visible: true,
      action: 'unsuspend',
      target: makeTarget(),
      onSubmit,
      onClose: jest.fn(),
    });
    const confirm = findConfirmButton(tree.root);
    act(() => {
      confirm?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith({
      action: 'unsuspend',
      body: { note: undefined },
    });
  });

  test('note TextInput enforces maxLength 500 prop', () => {
    const tree = render({
      visible: true,
      action: 'unsuspend',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const inputs = tree.root.findAllByType(TextInput);
    const noteInput = inputs.find((n) => n.props.maxLength === 500);
    expect(noteInput).toBeDefined();
  });

  test('submitting=true disables Confirm even when form is valid', () => {
    const tree = render({
      visible: true,
      action: 'unsuspend',
      target: makeTarget(),
      submitting: true,
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
  });

  test('renders edit_profile form with company/phone/telegram fields when target has broker APPROVED', () => {
    const tree = render({
      visible: true,
      action: 'edit_profile',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const serialized = JSON.stringify(tree.toJSON());
    expect(serialized).toContain('fieldCompanyName');
    expect(serialized).toContain('fieldPhoneNumber');
    expect(serialized).toContain('fieldTelegram');
  });

  test('Confirm disabled for edit_profile until any field changes', () => {
    const tree = render({
      visible: true,
      action: 'edit_profile',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
  });

  test('Confirm enables for edit_profile after typing into companyName field', () => {
    const tree = render({
      visible: true,
      action: 'edit_profile',
      target: makeTarget(),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    // First non-note TextInput is companyName (see EditProfileForm order)
    const inputs = tree.root.findAllByType(TextInput);
    const companyInput = inputs.find((n) => n.props.maxLength !== 500);
    expect(companyInput).toBeDefined();
    act(() => {
      companyInput?.props.onChangeText('Acme Inc');
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(false);
  });

  test('revoke_role Confirm disabled until both role and reason are picked', () => {
    const tree = render({
      visible: true,
      action: 'revoke_role',
      target: makeTarget({
        brokerStatus: 'APPROVED',
        sellerStatus: 'APPROVED',
      }),
      onSubmit: jest.fn(),
      onClose: jest.fn(),
    });
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);
  });
});
