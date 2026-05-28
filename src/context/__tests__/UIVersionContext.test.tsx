import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UIVersionProvider, useUIVersion } from '../UIVersionContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
const mockedAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let hookResult: ReturnType<typeof useUIVersion>;
function Probe() {
  hookResult = useUIVersion();
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => { jest.clearAllMocks(); });

describe('UIVersionContext', () => {
  test('defaults to v1 with inviteDismissed=false when AsyncStorage is empty', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    expect(hookResult.version).toBe('v1');
    expect(hookResult.inviteDismissed).toBe(false);
  });

  test('hydrates v2 from AsyncStorage on mount', async () => {
    mockedAsync.getItem.mockImplementation(async (k) => {
      if (k === 'ui_design_version') return 'v2';
      if (k === 'ui_design_invite_dismissed_v2') return 'true';
      return null;
    });
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    expect(hookResult.version).toBe('v2');
    expect(hookResult.inviteDismissed).toBe(true);
  });

  test('setVersion persists to AsyncStorage', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    await act(async () => { hookResult.setVersion('v2'); });
    await flush();
    expect(mockedAsync.setItem).toHaveBeenCalledWith('ui_design_version', 'v2');
    expect(hookResult.version).toBe('v2');
  });

  test('dismissInvite persists and updates state', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    await act(async () => { hookResult.dismissInvite(); });
    await flush();
    expect(mockedAsync.setItem).toHaveBeenCalledWith('ui_design_invite_dismissed_v2', 'true');
    expect(hookResult.inviteDismissed).toBe(true);
  });

});
