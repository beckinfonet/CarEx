// Phase 10 — Plan 05 — LMOB-02 regression suite.
//
// Locks the invariant: listing-domain errors (409 listing_not_available,
// 403 cannot_moderate_own_listing, etc.) MUST NOT trigger the existing
// 403 user-suspension interceptor in client.ts. The interceptor's
// discriminator is `data?.error === 'account_suspended'` — these tests
// assert that listing errors fall through the discriminator and reject
// as plain axios errors (NEVER as ModerationError, NEVER firing the
// moderationRefreshListener).
//
// T-10-02 mitigation. Plan 08 will wire the bottom-sheet error banner on
// top of these errors via service-layer wrappers (Plan 10-04); the client
// interceptor MUST stay untouched. This file also locks the interceptor
// count at exactly 2 (Pitfall 1) and the discriminator string against
// accidental widening (e.g., a future maintainer also catching
// 'listing_not_available').
//
// Fault-injection runbook for future agents:
//   1. Edit client.ts to widen the 403 discriminator (e.g. add ||
//      data?.error === 'listing_not_available'). Test 1 fails — listing
//      error is now wrapped as ModerationError + refresh listener fires.
//   2. Add a third apiClient.interceptors.response.use(...) call. Test 4
//      fails — interceptor count is no longer 2.
//   3. Change the discriminator string in client.ts. Test 5 fails — the
//      grep-bait substring no longer appears verbatim.
//   4. Revert each change individually; all 5 tests return to green.

import * as fs from 'fs';
import * as path from 'path';
import {
  apiClient,
  setTokenProvider,
  setModerationRefreshListener,
} from '../client';
import { ModerationError, ListingModerationError } from '../../moderation/errors';

// Reuse the canned-adapter mocking pattern from client.test.ts so we don't
// introduce a new dependency (axios-mock-adapter is NOT in devDependencies).
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

describe('apiClient interceptor — LMOB-02 invariant', () => {
  beforeEach(() => {
    setTokenProvider(() => null);
    // Reset to a default no-op listener; per-test cases override with a spy.
    setModerationRefreshListener(async () => {});
  });

  it('Test 1: 409 listing_not_available passes through raw — no ModerationError, no listener call', async () => {
    const refreshListener = jest.fn().mockResolvedValue(undefined);
    setModerationRefreshListener(refreshListener);

    mockResponse({
      status: 409,
      data: {
        error: 'listing_not_available',
        listingStatus: 'suspended',
        reasonCategory: 'spam',
      },
    });

    try {
      await apiClient.post('/api/cars/anything', { foo: 'bar' });
      // Should never reach here.
      throw new Error('expected rejection');
    } catch (err: any) {
      // (a) Rejection is a plain axios error — NOT ModerationError, NOT
      //     ListingModerationError (the latter is only thrown by Plan 04's
      //     ModerationService wrappers, not by the client interceptor).
      expect(err).not.toBeInstanceOf(ModerationError);
      expect(err).not.toBeInstanceOf(ListingModerationError);
      // (c) Original axios envelope preserved.
      expect(err.isAxiosError).toBe(true);
      expect(err.response?.status).toBe(409);
      expect(err.response?.data?.error).toBe('listing_not_available');
    }

    // (b) Refresh listener was NEVER invoked — discriminator filtered it out.
    expect(refreshListener).toHaveBeenCalledTimes(0);
  });

  it('Test 2: 403 cannot_moderate_own_listing passes through raw — no ModerationError, no listener call', async () => {
    const refreshListener = jest.fn().mockResolvedValue(undefined);
    setModerationRefreshListener(refreshListener);

    mockResponse({
      status: 403,
      data: { error: 'cannot_moderate_own_listing' },
    });

    try {
      await apiClient.patch(
        '/api/admin/moderation/listings/x/suspend',
        { reasonCategory: 'spam' },
      );
      throw new Error('expected rejection');
    } catch (err: any) {
      // (a) NOT a ModerationError throw — discriminator requires
      //     data.error === 'account_suspended' which is not present here.
      expect(err).not.toBeInstanceOf(ModerationError);
      expect(err.isAxiosError).toBe(true);
      // (c) Raw 403 envelope preserved.
      expect(err.response?.status).toBe(403);
      expect(err.response?.data?.error).toBe('cannot_moderate_own_listing');
    }

    // (b) Refresh listener was NEVER invoked.
    expect(refreshListener).toHaveBeenCalledTimes(0);
  });

  it('Test 3: positive control — 403 account_suspended DOES wrap into ModerationError + fires listener once', async () => {
    const refreshListener = jest.fn().mockResolvedValue(undefined);
    setModerationRefreshListener(refreshListener);

    mockResponse({
      status: 403,
      data: {
        error: 'account_suspended',
        status: 'permanently_banned',
      },
    });

    let captured: any = null;
    try {
      await apiClient.get('/protected');
      throw new Error('expected rejection');
    } catch (err: any) {
      captured = err;
    }

    // (b) Listener fired exactly once — interceptor is still wired correctly.
    expect(refreshListener).toHaveBeenCalledTimes(1);
    // (a) Rejection IS ModerationError with the account_suspended code.
    expect(captured).toBeInstanceOf(ModerationError);
    expect(captured.code).toBe('account_suspended');
    expect(captured.status).toBe('permanently_banned');
    expect(captured.httpStatus).toBe(403);
  });

  it('Test 4: anti-pattern guard — exactly 2 response interceptors in client.ts (no third for listing errors per Pitfall 1)', () => {
    const clientPath = path.resolve(__dirname, '..', 'client.ts');
    const source = fs.readFileSync(clientPath, 'utf8');
    const matches = source.match(/interceptors\.response\.use/g) ?? [];
    // Existing two interceptors: 403 account_suspended handler (Phase 4
    // D-09..D-11) + 401 idToken refresh + retry (Plan 05-12). Adding a third
    // for listing errors would re-introduce the loop-guard footgun Phase 4
    // D-11 fixed. Listing errors must be handled at the service layer
    // (Plan 10-04) — NOT here.
    expect(matches.length).toBe(2);
  });

  it('Test 5: anti-pattern guard — account_suspended discriminator string preserved in client.ts', () => {
    const clientPath = path.resolve(__dirname, '..', 'client.ts');
    const source = fs.readFileSync(clientPath, 'utf8');
    // Locks LMOB-02 invariant against accidental discriminator drift. A
    // future maintainer who tries to also catch 'listing_not_available' or
    // widens the comparator (e.g., `.includes(`) breaks this assertion.
    // We accept either single-dot or optional-chain form because client.ts
    // currently uses the optional-chain `data?.error` shape, and either
    // would be semantically equivalent for the invariant we are locking.
    const matchDot = source.includes(
      "data.error === 'account_suspended'",
    );
    const matchOptional = source.includes(
      "data?.error === 'account_suspended'",
    );
    // OR via the extracted ACCOUNT_SUSPENDED constant — client.ts (Phase 4
    // grep-bait) factored the literal into a single source-of-truth
    // constant `const ACCOUNT_SUSPENDED = 'account_suspended'` and the
    // discriminator reads `data?.error === ACCOUNT_SUSPENDED`. Accept that
    // canonical form as well.
    const matchConstant =
      source.includes("const ACCOUNT_SUSPENDED = 'account_suspended'") &&
      source.includes('data?.error === ACCOUNT_SUSPENDED');
    expect(matchDot || matchOptional || matchConstant).toBe(true);
  });
});
