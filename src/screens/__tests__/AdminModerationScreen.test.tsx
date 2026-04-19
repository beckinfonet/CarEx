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

  test('fires searchUsers ONCE on mount with no q param (initial load shows all users matching filters)', async () => {
    await mount();
    expect(ModerationService.searchUsers).toHaveBeenCalledTimes(1);
    const [queryArg] = (ModerationService.searchUsers as jest.Mock).mock.calls[0];
    expect(queryArg.q).toBeUndefined(); // empty draft → no q param sent
  });

  test('does NOT call searchUsers on every keystroke — typing into the input fires zero additional requests', async () => {
    const tree = await mount();
    const callsAfterMount = (ModerationService.searchUsers as jest.Mock).mock.calls.length;

    // Locate the TextInput by its accessibility label (matches T.searchEmailOrUid via mockT Proxy: 'searchEmailOrUid')
    const input = tree.root
      .findAllByType(require('react-native').TextInput)
      .find((n) => n.props.accessibilityLabel === 'searchEmailOrUid');
    expect(input).toBeDefined();

    // Simulate three keystrokes
    act(() => { input!.props.onChangeText('a'); });
    act(() => { input!.props.onChangeText('ab'); });
    act(() => { input!.props.onChangeText('abc'); });
    await settle();

    // Critical contract: zero additional searchUsers calls fired.
    expect((ModerationService.searchUsers as jest.Mock).mock.calls.length).toBe(callsAfterMount);
  });

  test('fires searchUsers with the typed query when the Search button is tapped', async () => {
    const tree = await mount();
    const callsAfterMount = (ModerationService.searchUsers as jest.Mock).mock.calls.length;

    const input = tree.root
      .findAllByType(require('react-native').TextInput)
      .find((n) => n.props.accessibilityLabel === 'searchEmailOrUid');
    act(() => { input!.props.onChangeText('alice@example.com'); });
    await settle();

    // Locate the Search button by its accessibilityLabel (mockT returns the key as the label: 'actionSearch')
    const button = tree.root
      .findAllByType(TouchableOpacity)
      .find((n) => n.props.accessibilityLabel === 'actionSearch');
    expect(button).toBeDefined();

    act(() => { button!.props.onPress(); });
    await settle();

    expect((ModerationService.searchUsers as jest.Mock).mock.calls.length).toBe(callsAfterMount + 1);
    const [queryArg] = (ModerationService.searchUsers as jest.Mock).mock.calls[callsAfterMount];
    expect(queryArg.q).toBe('alice@example.com');
  });

  test('fires searchUsers when TextInput onSubmitEditing is invoked (return key)', async () => {
    const tree = await mount();
    const callsAfterMount = (ModerationService.searchUsers as jest.Mock).mock.calls.length;

    const input = tree.root
      .findAllByType(require('react-native').TextInput)
      .find((n) => n.props.accessibilityLabel === 'searchEmailOrUid');
    act(() => { input!.props.onChangeText('bob@example.com'); });
    await settle();

    act(() => { input!.props.onSubmitEditing(); });
    await settle();

    expect((ModerationService.searchUsers as jest.Mock).mock.calls.length).toBe(callsAfterMount + 1);
    const [queryArg] = (ModerationService.searchUsers as jest.Mock).mock.calls[callsAfterMount];
    expect(queryArg.q).toBe('bob@example.com');
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
