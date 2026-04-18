import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

// ---- Mock setup ----

jest.mock('../../services/moderation/ModerationService', () => ({
  ModerationService: {
    searchUsers: jest.fn(),
    getHistory: jest.fn(),
    unsuspend: jest.fn(),
  },
}));

jest.mock('../../services/AuthService', () => ({ AuthService: {} }));

const mockRefreshUserForced = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { localId: 'admin-1', email: 'admin@x.com' },
    isAdmin: true,
    refreshUser: jest.fn(),
    refreshUserForced: mockRefreshUserForced,
  }),
}));

// Stable Proxy — reused across renders.
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { targetUid: 'u-7' } }),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

import { ModerationService } from '../../services/moderation/ModerationService';
import { AdminUserDetailScreen } from '../AdminUserDetailScreen';

const HISTORY_ROWS = [
  {
    _id: 'a1',
    action: 'suspend',
    severity: 'feature_limited',
    adminUid: 'admin-1',
    adminEmail: 'admin@x.com',
    targetUid: 'u-7',
    reasonCategory: 'spam',
    createdAt: '2026-04-18T12:00:00Z',
  },
  {
    _id: 'a2',
    action: 'suspend',
    severity: 'feature_limited',
    adminUid: 'admin-1',
    adminEmail: 'admin@x.com',
    targetUid: 'u-7',
    reasonCategory: 'spam',
    createdAt: '2026-04-17T12:00:00Z',
  },
];

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
    tree = TestRenderer.create(<AdminUserDetailScreen />);
  });
  await settle();
  return tree!;
}

function targetInState(state: string) {
  return {
    localId: 'u-7',
    email: 'target@example.com',
    moderationStatus: { state },
  };
}

describe('AdminUserDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ModerationService.searchUsers as jest.Mock).mockResolvedValue({
      users: [targetInState('feature_limited')],
      nextCursor: null,
    });
    (ModerationService.getHistory as jest.Mock).mockResolvedValue({
      rows: HISTORY_ROWS,
      nextCursor: null,
    });
    (ModerationService.unsuspend as jest.Mock).mockResolvedValue(undefined);
  });

  test('loads target user via searchUsers + history via getHistory on mount', async () => {
    await mount();
    expect(ModerationService.searchUsers).toHaveBeenCalled();
    expect(ModerationService.getHistory).toHaveBeenCalled();
  });

  test('history rows render in most-recent-first order (a1 before a2)', async () => {
    const tree = await mount();
    const texts = tree.root.findAllByType(Text);
    const serialized = texts
      .map((n) => JSON.stringify(n.props.children))
      .join('\n');
    const idxA1 = serialized.indexOf('2026-04-18');
    const idxA2 = serialized.indexOf('2026-04-17');
    // Both timestamps should appear AND a1 (2026-04-18) must come before a2 (2026-04-17)
    expect(idxA1).toBeGreaterThanOrEqual(0);
    expect(idxA2).toBeGreaterThanOrEqual(0);
    expect(idxA1).toBeLessThan(idxA2);
  });

  test('shows Unsuspend button when user state !== active', async () => {
    const tree = await mount();
    const unsuspendBtn = tree.root
      .findAllByType(TouchableOpacity)
      .find((n) => n.props.accessibilityLabel === 'unsuspendUser');
    expect(unsuspendBtn).toBeDefined();
  });

  test('hides Unsuspend button when user state === active', async () => {
    (ModerationService.searchUsers as jest.Mock).mockResolvedValue({
      users: [targetInState('active')],
      nextCursor: null,
    });
    const tree = await mount();
    const unsuspendBtn = tree.root
      .findAllByType(TouchableOpacity)
      .find((n) => n.props.accessibilityLabel === 'unsuspendUser');
    expect(unsuspendBtn).toBeUndefined();
  });

  test('formatYmdHm is applied to history timestamps (YYYY-MM-DD HH:mm)', async () => {
    const tree = await mount();
    const texts = tree.root.findAllByType(Text);
    const serialized = texts
      .map((n) => JSON.stringify(n.props.children))
      .join('\n');
    // formatYmdHm produces a YYYY-MM-DD HH:mm substring somewhere in history
    expect(serialized).toMatch(/2026-04-18 \d{2}:\d{2}/);
  });

  test('renders the target email in the summary card', async () => {
    const tree = await mount();
    const texts = tree.root.findAllByType(Text);
    const emails = texts.filter((n) =>
      JSON.stringify(n.props.children).includes('target@example.com'),
    );
    expect(emails.length).toBeGreaterThan(0);
  });
});
