// Phase 11 Plan 11-03 — Screen-integration tests for CarDetailsScreen
// ListingStatusBanner mount + 4-CTA disable predicate + 409 banner-state flip.
//
// Locks (per 11-03-PLAN.md):
//  LBUY-01: non-admin + suspended → ListingStatusBanner mounted with variant="detail"
//  LBUY-01: non-admin + active     → ListingStatusBanner NOT mounted
//  LBUY-01: non-admin + deleted    → ListingStatusBanner with destructive severity (NOT 404+empty)
//  LBUY-01: admin path (isAdmin=true) → Phase 10 admin-status-banner, ListingStatusBanner NOT mounted
//  LBUY-01: 4 buyer CTAs (Telegram, WhatsApp, Book it, Get services) disabled when non-active
//  LBUY-04: severity tone (warning/neutral/destructive) propagates through bannerHints prop
//  LBUY-01: true 404 (apiClient reject) renders existing carNotFound empty-state; NO ListingStatusBanner

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import {
  F1_active,
  F2_suspendedSpam,
  F3_archivedInactiveSeller,
  F4_deletedPolicyViolation,
  F8_adminViewingF2,
} from '../../../__tests__/_fixtures/listingStatusFixtures';

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

// auth — defaults to NON-ADMIN buyer per LBUY-01 viewer (analog defaults to admin)
// Name prefixed with `mock` so babel-plugin-jest-hoist allows out-of-scope reference inside jest.mock().
let mockAuthState: { user: { localId: string } | null; isAdmin: boolean } = {
  user: { localId: 'buyer-1' },
  isAdmin: false,
};
const setMockAuth = (next: typeof mockAuthState) => {
  mockAuthState = next;
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Stable Proxy mock so callback references don't rotate (Plan 05-10 lesson)
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

// Cart context
const mockSetCar = jest.fn();
jest.mock('../../context/CartContext', () => ({
  useCart: () => ({ setCar: mockSetCar }),
}));

// Stripe
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

// Navigation — provide useNavigation + useRoute. useFocusEffect is also stubbed
// so the ListingStatusBanner's collapse-on-blur hook runs synchronously.
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
  useFocusEffect: (_cb: any) => {
    // Run the setup once but don't auto-fire cleanup — keeps state stable for
    // assertion phase. Matches the analog mock pattern from
    // __tests__/components/moderation/UserStatusBanner.test.tsx.
  },
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

// Silence Alert.alert so booking-warning / payment-failed alerts don't crash tests
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// ---- Imports (after mocks) ----

import { CarDetailsScreen } from '../CarDetailsScreen';
import { ListingStatusBanner } from '../../components/moderation/ListingStatusBanner';

// ---- Fixtures — derived from F1..F8 to satisfy CarDetailsScreen field expectations ----
// CarDetailsScreen reads make/model/year/price/mileage/fuel from `car` (not just
// `status`); the thin-payload fixtures don't carry those — extend them here for
// render correctness without polluting the shared fixture module.

const BASE_CAR_FIELDS = {
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
  telegramUsername: 'sellerHandle',
  phoneNumber: '+1234567890',
  listingStatus: 'active' as const,
  bodyType: 'Sedan',
  transmission: 'Automatic',
  drivetrain: 'FWD',
  condition: 'Used',
  exteriorColor: 'Silver',
  interiorColor: 'Black',
  interiorMaterial: 'Cloth',
  seats: 5,
  doors: 4,
};

const F1_carPayload = { ...BASE_CAR_FIELDS, ...F1_active };
const F2_carPayload = { ...BASE_CAR_FIELDS, ...F2_suspendedSpam };
const F3_carPayload = { ...BASE_CAR_FIELDS, ...F3_archivedInactiveSeller };
const F4_carPayload = { ...BASE_CAR_FIELDS, ...F4_deletedPolicyViolation };
const F8_carPayload = { ...BASE_CAR_FIELDS, ...F8_adminViewingF2 };

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

function findAllByTestID(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAllByProps({ testID });
}

// ---- Tests ----

describe('LBUY-01: CarDetailsScreen mounts ListingStatusBanner for non-admin viewer of non-active listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({ user: { localId: 'buyer-1' }, isAdmin: false });
    setMockRouteParams({ carId: 'car_abc' });
    mockCanGoBack.mockReturnValue(true);
  });

  test('non-admin + F2 (suspended) → testID "listing-status-banner" renders', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    expect(findAllByTestID(tree.root, 'listing-status-banner').length).toBeGreaterThan(0);
  });

  test('non-admin + F1 (active) → testID "listing-status-banner" NOT present', async () => {
    mockApiGet.mockResolvedValue({ data: F1_carPayload });
    const tree = await mount();
    expect(findAllByTestID(tree.root, 'listing-status-banner').length).toBe(0);
  });

  test('non-admin + F4 (deleted) → testID "listing-status-banner" PRESENT with destructive severity (D-03 amended)', async () => {
    mockApiGet.mockResolvedValue({ data: F4_carPayload });
    const tree = await mount();
    const banners = findAllByTestID(tree.root, 'listing-status-banner');
    expect(banners.length).toBeGreaterThan(0);
    // Destructive severity propagated via bannerHints prop
    const banner = tree.root.findByType(ListingStatusBanner);
    expect(banner.props.bannerHints.severity).toBe('destructive');
    expect(banner.props.status).toBe('deleted');
  });

  test('admin + F8 (suspended admin payload) → "admin-status-banner" present, "listing-status-banner" NOT (mutual exclusion)', async () => {
    setMockAuth({ user: { localId: 'admin-1' }, isAdmin: true });
    mockApiGet.mockResolvedValue({ data: F8_carPayload });
    const tree = await mount();
    expect(findAllByTestID(tree.root, 'admin-status-banner').length).toBeGreaterThan(0);
    expect(findAllByTestID(tree.root, 'listing-status-banner').length).toBe(0);
  });
});

describe('LBUY-01: Telegram + WhatsApp + Book it + Get services CTAs disabled when listing non-active', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({ user: { localId: 'buyer-1' }, isAdmin: false });
    setMockRouteParams({ carId: 'car_abc' });
    mockCanGoBack.mockReturnValue(true);
  });

  test('car-details-telegram-cta disabled with opacity 0.4 when F2 (suspended)', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    const cta = findAllByTestID(tree.root, 'car-details-telegram-cta')[0];
    expect(cta).toBeDefined();
    expect(cta.props.disabled).toBe(true);
    const flatStyle = Array.isArray(cta.props.style)
      ? Object.assign({}, ...cta.props.style.filter(Boolean))
      : cta.props.style;
    expect(flatStyle.opacity).toBe(0.4);
    expect(cta.props.accessibilityState?.disabled).toBe(true);
  });

  test('car-details-whatsapp-cta disabled with opacity 0.4 when F2 (suspended)', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    const cta = findAllByTestID(tree.root, 'car-details-whatsapp-cta')[0];
    expect(cta).toBeDefined();
    expect(cta.props.disabled).toBe(true);
    const flatStyle = Array.isArray(cta.props.style)
      ? Object.assign({}, ...cta.props.style.filter(Boolean))
      : cta.props.style;
    expect(flatStyle.opacity).toBe(0.4);
    expect(cta.props.accessibilityState?.disabled).toBe(true);
  });

  test('car-details-book-it-cta disabled with opacity 0.4 when F2 (suspended)', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    const cta = findAllByTestID(tree.root, 'car-details-book-it-cta')[0];
    expect(cta).toBeDefined();
    expect(cta.props.disabled).toBe(true);
    const flatStyle = Array.isArray(cta.props.style)
      ? Object.assign({}, ...cta.props.style.filter(Boolean))
      : cta.props.style;
    expect(flatStyle.opacity).toBe(0.4);
  });

  test('car-details-get-services-cta disabled with opacity 0.4 when F2 (suspended)', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    const cta = findAllByTestID(tree.root, 'car-details-get-services-cta')[0];
    expect(cta).toBeDefined();
    expect(cta.props.disabled).toBe(true);
    const flatStyle = Array.isArray(cta.props.style)
      ? Object.assign({}, ...cta.props.style.filter(Boolean))
      : cta.props.style;
    expect(flatStyle.opacity).toBe(0.4);
  });

  test('baseline: F1 (active) → CTAs NOT disabled (sanity check)', async () => {
    mockApiGet.mockResolvedValue({ data: F1_carPayload });
    const tree = await mount();
    const telegramCta = findAllByTestID(tree.root, 'car-details-telegram-cta')[0];
    const whatsappCta = findAllByTestID(tree.root, 'car-details-whatsapp-cta')[0];
    const bookItCta = findAllByTestID(tree.root, 'car-details-book-it-cta')[0];
    const getServicesCta = findAllByTestID(tree.root, 'car-details-get-services-cta')[0];
    // disabled MAY be false or undefined depending on other gating; the
    // key assertion is that the isListingNonActive predicate does NOT trigger.
    expect(telegramCta.props.disabled).toBe(false);
    expect(whatsappCta.props.disabled).toBe(false);
    // Book it has its own listingStatus==='booked' branch; for an active+non-booked
    // listing the disabled state is `bookingLoading || listingStatus==='booked'` → false
    expect(bookItCta.props.disabled).toBe(false);
    // Get-services has no other gate, so it should be falsy
    expect(getServicesCta.props.disabled).toBeFalsy();
  });
});

describe('LBUY-04: severity tone propagates from screen-level fetchedCar to ListingStatusBanner bannerHints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({ user: { localId: 'buyer-1' }, isAdmin: false });
    setMockRouteParams({ carId: 'car_abc' });
    mockCanGoBack.mockReturnValue(true);
  });

  test('F2 → bannerHints.severity = "warning"', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    const banner = tree.root.findByType(ListingStatusBanner);
    expect(banner.props.bannerHints.severity).toBe('warning');
  });

  test('F3 → bannerHints.severity = "neutral"', async () => {
    mockApiGet.mockResolvedValue({ data: F3_carPayload });
    const tree = await mount();
    const banner = tree.root.findByType(ListingStatusBanner);
    expect(banner.props.bannerHints.severity).toBe('neutral');
  });

  test('F4 → bannerHints.severity = "destructive"', async () => {
    mockApiGet.mockResolvedValue({ data: F4_carPayload });
    const tree = await mount();
    const banner = tree.root.findByType(ListingStatusBanner);
    expect(banner.props.bannerHints.severity).toBe('destructive');
  });

  test('variant="detail" passed by CarDetailsScreen (not cartRow)', async () => {
    mockApiGet.mockResolvedValue({ data: F2_carPayload });
    const tree = await mount();
    const banner = tree.root.findByType(ListingStatusBanner);
    expect(banner.props.variant).toBe('detail');
  });
});

describe('LBUY-01: existing empty-state at CarDetailsScreen.tsx:214-224 still handles true 404 (carId not found)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({ user: { localId: 'buyer-1' }, isAdmin: false });
    // Use a carId NOT in CARS mock so the screen depends entirely on the API
    setMockRouteParams({ carId: 'car_does_not_exist' });
    mockCanGoBack.mockReturnValue(true);
  });

  test('apiClient.get rejects → existing carNotFound empty-state branch, NO ListingStatusBanner', async () => {
    mockApiGet.mockRejectedValue({ response: { status: 404 } });
    const tree = await mount();
    // Pre-existing empty-state branch (lines 214-224) renders an error container
    // with t.carNotFound. The Proxy mock returns the key name as the value.
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('carNotFound');
    // No ListingStatusBanner — true 404 is reserved for the empty-state path
    expect(findAllByTestID(tree.root, 'listing-status-banner').length).toBe(0);
  });
});
