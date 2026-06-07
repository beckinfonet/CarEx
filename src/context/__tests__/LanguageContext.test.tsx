/**
 * Phase 12 Plan 07 (NI18N-02) — LanguageContext persistence.
 *
 * Mirrors the NotificationContext.test.tsx harness (react-test-renderer + a Probe
 * component that captures the hook result). AsyncStorage is the library's official
 * in-memory mock (jest.setup.js). AuthService is mocked so we control the
 * logged-in user (read lazily from stored userData at setLanguage time) and can
 * assert the backend write fires only when a user is logged in.
 *
 * Proves the four behaviors from the plan:
 *   - On mount with stored 'EN' → context initializes to 'EN'.
 *   - On mount with no stored value → context defaults to 'RU'.
 *   - setLanguage('EN') writes AsyncStorage AND calls the backend PUT when a user
 *     is logged in.
 *   - setLanguage when NO user is logged in writes AsyncStorage but does NOT call
 *     the backend (no crash before auth).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AuthService: getUserData supplies the logged-in user lazily;
// updateBackendUser is the backend PUT /api/users/:uid path.
jest.mock('../../services/AuthService', () => ({
  AuthService: {
    getUserData: jest.fn(),
    updateBackendUser: jest.fn(),
  },
}));

import { AuthService } from '../../services/AuthService';
import { LanguageProvider, useLanguage } from '../LanguageContext';

const LANGUAGE_KEY = '@carex_language';

const auth = AuthService as unknown as {
  getUserData: jest.Mock;
  updateBackendUser: jest.Mock;
};

let hookResult: ReturnType<typeof useLanguage>;
function Probe() {
  hookResult = useLanguage();
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

async function mount() {
  await act(async () => {
    TestRenderer.create(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
  });
  await flush();
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  auth.getUserData.mockResolvedValue(null);
  auth.updateBackendUser.mockResolvedValue({});
});

describe('LanguageContext persistence (NI18N-02)', () => {
  test('hydrates from AsyncStorage on mount when a value is stored (EN)', async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'EN');

    await mount();

    expect(hookResult.language).toBe('EN');
  });

  test('defaults to RU on mount when no value is stored', async () => {
    await mount();

    expect(hookResult.language).toBe('RU');
  });

  test('setLanguage persists to AsyncStorage AND backend when a user is logged in', async () => {
    auth.getUserData.mockResolvedValue({ localId: 'user-A' });

    await mount();

    await act(async () => {
      hookResult.setLanguage('EN');
    });
    await flush();

    expect(hookResult.language).toBe('EN');
    await expect(AsyncStorage.getItem(LANGUAGE_KEY)).resolves.toBe('EN');
    expect(auth.updateBackendUser).toHaveBeenCalledWith('user-A', { language: 'EN' });
  });

  test('setLanguage with no logged-in user persists to AsyncStorage but NOT backend (no crash before auth)', async () => {
    auth.getUserData.mockResolvedValue(null);

    await mount();

    await act(async () => {
      hookResult.setLanguage('EN');
    });
    await flush();

    expect(hookResult.language).toBe('EN');
    await expect(AsyncStorage.getItem(LANGUAGE_KEY)).resolves.toBe('EN');
    expect(auth.updateBackendUser).not.toHaveBeenCalled();
  });

  test('useLanguage throws when used outside a LanguageProvider', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      act(() => {
        TestRenderer.create(<Probe />);
      }),
    ).toThrow('useLanguage must be used within a LanguageProvider');
    errSpy.mockRestore();
  });
});
