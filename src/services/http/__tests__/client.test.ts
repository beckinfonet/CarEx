import {
  apiClient,
  setTokenProvider,
  setModerationRefreshListener,
} from '../client';
import { ModerationError } from '../../moderation/errors';

/**
 * Mock the apiClient's axios adapter to intercept real HTTP requests.
 * No new test deps required — we override the instance's adapter and
 * hand back a canned response (success or error) per test.
 */
type MockResponseInput = { status: number; data: any };
type RequestSpy = (config: any) => void;

function mockResponse(response: MockResponseInput, requestSpy?: RequestSpy) {
  apiClient.defaults.adapter = async (config: any) => {
    requestSpy?.(config);
    const base = {
      status: response.status,
      statusText: response.status >= 400 ? 'Error' : 'OK',
      data: response.data,
      headers: {},
      config,
    };
    if (response.status >= 400) {
      const err: any = new Error(
        `Request failed with status code ${response.status}`,
      );
      err.response = base;
      err.config = config;
      err.isAxiosError = true;
      throw err;
    }
    return base;
  };
}

describe('apiClient — request interceptor', () => {
  beforeEach(() => {
    setTokenProvider(() => null);
    setModerationRefreshListener(async () => {});
  });

  it('Test 1: attaches Authorization Bearer when tokenProvider returns a token', async () => {
    setTokenProvider(() => 'abc123');
    let captured: any = null;
    mockResponse({ status: 200, data: { ok: true } }, (config) => {
      captured = config;
    });

    await apiClient.get('/ping');

    expect(captured?.headers?.Authorization).toBe('Bearer abc123');
  });

  it('Test 2: omits Authorization header when tokenProvider returns null', async () => {
    setTokenProvider(() => null);
    let captured: any = null;
    mockResponse({ status: 200, data: { ok: true } }, (config) => {
      captured = config;
    });

    await apiClient.get('/ping');

    expect(captured?.headers?.Authorization).toBeUndefined();
  });

  it('Test 3: succeeds with no Authorization header when no provider is registered', async () => {
    // Reset to "no provider" state by setting a provider that returns null,
    // then clear by setting a provider that returns null again — equivalent to
    // "never registered" since the interceptor uses optional-chain call.
    // (We cannot truly "unregister" without adding API surface, so null is the
    // equivalent observable state.)
    setTokenProvider(() => null);
    let captured: any = null;
    mockResponse({ status: 200, data: { ok: true } }, (config) => {
      captured = config;
    });

    await expect(apiClient.get('/ping')).resolves.toBeDefined();
    expect(captured?.headers?.Authorization).toBeUndefined();
  });
});

describe('apiClient — response interceptor', () => {
  beforeEach(() => {
    setTokenProvider(() => null);
    setModerationRefreshListener(async () => {});
  });

  it('Test 4: 403 account_suspended wraps error into ModerationError with all backend fields', async () => {
    mockResponse({
      status: 403,
      data: {
        error: 'account_suspended',
        status: 'blocked_with_review',
        reasonCategory: 'spam',
        note: 'abuse',
      },
    });

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      code: 'account_suspended',
      status: 'blocked_with_review',
      reasonCategory: 'spam',
      note: 'abuse',
      httpStatus: 403,
    });

    try {
      await apiClient.get('/protected');
      fail('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(ModerationError);
    }
  });

  it('Test 5: awaits registered refresh listener exactly once before throwing', async () => {
    const listener = jest.fn().mockResolvedValue(undefined);
    setModerationRefreshListener(listener);
    mockResponse({
      status: 403,
      data: { error: 'account_suspended', status: 'blocked_with_review' },
    });

    await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(
      ModerationError,
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Test 6: _skipModerationInterceptor=true bypasses refresh AND re-throws raw axios error', async () => {
    const listener = jest.fn().mockResolvedValue(undefined);
    setModerationRefreshListener(listener);
    mockResponse({
      status: 403,
      data: { error: 'account_suspended', status: 'blocked_with_review' },
    });

    try {
      await apiClient.get('/protected', { _skipModerationInterceptor: true });
      fail('expected rejection');
    } catch (err: any) {
      expect(err).not.toBeInstanceOf(ModerationError);
      expect(err.isAxiosError).toBe(true);
      expect(err.response?.status).toBe(403);
    }

    expect(listener).not.toHaveBeenCalled();
  });

  it('Test 7: non-403 response (500) rejects with original axios error unchanged', async () => {
    mockResponse({ status: 500, data: { error: 'server_error' } });

    try {
      await apiClient.get('/boom');
      fail('expected rejection');
    } catch (err: any) {
      expect(err).not.toBeInstanceOf(ModerationError);
      expect(err.isAxiosError).toBe(true);
      expect(err.response?.status).toBe(500);
    }
  });

  it('Test 8: 403 with different error code (not account_suspended) passes through raw', async () => {
    const listener = jest.fn().mockResolvedValue(undefined);
    setModerationRefreshListener(listener);
    mockResponse({
      status: 403,
      data: { error: 'not_admin' },
    });

    try {
      await apiClient.get('/admin/only');
      fail('expected rejection');
    } catch (err: any) {
      expect(err).not.toBeInstanceOf(ModerationError);
      expect(err.response?.status).toBe(403);
      expect(err.response?.data?.error).toBe('not_admin');
    }

    expect(listener).not.toHaveBeenCalled();
  });
});
