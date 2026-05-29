// Phase 10 Plan 08 — RED tests for CarDetailsScreen admin moderation surface.
//
// Locks (per 10-08-PLAN.md):
//  T1  Admin badge gate (isAdmin=false → null; isAdmin=true → renders)
//  T2  D-02 unconditional badge — admin viewing own listing STILL sees the badge
//  T3  Badge tap opens bottom sheet (testID="listing-sheet-overlay")
//  T4  D-17 status banner — renders status + reasonCategory + reason + setBy
//  T5  Active listing — no status banner; bottom sheet shows 4 actions (no Restore)
//  T6  D-16 optimistic suspend flip — immediate status flip + service call + sheet close
//  T7  D-16 rollback on error (already_in_state) — badge reverts + inline banner + NO Alert
//  T8  D-15 cannot_moderate_own_listing → INLINE banner, NO Alert
//  T9  D-15 listing_not_found → Alert.alert + navigation.goBack()
//  T10 D-07 Delete two-modal stack — reason modal stays + typed-confirm overlays w/ keyboardType="default"
//  T11 LUI-03 Restore flow — non-active listing → Restore button → ListingRestoreModal → restoreListing call
//  T12 Edit action routes to navigation.navigate('SellCar', { carId, adminEdit: true })
//  T13 Pitfall 6 single-source-of-truth — buildListingTitle(fetchedCar) used; no inline template

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity, Alert } from 'react-native';
import * as fs from 'fs';
import * as path from 'path';

// ---- Mock setup (must precede component import) ----

jest.mock('../../services/moderation/ModerationService', () => ({
  ModerationService: {
    adminEditListing: jest.fn(),
    suspendListing: jest.fn(),
    archiveListing: jest.fn(),
    deleteListing: jest.fn(),
    restoreListing: jest.fn(),
    searchListings: jest.fn(),
  },
}));

// auth — variants are injected per-test via setMockAuth()
// Name prefixed with `mock` so babel-plugin-jest-hoist allows out-of-scope reference inside jest.mock().
let mockAuthState: { user: { localId: string } | null; isAdmin: boolean } = {
  user: { localId: 'admin-1' },
  isAdmin: true,
};
const setMockAuth = (next: typeof mockAuthState) => {
  mockAuthState = next;
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Stable Proxy mock so callback references don't rotate
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

// Cart context (CarDetailsScreen uses useCart)
const mockSetCar = jest.fn();
jest.mock('../../context/CartContext', () => ({
  useCart: () => ({ setCar: mockSetCar }),
}));

// Stripe — module is imported at the top of CarDetailsScreen
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Typography hook
jest.mock('../../hooks/useTypography', () => ({
  useTypography: () => ({ display: 'System', mono: 'System' }),
}));

// Safe area insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Image zoom (native dep)
jest.mock('@likashefqet/react-native-image-zoom', () => ({
  Zoomable: ({ children }: { children: React.ReactNode }) => children,
}));

// OptimizedImage component
jest.mock('../../components/OptimizedImage', () => ({
  OptimizedImage: () => null,
}));

// Navigation — provide useNavigation + useRoute
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
let mockRouteParams: any = { carId: 'car_abc' };
const setMockRouteParams = (next: any) => {
  mockRouteParams = next;
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// apiClient — canned response for GET /api/cars/:id
const mockApiGet = jest.fn();
jest.mock('../../services/http/client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// AuthService — stub used by misc calls in CarDetails
jest.mock('../../services/AuthService', () => ({
  AuthService: {
    createPaymentIntent: jest.fn(),
    confirmBooking: jest.fn(),
  },
}));

// axios — used for seller-profile fetch only; stub so it doesn't crash
jest.mock('axios', () => {
  const mockAxios: any = {
    get: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    isCancel: jest.fn().mockReturnValue(false),
  };
  return { __esModule: true, default: mockAxios, ...mockAxios };
});

// AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Silence Alert.alert spy
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// ---- Imports (after mocks) ----

import { ModerationService } from '../../services/moderation/ModerationService';
import { ListingModerationError } from '../../services/moderation/errors';
import { CarDetailsScreen } from '../CarDetailsScreen';
import { ListingModerationBottomSheet } from '../../components/moderation/ListingModerationBottomSheet';
import { ListingModerationReasonModal } from '../../components/moderation/ListingModerationReasonModal';
import { ListingRestoreModal } from '../../components/moderation/ListingRestoreModal';
import { TypedConfirmationModal } from '../../components/moderation/TypedConfirmationModal';

// ---- Fixtures ----

const FIXTURE_ACTIVE_CAR = {
  id: 'car_abc',
  _id: 'car_abc',
  makeId: 'toyota',
  modelId: 'camry',
  makeName: 'Toyota',
  modelName: 'Camry',
  make: 'Toyota',
  model: 'Camry',
  year: 2018,
  price: 15000,
  mileage: 45000,
  fuel: 'Petrol',
  currency: '$',
  imageUrls: ['https://example.com/img1.jpg'],
  sellerId: 'seller-99',
  listingStatus: 'active',
  bodyType: 'Sedan',
  transmission: 'Automatic',
  drivetrain: 'FWD',
  condition: 'Used',
  exteriorColor: 'Silver',
  interiorColor: 'Black',
  interiorMaterial: 'Cloth',
  seats: 5,
  doors: 4,
  // moderationBadge ABSENT → active listing
};

const FIXTURE_SUSPENDED_BADGE = {
  status: 'suspended' as const,
  reasonCategory: 'spam',
  moderationReason: 'duplicate listing',
  moderatedBy: 'admin_xyz',
  moderatedAt: '2026-05-29T12:00:00Z',
  banner: { titleKey: 'k', bodyKey: 'b', severity: 'warning' as const },
};

const FIXTURE_ARCHIVED_BADGE = {
  status: 'archived' as const,
  reasonCategory: 'inactive_seller',
  moderationReason: 'no activity 90d',
  moderatedBy: 'admin_xyz',
  moderatedAt: '2026-05-29T12:00:00Z',
  banner: { titleKey: 'k', bodyKey: 'b', severity: 'neutral' as const },
};

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
    tree = TestRenderer.create(<CarDetailsScreen />);
  });
  await settle();
  return tree!;
}

function findByTestID(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAllByProps({ testID }).find((n) => typeof n.type !== 'string' || true);
}

function findAllByTestID(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAllByProps({ testID });
}

// ---- Tests ----

describe('CarDetailsScreen — admin moderation surface (Plan 10-08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({ user: { localId: 'admin-1' }, isAdmin: true });
    setMockRouteParams({ carId: 'car_abc' });
    mockApiGet.mockResolvedValue({ data: FIXTURE_ACTIVE_CAR });
    mockCanGoBack.mockReturnValue(true);
  });

  test('T1 admin badge gate — renders with isAdmin=true, missing when isAdmin=false', async () => {
    // isAdmin=false → no badge
    setMockAuth({ user: { localId: 'buyer-1' }, isAdmin: false });
    const treeNonAdmin = await mount();
    expect(findAllByTestID(treeNonAdmin.root, 'moderate-badge').length).toBe(0);

    // isAdmin=true → badge renders
    setMockAuth({ user: { localId: 'admin-1' }, isAdmin: true });
    const treeAdmin = await mount();
    expect(findAllByTestID(treeAdmin.root, 'moderate-badge').length).toBeGreaterThan(0);
  });

  test('T2 D-02 unconditional badge — admin viewing their OWN listing still sees the badge', async () => {
    // admin viewing own listing: user.localId === sellerId
    setMockAuth({ user: { localId: 'seller-99' }, isAdmin: true });
    const tree = await mount();
    expect(findAllByTestID(tree.root, 'moderate-badge').length).toBeGreaterThan(0);
  });

  test('T3 badge tap opens the bottom sheet (listing-sheet-overlay renders)', async () => {
    const tree = await mount();
    const badge = findAllByTestID(tree.root, 'moderate-badge')[0];
    expect(badge).toBeDefined();
    act(() => {
      badge.props.onPress();
    });
    // Bottom sheet is mounted with visible=true → overlay renders
    expect(findAllByTestID(tree.root, 'listing-sheet-overlay').length).toBeGreaterThan(0);
  });

  test('T4 D-17 status banner renders status/reasonCategory/reason/setBy from moderationBadge', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...FIXTURE_ACTIVE_CAR, moderationBadge: FIXTURE_SUSPENDED_BADGE },
    });
    const tree = await mount();
    const banner = findAllByTestID(tree.root, 'admin-status-banner')[0];
    expect(banner).toBeDefined();
    // Snapshot the rendered tree's text descendants; assert substrings
    const renderedJson = JSON.stringify(tree.toJSON());
    expect(renderedJson).toContain('suspended');
    expect(renderedJson).toContain('spam');
    expect(renderedJson).toContain('duplicate listing');
    expect(renderedJson).toContain('admin_xyz');
  });

  test('T5 active listing — no status banner; bottom sheet shows 4 actions (no Restore)', async () => {
    const tree = await mount();
    expect(findAllByTestID(tree.root, 'admin-status-banner').length).toBe(0);
    // Open the sheet
    const badge = findAllByTestID(tree.root, 'moderate-badge')[0];
    act(() => {
      badge.props.onPress();
    });
    // 4 action rows present
    expect(findAllByTestID(tree.root, 'listing-action-edit').length).toBeGreaterThan(0);
    expect(findAllByTestID(tree.root, 'listing-action-suspend').length).toBeGreaterThan(0);
    expect(findAllByTestID(tree.root, 'listing-action-archive').length).toBeGreaterThan(0);
    expect(findAllByTestID(tree.root, 'listing-action-delete').length).toBeGreaterThan(0);
    // Restore action NOT present
    expect(findAllByTestID(tree.root, 'listing-action-restore').length).toBe(0);
  });

  test('T6 D-16 optimistic suspend flip — immediate status flip + service call + sheet close', async () => {
    (ModerationService.suspendListing as jest.Mock).mockResolvedValue({
      ok: true,
      listing: {
        _id: 'car_abc',
        status: 'suspended',
        moderatedBy: 'admin-1',
        moderatedAt: '2026-05-29T13:00:00Z',
      },
      action: { _id: 'a1', action: 'suspend', fromStatus: 'active', toStatus: 'suspended', createdAt: '2026-05-29T13:00:00Z' },
    });
    const tree = await mount();
    const badge = findAllByTestID(tree.root, 'moderate-badge')[0];
    act(() => {
      badge.props.onPress();
    });
    // Tap Suspend → reason modal opens
    const suspendRow = findAllByTestID(tree.root, 'listing-action-suspend')[0];
    act(() => {
      suspendRow.props.onPress();
    });
    // Find ListingModerationReasonModal and emit submit
    const reasonModal = tree.root.findByType(ListingModerationReasonModal);
    act(() => {
      reasonModal.props.onSubmit({ reasonCategory: 'spam' });
    });
    await settle();
    // Service called with correct args
    expect(ModerationService.suspendListing).toHaveBeenCalledWith('car_abc', { reasonCategory: 'spam' });
    // Sheet overlay should no longer be rendered (visible=false)
    const sheet = tree.root.findByType(ListingModerationBottomSheet);
    expect(sheet.props.visible).toBe(false);
  });

  test('T7 D-16 rollback on error — already_in_state surfaces inline banner; NO Alert', async () => {
    const err = new ListingModerationError(
      'already_in_state',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      400,
    );
    (ModerationService.suspendListing as jest.Mock).mockRejectedValue(err);
    const tree = await mount();
    alertSpy.mockClear();
    act(() => {
      findAllByTestID(tree.root, 'moderate-badge')[0].props.onPress();
    });
    act(() => {
      findAllByTestID(tree.root, 'listing-action-suspend')[0].props.onPress();
    });
    const reasonModal = tree.root.findByType(ListingModerationReasonModal);
    act(() => {
      reasonModal.props.onSubmit({ reasonCategory: 'spam' });
    });
    await settle();
    // Inline error banner present
    expect(findAllByTestID(tree.root, 'admin-error-banner').length).toBeGreaterThan(0);
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('already_in_state');
    // No Alert raised for inline-banner error codes
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('T8 D-15 cannot_moderate_own_listing → INLINE banner, NO Alert', async () => {
    const err = new ListingModerationError(
      'cannot_moderate_own_listing',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      403,
    );
    (ModerationService.suspendListing as jest.Mock).mockRejectedValue(err);
    const tree = await mount();
    alertSpy.mockClear();
    act(() => {
      findAllByTestID(tree.root, 'moderate-badge')[0].props.onPress();
    });
    act(() => {
      findAllByTestID(tree.root, 'listing-action-suspend')[0].props.onPress();
    });
    act(() => {
      tree.root.findByType(ListingModerationReasonModal).props.onSubmit({ reasonCategory: 'spam' });
    });
    await settle();
    expect(findAllByTestID(tree.root, 'admin-error-banner').length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('cannot_moderate_own_listing');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('T9 D-15 listing_not_found → Alert.alert + navigation.goBack', async () => {
    const err = new ListingModerationError(
      'listing_not_found',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      404,
    );
    (ModerationService.suspendListing as jest.Mock).mockRejectedValue(err);
    const tree = await mount();
    alertSpy.mockClear();
    mockGoBack.mockClear();
    act(() => {
      findAllByTestID(tree.root, 'moderate-badge')[0].props.onPress();
    });
    act(() => {
      findAllByTestID(tree.root, 'listing-action-suspend')[0].props.onPress();
    });
    act(() => {
      tree.root.findByType(ListingModerationReasonModal).props.onSubmit({ reasonCategory: 'spam' });
    });
    await settle();
    expect(alertSpy).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('T10 D-07 Delete two-modal stack — reason modal stays, typed-confirm overlays w/ keyboardType="default"', async () => {
    (ModerationService.deleteListing as jest.Mock).mockResolvedValue({
      ok: true,
      listing: { _id: 'car_abc', status: 'deleted' },
      action: { _id: 'a1', action: 'delete', fromStatus: 'active', toStatus: 'deleted', createdAt: 'now' },
    });
    const tree = await mount();
    act(() => {
      findAllByTestID(tree.root, 'moderate-badge')[0].props.onPress();
    });
    act(() => {
      findAllByTestID(tree.root, 'listing-action-delete')[0].props.onPress();
    });
    // Reason modal opens; submit with reasonCategory='fraud'
    const reasonModal = tree.root.findByType(ListingModerationReasonModal);
    act(() => {
      reasonModal.props.onSubmit({ reasonCategory: 'fraud' });
    });
    await settle();
    // Typed confirmation modal now mounted
    const typed = tree.root.findByType(TypedConfirmationModal);
    expect(typed.props.visible).toBe(true);
    expect(typed.props.keyboardType).toBe('default');
    expect(typed.props.targetEmail).toBe('2018 Toyota Camry');
    // Service NOT yet called (gate is the typed-confirm match)
    expect(ModerationService.deleteListing).not.toHaveBeenCalled();
    // Trigger onConfirm directly (UI sentinel match is tested separately by TypedConfirmationModal)
    act(() => {
      typed.props.onConfirm();
    });
    await settle();
    expect(ModerationService.deleteListing).toHaveBeenCalledWith('car_abc', { reasonCategory: 'fraud' });
  });

  test('T11 LUI-03 Restore flow — non-active listing → Restore button → ListingRestoreModal → restoreListing call', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...FIXTURE_ACTIVE_CAR, moderationBadge: FIXTURE_ARCHIVED_BADGE },
    });
    (ModerationService.restoreListing as jest.Mock).mockResolvedValue({
      ok: true,
      listing: { _id: 'car_abc', status: 'active' },
      action: { _id: 'a1', action: 'restore', fromStatus: 'archived', toStatus: 'active', createdAt: 'now' },
    });
    const tree = await mount();
    act(() => {
      findAllByTestID(tree.root, 'moderate-badge')[0].props.onPress();
    });
    // Restore row present; 4-action rows NOT present
    expect(findAllByTestID(tree.root, 'listing-action-restore').length).toBeGreaterThan(0);
    expect(findAllByTestID(tree.root, 'listing-action-edit').length).toBe(0);
    act(() => {
      findAllByTestID(tree.root, 'listing-action-restore')[0].props.onPress();
    });
    // Restore modal renders; submit with note
    const restoreModal = tree.root.findByType(ListingRestoreModal);
    expect(restoreModal.props.visible).toBe(true);
    act(() => {
      restoreModal.props.onSubmit({ note: 'post-appeal' });
    });
    await settle();
    expect(ModerationService.restoreListing).toHaveBeenCalledWith('car_abc', { note: 'post-appeal' });
  });

  test('T12 Edit action routes to SellCar with adminEdit flag', async () => {
    const tree = await mount();
    act(() => {
      findAllByTestID(tree.root, 'moderate-badge')[0].props.onPress();
    });
    act(() => {
      findAllByTestID(tree.root, 'listing-action-edit')[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('SellCar', {
      carId: 'car_abc',
      adminEdit: true,
    });
  });

  test('T13 Pitfall 6 — buildListingTitle(fetchedCar) is single source of truth (no inline year/make/model template)', () => {
    const filePath = path.resolve(__dirname, '../CarDetailsScreen.tsx');
    const source = fs.readFileSync(filePath, 'utf8');
    // Must reference buildListingTitle somewhere (sheet header listingTitle + typed-confirm targetEmail derive from it)
    expect(source).toMatch(/buildListingTitle\(/);
    // Must NOT have inlined ${year} ${make} ${model} template-literal for the title
    expect(source).not.toMatch(/\$\{.*\.year.*\.make.*\.model\}/);
  });
});
