jest.mock('../../http/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../../http/client';
import { RequestService } from '../RequestService';

const mockedApiClient = apiClient as unknown as {
  post: jest.Mock;
  get: jest.Mock;
  put: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

describe('RequestService', () => {
  beforeEach(() => {
    mockedApiClient.post.mockReset();
    mockedApiClient.get.mockReset();
    mockedApiClient.put.mockReset();
    mockedApiClient.patch.mockReset();
    mockedApiClient.delete.mockReset();
  });

  it('createRequest POSTs the input to /api/car-requests and returns data', async () => {
    const input = { makeId: 'm1', budgetMax: 15000 };
    mockedApiClient.post.mockResolvedValueOnce({ data: { _id: 'r1', ...input } });

    const result = await RequestService.createRequest(input);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/car-requests', input);
    expect(result).toEqual({ _id: 'r1', makeId: 'm1', budgetMax: 15000 });
  });

  it('getMyRequests GETs /api/car-requests/mine and returns the array', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: [{ _id: 'r1' }] });
    const result = await RequestService.getMyRequests();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/car-requests/mine');
    expect(result).toEqual([{ _id: 'r1' }]);
  });

  it('updateRequest PUTs to /api/car-requests/:id', async () => {
    const input = { makeId: 'm1', budgetMax: 20000 };
    mockedApiClient.put.mockResolvedValueOnce({ data: { _id: 'r1', ...input } });
    const result = await RequestService.updateRequest('r1', input);
    expect(mockedApiClient.put).toHaveBeenCalledWith('/api/car-requests/r1', input);
    expect(result.budgetMax).toBe(20000);
  });

  it('closeRequest PATCHes /api/car-requests/:id/close', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ data: { _id: 'r1', status: 'closed' } });
    const result = await RequestService.closeRequest('r1');
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/car-requests/r1/close');
    expect(result.status).toBe('closed');
  });

  it('deleteRequest DELETEs /api/car-requests/:id', async () => {
    mockedApiClient.delete.mockResolvedValueOnce({ data: { ok: true } });
    const result = await RequestService.deleteRequest('r1');
    expect(mockedApiClient.delete).toHaveBeenCalledWith('/api/car-requests/r1');
    expect(result.ok).toBe(true);
  });

  it('rethrows on network error', async () => {
    mockedApiClient.post.mockRejectedValueOnce(new Error('boom'));
    await expect(RequestService.createRequest({ makeId: 'm1', budgetMax: 1 })).rejects.toThrow('boom');
  });
});
