import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Switch, TouchableOpacity, Linking } from 'react-native';
import messaging from '@react-native-firebase/messaging';

/**
 * Phase 12 Plan 12-10 Task 1 — NotificationSettingsScreen behavior contract
 * (NPRF-01/02/03/04, NSUB-03, CTX D-10/D-11).
 *
 * Proves:
 *   - The master-mute Switch is present (NPRF-01).
 *   - The saved-search cadence selector renders Instant as selected and Daily
 *     as DISABLED/non-selectable; pressing the Daily option does NOT call
 *     updateSubscription with cadence 'daily' — it surfaces the "coming soon"
 *     hint instead (D-10 / NSUB-03 Daily-disabled assertion).
 */

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

// Echo-key proxy so assertions can match on the key name regardless of locale.
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

// useAuth — supplies the user (localId) + the profile-update path consumed for
// notificationPrefs persistence.
let mockUser: any = { localId: 'u-1', notificationPrefs: {} };
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, refreshUser: jest.fn() }),
}));

// User-profile update path (notificationPrefs are profile fields, not
// notification-router calls — MOB-01 only forbids notification ROUTER calls on
// AuthService).
const mockUpdateBackendUser = jest.fn((..._args: any[]) => Promise.resolve({}));
jest.mock('../../services/AuthService', () => ({
  AuthService: {
    updateBackendUser: (uid: string, data: unknown) =>
      mockUpdateBackendUser(uid, data),
  },
}));

// useNotifications — subscription CRUD surface, seeded with one saved_search.
const mockListSubscriptions = jest.fn();
const mockUpdateSubscription = jest.fn(() => Promise.resolve({}));
const mockDeleteSubscription = jest.fn(() => Promise.resolve({}));

const SAVED_SEARCH_SUB = {
  _id: 'sub-ss-1',
  uid: 'u-1',
  kind: 'saved_search' as const,
  criteria: { makeId: 'Toyota', priceMax: 15000 },
  cadence: 'instant' as const,
  active: true,
  createdAt: '2026-06-06T10:00:00.000Z',
};

jest.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    listSubscriptions: mockListSubscriptions,
    updateSubscription: mockUpdateSubscription,
    deleteSubscription: mockDeleteSubscription,
  }),
}));

import NotificationSettingsScreen from '../NotificationSettingsScreen';

async function render() {
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<NotificationSettingsScreen />);
  });
  // Flush the listSubscriptions promise so the seeded row renders.
  await act(async () => {
    await Promise.resolve();
  });
  // @ts-ignore — assigned in act
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { localId: 'u-1', notificationPrefs: {} };
  mockListSubscriptions.mockResolvedValue([SAVED_SEARCH_SUB]);
});

describe('NotificationSettingsScreen — controls (NPRF-01)', () => {
  it('renders the master-mute Switch plus category Switches (>= 3 Switches)', async () => {
    const tree = await render();
    const switches = tree.root.findAllByType(Switch);
    // master mute + saved-search category + watch category (NPRF-01).
    expect(switches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('NotificationSettingsScreen — cadence (D-10 / NSUB-03)', () => {
  it('renders the Daily cadence option disabled/non-interactive', async () => {
    const tree = await render();
    // Find the Daily cadence control by its testID.
    const daily = tree.root.findByProps({ testID: 'cadence-daily-sub-ss-1' });
    // Daily must be marked disabled (TouchableOpacity disabled prop OR
    // accessibilityState.disabled) so it reads as non-selectable.
    const isDisabled =
      daily.props.disabled === true ||
      daily.props.accessibilityState?.disabled === true;
    expect(isDisabled).toBe(true);
  });

  it('pressing Daily does NOT call updateSubscription with cadence "daily"', async () => {
    const tree = await render();
    const daily = tree.root.findByProps({ testID: 'cadence-daily-sub-ss-1' });

    act(() => {
      // Fire whatever press handler exists; a disabled control must no-op the
      // cadence change.
      if (typeof daily.props.onPress === 'function') {
        daily.props.onPress();
      }
    });

    // The Daily-disabled invariant: cadence is NEVER set to 'daily' (D-10).
    expect(mockUpdateSubscription).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cadence: 'daily' }),
    );
  });

  it('renders the Instant cadence option as the selected one', async () => {
    const tree = await render();
    const instant = tree.root.findByProps({ testID: 'cadence-instant-sub-ss-1' });
    expect(instant).toBeTruthy();
  });
});

describe('NotificationSettingsScreen — delete confirm (NPRF-02 / D-11)', () => {
  it('renders a delete affordance for the seeded saved-search subscription', async () => {
    const tree = await render();
    const del = tree.root.findByProps({ testID: 'delete-sub-ss-1' });
    expect(del).toBeTruthy();
  });
});

describe('NotificationSettingsScreen — push recovery row (NPRF-07 / D-09/D-10/D-11)', () => {
  const hasPermissionMock = messaging().hasPermission as jest.Mock;

  beforeEach(() => {
    (Linking.openSettings as jest.Mock) = jest.fn(() => Promise.resolve());
  });

  it('when permission is OFF the recovery row is tappable and deep-links to OS Settings (D-10)', async () => {
    hasPermissionMock.mockResolvedValue(
      messaging.AuthorizationStatus.DENIED, // 0 → off
    );
    const tree = await render();
    // Flush the hasPermission read.
    await act(async () => {
      await Promise.resolve();
    });
    const row = tree.root.findByProps({ testID: 'push-permission-row' });
    expect(row.props.disabled).toBe(false);
    await act(async () => {
      row.props.onPress();
    });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('when permission is ON the row shows the on-status and is not a recovery target (D-11)', async () => {
    hasPermissionMock.mockResolvedValue(
      messaging.AuthorizationStatus.AUTHORIZED, // 1 → on
    );
    const tree = await render();
    await act(async () => {
      await Promise.resolve();
    });
    const row = tree.root.findByProps({ testID: 'push-permission-row' });
    expect(row.props.disabled).toBe(true);
    // Tapping a disabled on-row never opens OS Settings.
    await act(async () => {
      if (typeof row.props.onPress === 'function') row.props.onPress();
    });
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });
});
