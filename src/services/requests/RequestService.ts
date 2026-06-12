import { apiClient } from '../http/client';

export interface CreateRequestInput {
  makeId: string;
  modelId?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  budgetMin?: number | null;
  budgetMax: number;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  interiorMaterial?: string | null;
  engine?: string | null;
  fuel?: string | null;
  note?: string | null;
  telegramUsername?: string | null;
}

export interface CarRequest {
  _id: string;
  buyerUid: string;
  makeId: string;
  modelId: string | null;
  makeName: string;
  modelName: string | null;
  yearMin: number | null;
  yearMax: number | null;
  budgetMin: number | null;
  budgetMax: number;
  currency: string;
  exteriorColor: string | null;
  interiorColor: string | null;
  interiorMaterial: string | null;
  engine: string | null;
  fuel: string | null;
  note: string | null;
  contactPhone: string;
  contactPhoneVerified: boolean;
  telegramUsername: string | null;
  telegramVerified: boolean;
  status: 'open' | 'closed' | 'expired';
  expiresAt: string;
  unlockCount: number;
  createdAt: string;
  updatedAt: string;
}

// Seller-facing shape: identical to CarRequest minus the buyer-contact fields,
// plus an `unlocked` flag. The backend strips contact fields for sellers.
export interface RedactedCarRequest {
  _id: string;
  makeId: string;
  modelId: string | null;
  makeName: string;
  modelName: string | null;
  yearMin: number | null;
  yearMax: number | null;
  budgetMin: number | null;
  budgetMax: number;
  currency: string;
  exteriorColor: string | null;
  interiorColor: string | null;
  interiorMaterial: string | null;
  engine: string | null;
  fuel: string | null;
  note: string | null;
  status: 'open' | 'closed' | 'expired';
  expiresAt: string;
  unlockCount: number;
  unlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrowseFilters {
  makeId?: string | null;
  modelId?: string | null;
  minBudget?: number | null;
}

export interface BrowseResponse {
  unlockPrice: number;
  currency: string;
  requests: RedactedCarRequest[];
}

export interface RequestDetailResponse {
  unlockPrice: number;
  currency: string;
  request: RedactedCarRequest;
}

// The minimal field set RequestCard renders — satisfied by both the buyer's
// full CarRequest and the seller's RedactedCarRequest.
export type RequestCardData = Pick<
  CarRequest,
  '_id' | 'makeName' | 'modelName' | 'budgetMax' | 'budgetMin' | 'currency' | 'yearMin' | 'yearMax' | 'status'
>;

// buyerUid is derived server-side from the Bearer token — never sent here.
export const RequestService = {
  createRequest: async (input: CreateRequestInput): Promise<CarRequest> => {
    try {
      const response = await apiClient.post('/api/car-requests', input);
      return response.data;
    } catch (error) {
      console.error('Failed to create car request', error);
      throw error;
    }
  },

  getMyRequests: async (): Promise<CarRequest[]> => {
    try {
      const response = await apiClient.get('/api/car-requests/mine');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch car requests', error);
      throw error;
    }
  },

  updateRequest: async (id: string, input: CreateRequestInput): Promise<CarRequest> => {
    try {
      const response = await apiClient.put(`/api/car-requests/${id}`, input);
      return response.data;
    } catch (error) {
      console.error('Failed to update car request', error);
      throw error;
    }
  },

  closeRequest: async (id: string): Promise<CarRequest> => {
    try {
      const response = await apiClient.patch(`/api/car-requests/${id}/close`);
      return response.data;
    } catch (error) {
      console.error('Failed to close car request', error);
      throw error;
    }
  },

  deleteRequest: async (id: string): Promise<{ ok: boolean }> => {
    try {
      const response = await apiClient.delete(`/api/car-requests/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete car request', error);
      throw error;
    }
  },

  getOpenRequests: async (filters: BrowseFilters = {}): Promise<BrowseResponse> => {
    try {
      const params: Record<string, string | number> = {};
      if (filters.makeId) {params.makeId = filters.makeId;}
      if (filters.modelId) {params.modelId = filters.modelId;}
      if (filters.minBudget != null) {params.minBudget = filters.minBudget;}
      const response = await apiClient.get('/api/car-requests', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to browse car requests', error);
      throw error;
    }
  },

  getRequestDetail: async (id: string): Promise<RequestDetailResponse> => {
    try {
      const response = await apiClient.get(`/api/car-requests/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch car request detail', error);
      throw error;
    }
  },
};
