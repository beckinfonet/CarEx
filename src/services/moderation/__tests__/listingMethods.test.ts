// Mock the shared apiClient BEFORE importing ModerationService so the
// service's `import { apiClient } from '../http/client'` binds to the mock.
jest.mock('../../http/client', () => ({
  apiClient: {
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
  },
}));

import axios from 'axios';
import { apiClient } from '../../http/client';
import { ListingModerationError } from '../errors';
import { ModerationService } from '../ModerationService';

const mockedApiClient = apiClient as unknown as {
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
  get: jest.Mock;
};

// Build a fake axios error that matches the shape `toListingModerationError`
// expects (`{ response: { status, data } }`). `data.error` becomes the
// ListingModerationError code; the rest map verbatim to context fields.
function buildAxiosError(opts: {
  status: number;
  body: {
    error: string;
    listingStatus?: 'suspended' | 'archived' | 'deleted';
    reasonCategory?: string;
    banner?: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' };
    refundId?: string;
    refundFailed?: boolean;
  };
}): any {
  const err: any = new Error(`Request failed with status code ${opts.status}`);
  err.isAxiosError = true;
  err.response = { status: opts.status, data: opts.body };
  return err;
}

// A modest FormData stub. The default React Native jest preset provides a
// global FormData, but its `getAll`/internals are not portable across jest
// + node-fetch + RN polyfills. To keep Block E's field-assembly assertions
// stable we replace it for the duration of this test file with a small
// `append`-tracking stub. The stub still passes `instanceof FormData` for the
// service-under-test because we expose it as global.FormData; the service
// only ever calls `formData.append(...)` so the stub is a contract-faithful
// substitute.
class FormDataStub {
  public entries: Array<[string, any]> = [];
  append(key: string, value: any) {
    this.entries.push([key, value]);
  }
}

const realFormData = (global as any).FormData;
beforeAll(() => {
  (global as any).FormData = FormDataStub;
});
afterAll(() => {
  (global as any).FormData = realFormData;
});

describe('ModerationService listing methods (Plan 10-04)', () => {
  beforeEach(() => {
    mockedApiClient.post.mockReset();
    mockedApiClient.patch.mockReset();
    mockedApiClient.delete.mockReset();
    mockedApiClient.get.mockReset();
  });

  // ============================================================
  // Block A — suspendListing
  // ============================================================

  describe('Block A: suspendListing', () => {
    it('A1: PATCHes /api/admin/moderation/listings/:carId/suspend with body', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({
        data: { ok: true, listing: { _id: 'car-1', status: 'suspended' } },
      });
      const body = { reasonCategory: 'spam' as const, note: 'duplicate' };

      await (ModerationService as any).suspendListing('car-1', body);

      expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/api/admin/moderation/listings/car-1/suspend',
        body,
      );
    });

    it('A2: returns response.data verbatim on success', async () => {
      const fake = {
        ok: true,
        listing: { _id: 'car-1', status: 'suspended' },
        action: { _id: 'a1', action: 'suspend' },
      };
      mockedApiClient.patch.mockResolvedValueOnce({ data: fake });
      const result = await (ModerationService as any).suspendListing('car-1', {
        reasonCategory: 'spam',
      });
      expect(result).toEqual(fake);
    });

    it('A3: on 400 already_in_state throws ListingModerationError with code+httpStatus', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        buildAxiosError({ status: 400, body: { error: 'already_in_state' } }),
      );

      let caught: any;
      try {
        await (ModerationService as any).suspendListing('car-1', {
          reasonCategory: 'spam',
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ListingModerationError);
      expect(caught.code).toBe('already_in_state');
      expect(caught.httpStatus).toBe(400);
    });
  });

  // ============================================================
  // Block B — archiveListing
  // ============================================================

  describe('Block B: archiveListing', () => {
    it('B1: PATCHes /api/admin/moderation/listings/:carId/archive with body', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });
      const body = { reasonCategory: 'inactive_seller' as const };

      await (ModerationService as any).archiveListing('car-2', body);

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/api/admin/moderation/listings/car-2/archive',
        body,
      );
    });

    it('B2: returns response.data verbatim on success', async () => {
      const fake = { ok: true, listing: { _id: 'car-2', status: 'archived' } };
      mockedApiClient.patch.mockResolvedValueOnce({ data: fake });
      const result = await (ModerationService as any).archiveListing('car-2', {
        reasonCategory: 'inactive_seller',
      });
      expect(result).toEqual(fake);
    });

    it('B3: on 400 invalid_payload throws ListingModerationError with code+httpStatus', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        buildAxiosError({ status: 400, body: { error: 'invalid_payload' } }),
      );

      let caught: any;
      try {
        await (ModerationService as any).archiveListing('car-2', {
          reasonCategory: 'inactive_seller',
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ListingModerationError);
      expect(caught.code).toBe('invalid_payload');
      expect(caught.httpStatus).toBe(400);
    });
  });

  // ============================================================
  // Block C — deleteListing
  // ============================================================

  describe('Block C: deleteListing', () => {
    it('C1: PATCHes /api/admin/moderation/listings/:carId/delete with body', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });
      const body = { reasonCategory: 'fraud' as const, note: 'reported' };

      await (ModerationService as any).deleteListing('car-3', body);

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/api/admin/moderation/listings/car-3/delete',
        body,
      );
    });

    it('C2: returns response.data verbatim on success', async () => {
      const fake = { ok: true, listing: { _id: 'car-3', status: 'deleted' } };
      mockedApiClient.patch.mockResolvedValueOnce({ data: fake });
      const result = await (ModerationService as any).deleteListing('car-3', {
        reasonCategory: 'fraud',
      });
      expect(result).toEqual(fake);
    });

    it('C3: on 403 cannot_moderate_own_listing throws ListingModerationError with code+httpStatus', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        buildAxiosError({
          status: 403,
          body: { error: 'cannot_moderate_own_listing' },
        }),
      );

      let caught: any;
      try {
        await (ModerationService as any).deleteListing('car-3', {
          reasonCategory: 'fraud',
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ListingModerationError);
      expect(caught.code).toBe('cannot_moderate_own_listing');
      expect(caught.httpStatus).toBe(403);
    });
  });

  // ============================================================
  // Block D — restoreListing
  // ============================================================

  describe('Block D: restoreListing', () => {
    it('D1: PATCHes /api/admin/moderation/listings/:carId/restore with body', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });
      const body = { note: 'mistaken delete' };

      await (ModerationService as any).restoreListing('car-4', body);

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/api/admin/moderation/listings/car-4/restore',
        body,
      );
    });

    it('D2: called with no body argument defaults to empty object', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });

      await (ModerationService as any).restoreListing('car-4');

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/api/admin/moderation/listings/car-4/restore',
        {},
      );
    });

    it('D3: on 400 not_moderated throws ListingModerationError with code', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        buildAxiosError({ status: 400, body: { error: 'not_moderated' } }),
      );

      let caught: any;
      try {
        await (ModerationService as any).restoreListing('car-4');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ListingModerationError);
      expect(caught.code).toBe('not_moderated');
      expect(caught.httpStatus).toBe(400);
    });
  });

  // ============================================================
  // Block E — adminEditListing (multipart)
  // ============================================================

  describe('Block E: adminEditListing', () => {
    it('E1: builds FormData (instance of global FormData) and appends scalar fields, knownIssues as JSON, existingImageUrls as JSON, newFiles as {uri,type,name}', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({
        data: { ok: true, listing: { _id: 'car-5', status: 'active' } },
      });

      const input = {
        fields: {
          year: 2020,
          price: 15000,
          description: 'Nice car',
          telegramUsername: '@seller',
          knownIssues: ['scratch', 'tire wear'],
          // undefined fields should be skipped:
          condition: undefined as any,
        },
        existingImageUrls: ['https://cdn/img1.jpg'],
        newFiles: [{ uri: 'file:///tmp/a.jpg', type: 'image/jpeg', name: 'a.jpg' }],
      };

      await (ModerationService as any).adminEditListing('car-5', input);

      const call = mockedApiClient.patch.mock.calls[0];
      const passedFormData = call[1] as FormDataStub;
      expect(passedFormData).toBeInstanceOf(FormDataStub); // global FormData is our stub

      // Build a key -> value map for assertions (preserve order via list of keys for skip check).
      const entries = passedFormData.entries;
      const map = new Map<string, any>(entries);
      const keys = entries.map(([k]) => k);

      // Scalar fields appended as strings (numbers stringified)
      expect(map.get('year')).toBe('2020');
      expect(map.get('price')).toBe('15000');
      expect(map.get('description')).toBe('Nice car');
      expect(map.get('telegramUsername')).toBe('@seller');

      // knownIssues appended as JSON.stringify
      expect(map.get('knownIssues')).toBe(JSON.stringify(['scratch', 'tire wear']));

      // undefined field is skipped entirely (never appended)
      expect(keys).not.toContain('condition');

      // existingImageUrls appended as JSON.stringify
      expect(map.get('existingImageUrls')).toBe(JSON.stringify(['https://cdn/img1.jpg']));

      // newFiles[i] appended as {uri,type,name}
      expect(map.get('images')).toEqual({
        uri: 'file:///tmp/a.jpg',
        type: 'image/jpeg',
        name: 'a.jpg',
      });
    });

    it('E2: calls apiClient.patch(/api/admin/moderation/listings/:carId, formData, { headers: { Content-Type: multipart/form-data } })', async () => {
      mockedApiClient.patch.mockResolvedValueOnce({ data: { ok: true } });

      await (ModerationService as any).adminEditListing('car-5', {
        fields: { year: 2020 },
      });

      const call = mockedApiClient.patch.mock.calls[0];
      expect(call[0]).toBe('/api/admin/moderation/listings/car-5');
      expect(call[1]).toBeInstanceOf(FormDataStub);
      expect(call[2]).toEqual({
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    it('E3: on 400 invalid_make throws ListingModerationError with code+httpStatus', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        buildAxiosError({ status: 400, body: { error: 'invalid_make' } }),
      );

      let caught: any;
      try {
        await (ModerationService as any).adminEditListing('car-5', {
          fields: { makeId: 'bogus' },
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ListingModerationError);
      expect(caught.code).toBe('invalid_make');
      expect(caught.httpStatus).toBe(400);
    });

    it('E4: error context fields preserved (listingStatus + reasonCategory survive through toListingModerationError)', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        buildAxiosError({
          status: 400,
          body: {
            error: 'invalid_make',
            listingStatus: 'suspended',
            reasonCategory: 'spam',
          },
        }),
      );

      let caught: any;
      try {
        await (ModerationService as any).adminEditListing('car-5', {
          fields: { makeId: 'bogus' },
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ListingModerationError);
      expect(caught.listingStatus).toBe('suspended');
      expect(caught.reasonCategory).toBe('spam');
    });
  });

  // ============================================================
  // Block F — searchListings
  // ============================================================

  describe('Block F: searchListings', () => {
    it('F1: GETs /api/admin/moderation/listings with params + signal', async () => {
      const controller = new AbortController();
      mockedApiClient.get.mockResolvedValueOnce({
        data: { rows: [], nextCursor: null },
      });

      await (ModerationService as any).searchListings(
        { status: 'active', q: 'civic', cursor: 'cur1', limit: 25 },
        { signal: controller.signal },
      );

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/moderation/listings',
        {
          params: { status: 'active', q: 'civic', cursor: 'cur1', limit: 25 },
          signal: controller.signal,
        },
      );
    });

    it('F2: returns { rows: [], nextCursor: null } defensively when response.data lacks rows', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: {} });

      const result = await (ModerationService as any).searchListings({});

      expect(result).toEqual({ rows: [], nextCursor: null });
    });

    it('F3a: axios.isCancel error re-thrown as-is WITHOUT ListingModerationError wrap', async () => {
      const cancelErr: any = new Error('canceled');
      // axios.isCancel reads __CANCEL__ on its target; mark it so axios.isCancel returns true.
      cancelErr.__CANCEL__ = true;
      expect(axios.isCancel(cancelErr)).toBe(true);
      mockedApiClient.get.mockRejectedValueOnce(cancelErr);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let caught: any;
      try {
        await (ModerationService as any).searchListings({});
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(cancelErr);
      expect(caught).not.toBeInstanceOf(ListingModerationError);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('F3b: CanceledError name re-thrown as-is WITHOUT ListingModerationError wrap', async () => {
      const cancelErr: any = new Error('canceled');
      cancelErr.name = 'CanceledError';
      mockedApiClient.get.mockRejectedValueOnce(cancelErr);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let caught: any;
      try {
        await (ModerationService as any).searchListings({});
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(cancelErr);
      expect(caught).not.toBeInstanceOf(ListingModerationError);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('F3c: AbortError name re-thrown as-is WITHOUT ListingModerationError wrap', async () => {
      const abortErr: any = new Error('aborted');
      abortErr.name = 'AbortError';
      mockedApiClient.get.mockRejectedValueOnce(abortErr);

      let caught: any;
      try {
        await (ModerationService as any).searchListings({});
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(abortErr);
      expect(caught).not.toBeInstanceOf(ListingModerationError);
    });

    it('F4: non-cancel error re-thrown raw (NOT wrapped into ListingModerationError) — RESEARCH 916-921', async () => {
      const axiosErr: any = new Error('Request failed with status code 500');
      axiosErr.isAxiosError = true;
      axiosErr.response = { status: 500, data: { error: 'server_error' } };
      mockedApiClient.get.mockRejectedValueOnce(axiosErr);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let caught: any;
      try {
        await (ModerationService as any).searchListings({});
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(axiosErr); // same instance — raw, not wrapped
      expect(caught).not.toBeInstanceOf(ListingModerationError);
      expect(consoleSpy).toHaveBeenCalled(); // non-cancel error IS logged
      consoleSpy.mockRestore();
    });
  });
});
