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
};
