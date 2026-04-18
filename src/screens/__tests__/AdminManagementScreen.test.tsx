import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';

// ---- Mock setup (must be before importing the SUT) ----

jest.mock('../../services/moderation/ModerationService', () => ({
  ModerationService: {
    searchUsers: jest.fn(),
    suspend: jest.fn(),
    unsuspend: jest.fn(),
    revokeRole: jest.fn(),
    editProviderProfile: jest.fn(),
    deleteProviderProfile: jest.fn(),
  },
}));

jest.mock('../../services/AuthService', () => ({ AuthService: {} }));

const mockRefreshUserForced = jest.fn();
const mockRefreshUser = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { localId: 'admin-1', email: 'admin@x.com' },
    isAdmin: true,
    refreshUser: mockRefreshUser,
    refreshUserForced: mockRefreshUserForced,
  }),
}));

// Stable Proxy — reused across renders so dependent useCallback references
// don't rotate identity between commits.
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

import { ModerationService } from '../../services/moderation/ModerationService';
import { AdminManagementScreen } from '../AdminManagementScreen';
import { QuickActionSheet } from '../../components/moderation/QuickActionSheet';
import { TypedConfirmationModal } from '../../components/moderation/TypedConfirmationModal';

const SAMPLE_USER = {
  localId: 'u-1',
  email: 'target@example.com',
  brokerStatus: 'APPROVED',
  logisticsStatus: 'APPROVED',
  moderationStatus: { state: 'active' as const },
};

// React 19's `await act(async)` can hang on components with AbortController +
// async effects. We work around by rendering inside a sync act(), then pumping
// the microtask queue manually (setImmediate) outside act, then wrapping the
// post-flush in another sync act() to swallow state-update warnings.
async function settle() {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
  act(() => {});
}

async function mount() {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<AdminManagementScreen />);
  });
  await settle();
  return tree!;
}

function findActionButton(root: TestRenderer.ReactTestInstance) {
  return root
    .findAllByType(TouchableOpacity)
    .find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.includes('Actions for'),
    );
}

describe('AdminManagementScreen — moderation surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ModerationService.searchUsers as jest.Mock).mockResolvedValue({
      users: [SAMPLE_USER],
      nextCursor: null,
    });
    (ModerationService.deleteProviderProfile as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  test('fetches users via ModerationService.searchUsers on mount', async () => {
    await mount();
    expect(ModerationService.searchUsers).toHaveBeenCalled();
  });

  test('renders a list row for each returned user after the fetch resolves', async () => {
    const tree = await mount();
    expect(findActionButton(tree.root)).toBeDefined();
  });

  test('passes role:"broker" explicitly to deleteProviderProfile when QuickActionSheet emits broker payload', async () => {
    const tree = await mount();

    // Open QuickActionSheet by tapping the row's MoreVertical button
    act(() => {
      findActionButton(tree.root)?.props.onPress();
    });

    // Now the QuickActionSheet has a target; trigger its onSelect directly
    const sheet = tree.root.findByType(QuickActionSheet);
    act(() => {
      sheet.props.onSelect({ action: 'delete_profile', role: 'broker' });
    });

    // TypedConfirmationModal mounted; fire its onConfirm
    const typed = tree.root.findByType(TypedConfirmationModal);
    act(() => {
      typed.props.onConfirm();
    });
    await settle();

    expect(ModerationService.deleteProviderProfile).toHaveBeenCalledWith(
      'u-1',
      { role: 'broker' },
    );
  });

  test('passes role:"logistics" explicitly to deleteProviderProfile when QuickActionSheet emits logistics payload', async () => {
    const tree = await mount();

    act(() => {
      findActionButton(tree.root)?.props.onPress();
    });

    const sheet = tree.root.findByType(QuickActionSheet);
    act(() => {
      sheet.props.onSelect({ action: 'delete_profile', role: 'logistics' });
    });

    const typed = tree.root.findByType(TypedConfirmationModal);
    act(() => {
      typed.props.onConfirm();
    });
    await settle();

    expect(ModerationService.deleteProviderProfile).toHaveBeenCalledWith(
      'u-1',
      { role: 'logistics' },
    );
  });

  test('navigates to AdminUserDetail with targetUid when row body is tapped', async () => {
    const tree = await mount();
    const rowBody = tree.root
      .findAllByType(TouchableOpacity)
      .find(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith('target@example.com'),
      );
    act(() => {
      rowBody?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('AdminUserDetail', {
      targetUid: 'u-1',
    });
  });
});
