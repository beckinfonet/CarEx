import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { QuickActionSheet, QuickActionSelection } from '../QuickActionSheet';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      actionSuspend: 'Suspend',
      actionUnsuspend: 'Unsuspend',
      actionRevokeRole: 'Revoke role',
      actionEditProfile: 'Edit profile',
      actionDeleteProfile: 'Delete profile',
      deleteBrokerProfile: 'Delete broker profile',
      deleteLogisticsProfile: 'Delete logistics profile',
      modalCancel: 'Cancel',
    },
  }),
}));

function makeTarget(overrides: Record<string, unknown> = {}) {
  return {
    localId: 'u-1',
    email: 'target@example.com',
    moderationStatus: { state: 'active' },
    ...overrides,
  } as unknown as import('../../../services/moderation/ModerationService').SearchUserItem;
}

function findRow(root: TestRenderer.ReactTestInstance, testID: string) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.testID === testID);
}

function render(
  props: React.ComponentProps<typeof QuickActionSheet>,
) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<QuickActionSheet {...props} />);
  });
  return tree!;
}

describe('QuickActionSheet', () => {
  test('renders all 5 standard action rows when target is active and has a single provider role (broker)', () => {
    const tree = render({
      visible: true,
      target: makeTarget({ brokerStatus: 'APPROVED' }),
      onSelect: jest.fn(),
      onClose: jest.fn(),
    });
    expect(findRow(tree.root, 'quickaction-suspend')).toBeDefined();
    expect(findRow(tree.root, 'quickaction-unsuspend')).toBeDefined();
    expect(findRow(tree.root, 'quickaction-revoke')).toBeDefined();
    expect(findRow(tree.root, 'quickaction-edit')).toBeDefined();
    expect(findRow(tree.root, 'quickaction-delete')).toBeDefined();
  });

  test('disables Unsuspend when target.moderationStatus.state === active', () => {
    const tree = render({
      visible: true,
      target: makeTarget({ brokerStatus: 'APPROVED' }),
      onSelect: jest.fn(),
      onClose: jest.fn(),
    });
    const row = findRow(tree.root, 'quickaction-unsuspend');
    expect(row?.props.accessibilityState.disabled).toBe(true);
  });

  test('disables Suspend when target is already suspended', () => {
    const tree = render({
      visible: true,
      target: makeTarget({
        brokerStatus: 'APPROVED',
        moderationStatus: { state: 'feature_limited' },
      }),
      onSelect: jest.fn(),
      onClose: jest.fn(),
    });
    const row = findRow(tree.root, 'quickaction-suspend');
    expect(row?.props.accessibilityState.disabled).toBe(true);
  });

  test('disables Edit + Delete when target has NO provider role', () => {
    const tree = render({
      visible: true,
      target: makeTarget(),
      onSelect: jest.fn(),
      onClose: jest.fn(),
    });
    expect(
      findRow(tree.root, 'quickaction-edit')?.props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      findRow(tree.root, 'quickaction-delete')?.props.accessibilityState
        .disabled,
    ).toBe(true);
  });

  // ---- DUAL-ROLE CONTRACT — per RESEARCH §Pitfall 11 ----

  test('renders exactly 2 delete rows (broker + logistics) when target has BOTH brokerStatus===APPROVED AND logisticsStatus===APPROVED', () => {
    const tree = render({
      visible: true,
      target: makeTarget({
        brokerStatus: 'APPROVED',
        logisticsStatus: 'APPROVED',
      }),
      onSelect: jest.fn(),
      onClose: jest.fn(),
    });
    expect(findRow(tree.root, 'quickaction-delete-broker')).toBeDefined();
    expect(findRow(tree.root, 'quickaction-delete-logistics')).toBeDefined();
    // Single fallback row MUST NOT render when both roles are held
    expect(findRow(tree.root, 'quickaction-delete')).toBeUndefined();
  });

  test('renders 1 delete row emitting role:"broker" when target has only brokerStatus===APPROVED', () => {
    const onSelect = jest.fn<void, [QuickActionSelection]>();
    const tree = render({
      visible: true,
      target: makeTarget({ brokerStatus: 'APPROVED' }),
      onSelect,
      onClose: jest.fn(),
    });
    const row = findRow(tree.root, 'quickaction-delete');
    expect(row).toBeDefined();
    expect(findRow(tree.root, 'quickaction-delete-broker')).toBeUndefined();
    expect(
      findRow(tree.root, 'quickaction-delete-logistics'),
    ).toBeUndefined();
    act(() => {
      row?.props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith({
      action: 'delete_profile',
      role: 'broker',
    });
  });

  test('renders 1 delete row emitting role:"logistics" when target has only logisticsStatus===APPROVED', () => {
    const onSelect = jest.fn<void, [QuickActionSelection]>();
    const tree = render({
      visible: true,
      target: makeTarget({ logisticsStatus: 'APPROVED' }),
      onSelect,
      onClose: jest.fn(),
    });
    const row = findRow(tree.root, 'quickaction-delete');
    expect(row).toBeDefined();
    act(() => {
      row?.props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith({
      action: 'delete_profile',
      role: 'logistics',
    });
  });

  test('dual-role: broker delete row emits role:"broker"; logistics row emits role:"logistics"', () => {
    const onSelect = jest.fn<void, [QuickActionSelection]>();
    const tree = render({
      visible: true,
      target: makeTarget({
        brokerStatus: 'APPROVED',
        logisticsStatus: 'APPROVED',
      }),
      onSelect,
      onClose: jest.fn(),
    });
    act(() => {
      findRow(tree.root, 'quickaction-delete-broker')?.props.onPress();
    });
    expect(onSelect).toHaveBeenNthCalledWith(1, {
      action: 'delete_profile',
      role: 'broker',
    });
    // NOTE: first onPress triggers onClose inside `fire()`, which closes the
    // sheet. We still call into the logistics row because the render tree
    // references the handler directly regardless of parent visibility.
    act(() => {
      findRow(tree.root, 'quickaction-delete-logistics')?.props.onPress();
    });
    expect(onSelect).toHaveBeenNthCalledWith(2, {
      action: 'delete_profile',
      role: 'logistics',
    });
  });

  // ---- end dual-role contract ----

  test('fires onSelect({ action: "suspend" }) when Suspend row is tapped', () => {
    const onSelect = jest.fn();
    const tree = render({
      visible: true,
      target: makeTarget({ brokerStatus: 'APPROVED' }),
      onSelect,
      onClose: jest.fn(),
    });
    act(() => {
      findRow(tree.root, 'quickaction-suspend')?.props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith({ action: 'suspend' });
  });

  test('fires onClose when Cancel is tapped', () => {
    const onClose = jest.fn();
    const tree = render({
      visible: true,
      target: makeTarget(),
      onSelect: jest.fn(),
      onClose,
    });
    act(() => {
      findRow(tree.root, 'quickaction-cancel')?.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
