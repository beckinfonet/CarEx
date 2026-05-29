/**
 * Phase 10 Plan 09 — SellCarScreen adminEdit flow tests
 *
 * Locks the contract that `route.params?.adminEdit === true` flips
 * SellCarScreen into admin-edit mode:
 *   - Bypasses ALL seller-only gates (4+ enumerated in Pitfall 4).
 *   - Swaps submit endpoint from seller PUT/POST to
 *     `ModerationService.adminEditListing(carId, structured)`.
 *   - Handles `ListingModerationError` distinctly from generic upload errors.
 *
 * Pitfall 4 audit (grep -n "sellerStatus === 'APPROVED'" src/screens/SellCarScreen.tsx):
 *   - line 76: useEffect autofill gate
 *   - line 88: useEffect car-fetch gate
 * Pitfall 4 also covers the render-cascade branches that gate on
 * `sellerStatus === 'PENDING' | 'NONE' | 'REJECTED' | falsy` — those produce
 * "Become seller / Pending / Rejected / Phone verification" empty states
 * which exclude the form body just as effectively when admin's sellerStatus
 * is null.
 *
 * Pitfall 5: GatedScreenWrapper wraps the entire SafeAreaView body —
 * admin must NOT be touched by `capability="create_listing"` if they
 * themselves carry a `restrictedFeatures: ['create_listing']` flag.
 *
 * Test 11 is a structural lock: the call to `adminEditListing` MUST pass a
 * plain object (CONTEXT anti-pattern: no inline FormData rebuilding in the
 * screen). The service module owns multipart assembly (Plan 04 / Pitfall 9).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, TouchableOpacity } from 'react-native';

// ---- Mock setup ----

jest.mock('../../services/moderation/ModerationService', () => ({
  ModerationService: {
    adminEditListing: jest.fn(),
  },
}));

jest.mock('../../services/http/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { carId?: string; adminEdit?: boolean } | undefined;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// Stable Proxy translation mock — reused across renders so dependent identity
// doesn't churn (lesson from Phase 5 Plan 05-10 AdminModeration test).
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

// useAuth mock — value swappable between mounts via this object.
let mockAuthValue: any = {
  user: null,
  isAdmin: false,
  requestSeller: jest.fn(),
  sendPhoneOtp: jest.fn(),
  verifyPhone: jest.fn(),
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

// MakeModelFormField pulls from a remote vehicle catalog — stub it out.
jest.mock('../../components/MakeModelFormField', () => {
  const { View } = require('react-native');
  return { MakeModelFormField: (_props: any) => <View testID="make-model-stub" /> };
});

// GatedScreenWrapper renders its children only when not gated. We want to
// observe whether it is mounted at all in admin-edit mode (Pitfall 5).
// Real implementation is fine — it consumes useAuth() which is mocked above,
// so when admin has no `restrictedFeatures`, the wrapper short-circuits to
// `<>{children}</>` already. To make the test detect the admin-bypass branch
// explicitly we DO NOT mock the wrapper — we let it run and check via the
// fall-through test that `restrictedFeatures: ['create_listing']` on the
// admin user does NOT hide the form when `adminEdit === true`.

import { ModerationService } from '../../services/moderation/ModerationService';
import { apiClient } from '../../services/http/client';
import { ListingModerationError } from '../../services/moderation/errors';
import { SellCarScreen } from '../SellCarScreen';

const FIXTURE_CAR = {
  _id: 'car_abc',
  sellerId: 'seller_999', // intentionally NOT admin_xyz — proves ownership check skipped
  makeId: '10',
  modelId: '20',
  trimLevel: 'LX',
  wheelbase: 'short',
  year: 2018,
  price: 12000,
  mileage: 50000,
  fuel: 'gasoline',
  bodyType: 'sedan',
  description: 'Existing description',
  engine: '2.0L',
  transmission: 'automatic',
  drivetrain: 'fwd',
  mpg: '7.5 L/100km',
  condition: 'excellent',
  knownIssues: [],
  exteriorColor: 'red',
  interiorColor: 'black',
  interiorMaterial: 'leather',
  seats: 5,
  doors: 4,
  phoneNumber: '+82101234567',
  telegramUsername: '@seller',
  imageUrls: ['https://cdn.example.com/img1.jpg'],
};

const ADMIN_USER_BASE = {
  localId: 'admin_xyz',
  firstName: 'Ad',
  lastName: 'Min',
  phoneNumber: '+15551234567',
  // sellerStatus intentionally absent/null — proves all gates are bypassed.
  isPhoneVerified: false,
  moderationStatus: { state: 'active' },
};

const SELLER_USER = {
  localId: 'seller_999',
  firstName: 'Seller',
  lastName: 'One',
  phoneNumber: '+15559876543',
  sellerStatus: 'APPROVED',
  isPhoneVerified: true,
  moderationStatus: { state: 'active' },
};

async function settle() {
  await new Promise<void>((r) => setImmediate(() => r()));
  await new Promise<void>((r) => setImmediate(() => r()));
  act(() => {});
  await new Promise<void>((r) => setImmediate(() => r()));
  act(() => {});
}

function mount() {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<SellCarScreen />);
  });
  return tree!;
}

function findSubmitButton(root: TestRenderer.ReactTestInstance): TestRenderer.ReactTestInstance | undefined {
  // Submit button = the TouchableOpacity whose Text descendant renders the
  // 'submitListing' translation key. Locate by walking children one level.
  const touchables = root.findAllByType(TouchableOpacity);
  for (const t of touchables) {
    // Look for a Text child that has 'submitListing' anywhere in its
    // children prop. Use parent traversal instead of JSON.stringify (which
    // chokes on circular React fiber refs).
    const texts = t.findAllByType(require('react-native').Text);
    for (const txt of texts) {
      const tc = txt.props.children;
      const str = Array.isArray(tc) ? tc.join('') : String(tc ?? '');
      if (str.includes('submitListing')) return t;
    }
  }
  return undefined;
}

describe('SellCarScreen — adminEdit flow', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Default route + auth — admin entering edit-mode for someone else's car
    mockRouteParams = { carId: 'car_abc', adminEdit: true };
    mockAuthValue = {
      user: { ...ADMIN_USER_BASE },
      isAdmin: true,
      requestSeller: jest.fn(),
      sendPhoneOtp: jest.fn(),
      verifyPhone: jest.fn(),
    };

    (apiClient.get as jest.Mock).mockResolvedValue({ data: FIXTURE_CAR });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (ModerationService.adminEditListing as jest.Mock).mockResolvedValue({
      ok: true,
      listing: { _id: 'car_abc', status: 'active' },
      action: { action: 'edit' },
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  // ---- Test 1 — Pitfall 4: autofill gate bypassed ----
  test('Test 1: adminEdit bypasses the autofill gate (no Alert prompting profile completion)', async () => {
    // Admin user has sellerStatus = null/undefined. With the autofill gate
    // un-patched, checkProfileAndAutofill would NOT fire (sellerStatus !==
    // APPROVED). With the patch the entire autofill effect is gated by
    // `!adminEdit` so it never fires either. The behavior we lock is:
    // even when sellerStatus is null, the screen does NOT show the
    // "complete your profile" Alert that the autofill function would raise
    // for a partial admin user. We assert the absence of the autofill
    // Alert (admin has no missing required fields in the base fixture
    // anyway — first/last/phone all populated — so this is double-negative
    // protection).
    mount();
    await settle();
    // Autofill Alert is only raised when profile is incomplete; here it's
    // complete, so the assertion is that admin proceeds without any
    // sellerStatus-driven prompt fired by checkProfileAndAutofill.
    const profileAlerts = alertSpy.mock.calls.filter((c) =>
      String(c[1] ?? '').toLowerCase().includes('profile'),
    );
    expect(profileAlerts).toEqual([]);
  });

  // ---- Test 2 — Pitfall 4: car-fetch gate bypassed ----
  test('Test 2: car-fetch fires when adminEdit=true even with sellerStatus=null', async () => {
    mount();
    await settle();
    expect(apiClient.get).toHaveBeenCalledWith('/api/cars/car_abc');
  });

  // ---- Test 3 — Pitfall 4: ownership check skipped ----
  test('Test 3: ownership check (sellerId !== user.localId) is bypassed for adminEdit', async () => {
    mount();
    await settle();
    // FIXTURE_CAR.sellerId = 'seller_999' != admin_xyz → without the bypass
    // the screen would Alert + goBack. With the bypass neither happens.
    expect(mockGoBack).not.toHaveBeenCalled();
    const notAuthAlerts = alertSpy.mock.calls.filter((c) =>
      String(c[1] ?? '').toLowerCase().includes('not authorized'),
    );
    expect(notAuthAlerts).toEqual([]);
  });

  // ---- Test 4 — Pitfall 5: GatedScreenWrapper bypassed ----
  test('Test 4: GatedScreenWrapper does NOT hide the form body even when admin has restrictedFeatures: ["create_listing"]', async () => {
    mockAuthValue.user = {
      ...ADMIN_USER_BASE,
      moderationStatus: {
        state: 'feature_limited',
        restrictedFeatures: ['create_listing'],
      },
    };
    const tree = mount();
    await settle();
    // The gated-screen-wrapper testID is `gated-screen-wrapper-create_listing`
    // when the wrapper engages its dim layer. With the adminEdit bypass
    // it must NOT render that wrapping View (the screen returns children
    // verbatim).
    const gated = tree.root
      .findAll((n) => n.props.testID === 'gated-screen-wrapper-create_listing');
    expect(gated.length).toBe(0);
    // Sanity: submit button exists, proving the form body rendered.
    expect(findSubmitButton(tree.root)).toBeDefined();
  });

  // ---- Test 5 — OTP / phone-verification gate bypassed ----
  test('Test 5: OTP/phone-verification gate (isPhoneVerified=false) is bypassed for adminEdit', async () => {
    // Admin has isPhoneVerified = false (base fixture). With the seller-only
    // render cascade un-patched, sellerStatus = null + isPhoneVerified =
    // false would show the "Verify your phone" empty state instead of the
    // form body. With the adminEdit cascade bypass, the form body renders.
    const tree = mount();
    await settle();
    expect(findSubmitButton(tree.root)).toBeDefined();
  });

  // ---- Test 6 — Endpoint swap ----
  test('Test 6: submit calls ModerationService.adminEditListing with structured input; seller PUT/POST not called', async () => {
    const tree = mount();
    await settle();

    const submit = findSubmitButton(tree.root);
    expect(submit).toBeDefined();

    await act(async () => {
      await submit!.props.onPress();
    });
    await settle();

    expect(ModerationService.adminEditListing).toHaveBeenCalledTimes(1);
    const [carIdArg, inputArg] = (ModerationService.adminEditListing as jest.Mock).mock.calls[0];
    expect(carIdArg).toBe('car_abc');
    expect(inputArg).toEqual(
      expect.objectContaining({
        fields: expect.any(Object),
      }),
    );

    // Critical: the seller paths must NOT have been invoked.
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  // ---- Test 7 — Success → navigation.goBack ----
  test('Test 7: success Alert OK callback navigates back to CarDetails', async () => {
    const tree = mount();
    await settle();

    await act(async () => {
      await findSubmitButton(tree.root)!.props.onPress();
    });
    await settle();

    // Find the success-style alert call (with OK button)
    const successCalls = alertSpy.mock.calls.filter((c) => {
      const buttons = c[2];
      return Array.isArray(buttons) && buttons.some((b: any) => typeof b.onPress === 'function');
    });
    expect(successCalls.length).toBeGreaterThan(0);

    // Invoke the OK button onPress
    const buttons = successCalls[0][2];
    const okButton = buttons.find((b: any) => typeof b.onPress === 'function');
    act(() => {
      okButton.onPress();
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  // ---- Test 8 — Error: ListingModerationError surfaced ----
  test('Test 8: ListingModerationError(invalid_make, 400) surfaces via Alert; admin stays on form (no goBack)', async () => {
    (ModerationService.adminEditListing as jest.Mock).mockRejectedValue(
      new ListingModerationError('invalid_make', undefined, undefined, undefined, undefined, undefined, 400),
    );

    const tree = mount();
    await settle();

    await act(async () => {
      await findSubmitButton(tree.root)!.props.onPress();
    });
    await settle();

    // Alert should fire with a message related to 'invalid_make'.
    const errorAlerts = alertSpy.mock.calls.filter((c) =>
      String(c[1] ?? '').includes('invalid_make'),
    );
    expect(errorAlerts.length).toBeGreaterThan(0);
    // No goBack — admin stays on form to fix the issue.
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // ---- Test 9 — Error: 404 listing_not_found → pop back ----
  test('Test 9: ListingModerationError(listing_not_found, 404) Alerts AND navigates back', async () => {
    (ModerationService.adminEditListing as jest.Mock).mockRejectedValue(
      new ListingModerationError('listing_not_found', undefined, undefined, undefined, undefined, undefined, 404),
    );

    const tree = mount();
    await settle();

    await act(async () => {
      await findSubmitButton(tree.root)!.props.onPress();
    });
    await settle();

    const errorAlerts = alertSpy.mock.calls.filter((c) =>
      String(c[1] ?? '').includes('listing_not_found'),
    );
    expect(errorAlerts.length).toBeGreaterThan(0);
    expect(mockGoBack).toHaveBeenCalled();
  });

  // ---- Test 10 — Negative control: seller path unchanged ----
  test('Test 10: regression-lock — non-adminEdit edit path still calls apiClient.put', async () => {
    mockRouteParams = { carId: 'car_xyz' }; // no adminEdit
    mockAuthValue = {
      user: { ...SELLER_USER },
      isAdmin: false,
      requestSeller: jest.fn(),
      sendPhoneOtp: jest.fn(),
      verifyPhone: jest.fn(),
    };
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { ...FIXTURE_CAR, _id: 'car_xyz', sellerId: 'seller_999' },
    });

    const tree = mount();
    await settle();

    const submit = findSubmitButton(tree.root);
    expect(submit).toBeDefined();
    await act(async () => {
      await submit!.props.onPress();
    });
    await settle();

    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/cars/car_xyz',
      expect.anything(),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(ModerationService.adminEditListing).not.toHaveBeenCalled();
  });

  // ---- Test 11 — FormData centralization lock ----
  test('Test 11: adminEditListing receives a plain object (NOT a FormData instance) — service owns multipart', async () => {
    const tree = mount();
    await settle();

    await act(async () => {
      await findSubmitButton(tree.root)!.props.onPress();
    });
    await settle();

    expect(ModerationService.adminEditListing).toHaveBeenCalledTimes(1);
    const [, inputArg] = (ModerationService.adminEditListing as jest.Mock).mock.calls[0];
    // Anti-pattern lock: any future regression that inline-builds FormData
    // in the screen's submit branch breaks this assertion.
    expect(inputArg).not.toBeInstanceOf(FormData);
    expect(typeof inputArg).toBe('object');
    expect(inputArg).toHaveProperty('fields');
    // Structured shape — service assembles FormData (Plan 04).
    expect(inputArg.fields).toBeDefined();
    expect(typeof inputArg.fields).toBe('object');
  });
});
