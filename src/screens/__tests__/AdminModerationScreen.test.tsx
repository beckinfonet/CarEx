import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';

// ---- Mock setup ----

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

const mockRefreshUserForced = jest.fn();
const mockRefreshUser = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { localId: 'admin-1' },
    isAdmin: true,
    refreshUser: mockRefreshUser,
    refreshUserForced: mockRefreshUserForced,
  }),
}));

// Stable Proxy — reused across renders so dependent useCallback references
// don't rotate identity between commits (which would re-fire useEffect and
// duplicate the searchUsers calls the pagination guard test relies on).
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
import { AdminModerationScreen } from '../AdminModerationScreen';
import { QuickActionSheet } from '../../components/moderation/QuickActionSheet';
import { TypedConfirmationModal } from '../../components/moderation/TypedConfirmationModal';

const SAMPLE_USER = {
  localId: 'u-1',
  email: 'target@example.com',
  brokerStatus: 'APPROVED',
  moderationStatus: { state: 'active' as const },
};

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
    tree = TestRenderer.create(<AdminModerationScreen />);
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

describe('AdminModerationScreen', () => {
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

  test('fires searchUsers on mount', async () => {
    await mount();
    expect(ModerationService.searchUsers).toHaveBeenCalled();
  });

  test('renders a list row with a MoreVertical action button', async () => {
    const tree = await mount();
    expect(findActionButton(tree.root)).toBeDefined();
  });

  test('delete_profile preserves explicit role:"broker" from QuickActionSheet through to deleteProviderProfile', async () => {
    const tree = await mount();

    act(() => {
      findActionButton(tree.root)?.props.onPress();
    });

    const sheet = tree.root.findByType(QuickActionSheet);
    act(() => {
      sheet.props.onSelect({ action: 'delete_profile', role: 'broker' });
    });

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

  test('delete_profile preserves explicit role:"logistics" from QuickActionSheet through to deleteProviderProfile', async () => {
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

  test('pagination guard: fetchNextPage no-ops when nextCursor is null', async () => {
    const tree = await mount();
    const callsBefore = (ModerationService.searchUsers as jest.Mock).mock
      .calls.length;
    // Find the FlatList and invoke its onEndReached callback directly
    const list = tree.root.findByProps({ onEndReachedThreshold: 0.5 });
    act(() => {
      list.props.onEndReached();
    });
    await settle();
    // Because nextCursor is null from the initial fetch, no additional
    // searchUsers call should have fired.
    expect(
      (ModerationService.searchUsers as jest.Mock).mock.calls.length,
    ).toBe(callsBefore);
  });
});
