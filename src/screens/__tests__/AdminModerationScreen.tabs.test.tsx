// Phase 10 Plan 10 — Wave 0 RED tests for AdminModerationScreen
// Users|Listings tab control + Listings tab body + per-row Recover.
//
// These tests intentionally fail on a pre-Plan-10 build of AdminModerationScreen
// (no tab control, no Listings tab body, no Recover row). They pass once Plan
// 10 lands the additive edits — Test 13 + Test 12 grep guards keep the user
// tab byte-identical and forbid a separate recoverListing route.
//
// Conventions mirrored from AdminModerationScreen.test.tsx (the existing
// suite): settle() pattern for React-19 + AbortController-effect flakiness,
// stable Proxy mockT (identity-stable across renders), mocked service
// modules + mocked useNavigation/useRoute/useLanguage/useAuth.

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity, TextInput, FlatList } from 'react-native';
import * as fs from 'fs';
import * as path from 'path';

// ---- Mocks ----

jest.mock('../../services/moderation/ModerationService', () => ({
  ModerationService: {
    searchUsers: jest.fn(),
    suspend: jest.fn(),
    unsuspend: jest.fn(),
    revokeRole: jest.fn(),
    editProviderProfile: jest.fn(),
    deleteProviderProfile: jest.fn(),
    searchListings: jest.fn(),
    restoreListing: jest.fn(),
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

// Stable Proxy — identity-stable so useCallback dep arrays do not rotate.
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
import { ListingRestoreModal } from '../../components/moderation/ListingRestoreModal';

// ---- Fixtures ----

const SAMPLE_USER = {
  localId: 'u-1',
  email: 'target@example.com',
  brokerStatus: 'APPROVED',
  moderationStatus: { state: 'active' as const },
};

const SAMPLE_LISTINGS = [
  {
    _id: 'car_001',
    status: 'active' as const,
    makeName: 'Toyota',
    modelName: 'Camry',
    year: 2018,
    price: 18000,
    firstPhotoUrl: 'http://test/1.jpg',
    sellerId: 's_a',
    createdAt: '2026-05-01T00:00:00Z',
  },
  {
    _id: 'car_002',
    status: 'deleted' as const,
    makeName: 'Honda',
    modelName: 'Civic',
    year: 2019,
    price: 16000,
    firstPhotoUrl: null,
    sellerId: 's_b',
    createdAt: '2026-04-15T00:00:00Z',
    moderatedAt: '2026-05-20T00:00:00Z',
    moderationReason: 'duplicate',
  },
];

// ---- Helpers ----

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

function findByTestID(
  root: TestRenderer.ReactTestInstance,
  testID: string,
): TestRenderer.ReactTestInstance | undefined {
  // Prefer the composite (TouchableOpacity / custom component) over the host
  // View. testID is forwarded down to the host, so the same testID matches
  // both — pick the composite (has type as function/class) so accessibilityState
  // and other JSX-prop-only fields are observable.
  const all = root.findAll((n) => n.props && n.props.testID === testID);
  return all.find((n) => typeof n.type !== 'string') ?? all[0];
}

async function switchToListingsTab(tree: TestRenderer.ReactTestRenderer) {
  const tab = findByTestID(tree.root, 'tab-listings');
  expect(tab).toBeDefined();
  act(() => {
    tab!.props.onPress();
  });
  await settle();
}

// ---- Tests ----

describe('AdminModerationScreen — Users|Listings tabs (Plan 10-10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ModerationService.searchUsers as jest.Mock).mockResolvedValue({
      users: [SAMPLE_USER],
      nextCursor: null,
    });
    (ModerationService.searchListings as jest.Mock).mockResolvedValue({
      rows: SAMPLE_LISTINGS,
      nextCursor: 'cursor_b64',
    });
    (ModerationService.restoreListing as jest.Mock).mockResolvedValue({
      ok: true,
      listing: { _id: 'car_002', status: 'active' },
      action: {
        _id: 'a_1',
        action: 'restore',
        fromStatus: 'deleted',
        toStatus: 'active',
        createdAt: '2026-05-29T00:00:00Z',
      },
    });
  });

  // Test 1 (D-09 tab control + D-12 default Users)
  test('renders Users + Listings tab controls; Users tab is active by default; mount fires searchUsers only', async () => {
    const tree = await mount();

    const usersTab = findByTestID(tree.root, 'tab-users');
    const listingsTab = findByTestID(tree.root, 'tab-listings');
    expect(usersTab).toBeDefined();
    expect(listingsTab).toBeDefined();

    // Users tab marked selected — check via the `active` prop on the
    // ChipButton composite (testID returns the composite from findByTestID
    // helper). active === true is the canonical signal for D-12.
    expect(usersTab!.props.active).toBe(true);
    expect(listingsTab!.props.active).toBe(false);

    expect((ModerationService.searchUsers as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((ModerationService.searchListings as jest.Mock).mock.calls.length).toBe(0);
  });

  // Test 2 (tab switch fires Listings search)
  test('tapping the Listings tab fires ModerationService.searchListings once with default query', async () => {
    const tree = await mount();

    await switchToListingsTab(tree);

    const calls = (ModerationService.searchListings as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [queryArg] = calls[0];
    expect(queryArg.status).toBeUndefined();
    expect(queryArg.q).toBeUndefined();
    expect(queryArg.cursor).toBeUndefined();
    expect(queryArg.limit).toBe(25);
  });

  // Test 3 (Listings tab body — filter chips render)
  test('Listings tab renders all 5 filter chips (All|Active|Suspended|Archived|Deleted)', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    expect(findByTestID(tree.root, 'listing-filter-all')).toBeDefined();
    expect(findByTestID(tree.root, 'listing-filter-active')).toBeDefined();
    expect(findByTestID(tree.root, 'listing-filter-suspended')).toBeDefined();
    expect(findByTestID(tree.root, 'listing-filter-archived')).toBeDefined();
    expect(findByTestID(tree.root, 'listing-filter-deleted')).toBeDefined();
  });

  // Test 4 (status filter → service call)
  test('tapping Deleted filter chip fires searchListings with status: "deleted"', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    const callsBefore = (ModerationService.searchListings as jest.Mock).mock.calls.length;

    const deletedChip = findByTestID(tree.root, 'listing-filter-deleted')!;
    act(() => {
      deletedChip.props.onPress();
    });
    await settle();

    const calls = (ModerationService.searchListings as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(callsBefore);
    const latest = calls[calls.length - 1][0];
    expect(latest.status).toBe('deleted');
  });

  // Test 5 (search submit — NOT debounced)
  test('typing into listings search does NOT fire searchListings; tapping Submit fires it with the typed query', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    const callsAfterTabSwitch =
      (ModerationService.searchListings as jest.Mock).mock.calls.length;

    const input = findByTestID(tree.root, 'listings-search-input');
    expect(input).toBeDefined();
    act(() => {
      input!.props.onChangeText('T');
    });
    act(() => {
      input!.props.onChangeText('To');
    });
    act(() => {
      input!.props.onChangeText('Toyota');
    });
    await settle();

    // No per-keystroke firing
    expect((ModerationService.searchListings as jest.Mock).mock.calls.length).toBe(
      callsAfterTabSwitch,
    );

    const submit = findByTestID(tree.root, 'listings-search-submit')!;
    act(() => {
      submit.props.onPress();
    });
    await settle();

    const calls = (ModerationService.searchListings as jest.Mock).mock.calls;
    expect(calls.length).toBe(callsAfterTabSwitch + 1);
    expect(calls[calls.length - 1][0].q).toBe('Toyota');
  });

  // Test 6 (rows render)
  test('rows render with buildListingTitle text', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    const row1 = findByTestID(tree.root, 'listing-row-car_001');
    const row2 = findByTestID(tree.root, 'listing-row-car_002');
    expect(row1).toBeDefined();
    expect(row2).toBeDefined();

    // Walk the subtree and collect Text children verbatim — assert the
    // canonical listing title appears within each row's accessibility label or
    // any descendant Text child.
    const labelRow1 = row1!.props.accessibilityLabel as string | undefined;
    const labelRow2 = row2!.props.accessibilityLabel as string | undefined;
    expect(labelRow1).toContain('2018 Toyota Camry');
    expect(labelRow2).toContain('2019 Honda Civic');
  });

  // Test 7 (per-row Recover ONLY for deleted)
  test('Recover button is rendered ONLY when row.status === "deleted"', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    expect(findByTestID(tree.root, 'listing-row-recover-car_002')).toBeDefined();
    expect(findByTestID(tree.root, 'listing-row-recover-car_001')).toBeUndefined();
  });

  // Test 8 (Recover flow)
  test('tapping Recover opens ListingRestoreModal; submitting calls restoreListing with note and flips the row optimistically', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    const recover = findByTestID(tree.root, 'listing-row-recover-car_002')!;
    act(() => {
      recover.props.onPress();
    });
    await settle();

    // Modal should now be mounted
    const modal = tree.root.findByType(ListingRestoreModal);
    expect(modal).toBeDefined();
    expect(modal.props.visible).toBe(true);
    expect(modal.props.carId).toBe('car_002');

    // Submit with a note
    act(() => {
      modal.props.onSubmit({ note: 'post-appeal' });
    });
    await settle();

    expect(ModerationService.restoreListing).toHaveBeenCalledTimes(1);
    expect((ModerationService.restoreListing as jest.Mock).mock.calls[0][0]).toBe('car_002');
    expect((ModerationService.restoreListing as jest.Mock).mock.calls[0][1]).toEqual({
      note: 'post-appeal',
    });

    // Optimistic update: status flips → Recover button disappears
    await settle();
    expect(findByTestID(tree.root, 'listing-row-recover-car_002')).toBeUndefined();
  });

  // Test 9 (row tap → CarDetails navigation)
  test('row body tap navigates to CarDetails with carId', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    const row1 = findByTestID(tree.root, 'listing-row-car_001')!;
    act(() => {
      row1.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('CarDetails', { carId: 'car_001' });
  });

  // Test 10 (Pitfall 7 — independent abortRefs)
  test('rapid tab switching produces distinct AbortControllers per Listings search (Pitfall 7)', async () => {
    // Hold the listings request open until we explicitly resolve it so we can
    // exercise the abort lifecycle while the request is in-flight.
    let resolveListings: ((v: unknown) => void) | null = null;
    (ModerationService.searchListings as jest.Mock).mockImplementation(
      () =>
        new Promise((res) => {
          resolveListings = res;
        }),
    );

    const tree = await mount();

    // Switch Users → Listings → Users → Listings
    await switchToListingsTab(tree);
    act(() => {
      findByTestID(tree.root, 'tab-users')!.props.onPress();
    });
    await settle();
    act(() => {
      findByTestID(tree.root, 'tab-listings')!.props.onPress();
    });
    await settle();

    // Each tab fired its own search lifecycle; neither side aborted the
    // other (would have surfaced as console.error or test crash if the wrong
    // ref were shared). Distinct AbortControllers are verified by the fact
    // that each searchListings call received a unique AbortSignal instance
    // on its `signal` config field. listingsAbortRef MUST be a distinct
    // useRef instance from abortRef — Test 12's source-grep complements
    // this runtime check.
    const listingsCalls = (ModerationService.searchListings as jest.Mock).mock.calls;
    expect(listingsCalls.length).toBeGreaterThanOrEqual(2);
    const sig1 = listingsCalls[0][1]?.signal;
    const sig2 = listingsCalls[listingsCalls.length - 1][1]?.signal;
    expect(sig1).toBeDefined();
    expect(sig2).toBeDefined();
    // Each search MUST carry its own AbortSignal instance
    expect(sig1).not.toBe(sig2);

    // Clean up the pending promise
    if (resolveListings) {
      (resolveListings as (v: unknown) => void)({ rows: SAMPLE_LISTINGS, nextCursor: null });
    }
    await settle();
  });

  // Test 11 (pagination)
  test('onEndReached fires next searchListings with cursor from previous nextCursor', async () => {
    const tree = await mount();
    await switchToListingsTab(tree);

    const callsBefore = (ModerationService.searchListings as jest.Mock).mock.calls.length;

    // Find the FlatList for listings (the body for listings tab)
    const list = tree.root
      .findAllByType(FlatList)
      .find((n) => Array.isArray(n.props.data) && n.props.data.length > 0 && n.props.data[0]?._id);
    expect(list).toBeDefined();

    act(() => {
      list!.props.onEndReached();
    });
    await settle();

    const calls = (ModerationService.searchListings as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(callsBefore);
    expect(calls[calls.length - 1][0].cursor).toBe('cursor_b64');
  });

  // Test 12 (no separate recoverListing route — single-method invariant)
  test('source grep — no recoverListing symbol exists in AdminModerationScreen.tsx or ModerationService.ts', () => {
    const screenSrc = fs.readFileSync(
      path.resolve(__dirname, '../AdminModerationScreen.tsx'),
      'utf8',
    );
    const serviceSrc = fs.readFileSync(
      path.resolve(__dirname, '../../services/moderation/ModerationService.ts'),
      'utf8',
    );
    expect(/\brecoverListing\b/.test(screenSrc)).toBe(false);
    expect(/\brecoverListing\b/.test(serviceSrc)).toBe(false);
  });

  // Test 13 (existing user tab regression-lock)
  test('Users tab body still renders + fires searchUsers on mount (no regression on existing surface)', async () => {
    const tree = await mount();
    expect((ModerationService.searchUsers as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);

    // Users tab is active by default; the user-row "Actions for ..." button is present
    const actionsButton = tree.root
      .findAllByType(TouchableOpacity)
      .find(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.includes('Actions for'),
      );
    expect(actionsButton).toBeDefined();
  });
});

// Helper imports kept at the bottom so the test file declarations stay
// adjacent to their first use.
export { TextInput };
