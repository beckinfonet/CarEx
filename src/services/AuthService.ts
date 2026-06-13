import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/config';
import { apiClient } from './http/client';

// Get API Key from your environment or hardcode for now if needed, 
// but using the one from the plist you provided:
const API_KEY = 'AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas';

const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

export const AuthService = {
  signUp: async (email, password) => {
    try {
      const response = await axios.post(`${AUTH_URL}:signUp?key=${API_KEY}`, {
        email,
        password,
        returnSecureToken: true,
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data.error : error;
    }
  },

  signIn: async (email, password) => {
    try {
      const response = await axios.post(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
        email,
        password,
        returnSecureToken: true,
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data.error : error;
    }
  },

  sendPasswordResetEmail: async (email: string) => {
    try {
      const response = await axios.post(`${AUTH_URL}:sendOobCode?key=${API_KEY}`, {
        requestType: 'PASSWORD_RESET',
        email,
      });
      return response.data;
    } catch (error: any) {
      throw error.response ? error.response.data.error : error;
    }
  },

  saveToken: async (token, userData) => {
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
  },

  getToken: async () => {
    return await AsyncStorage.getItem('userToken');
  },

  getUserData: async () => {
    const data = await AsyncStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  },

  logout: async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userRefreshToken');
    await AsyncStorage.removeItem('userIdTokenExpiresAt');
    await AsyncStorage.removeItem('userData');
  },

  // --- Firebase token refresh (Plan 05-12 / UAT Test 8) ---
  //
  // Firebase Identity Toolkit issues idTokens with a 1-hour TTL. After expiry,
  // every protected backend call returns 401 until a new idToken is minted via
  // the securetoken endpoint using the long-lived refreshToken obtained at
  // sign-in. This method is the only mobile-side caller of that endpoint.
  //
  // Endpoint: POST https://securetoken.googleapis.com/v1/token?key=API_KEY
  // Content-Type: application/x-www-form-urlencoded
  // Body: grant_type=refresh_token&refresh_token=<token>
  // Returns SNAKE_CASE { id_token, refresh_token, expires_in, ... } —
  // normalized to camelCase here so the rest of AuthService stays consistent.
  //
  // Errors:
  //   - 400 INVALID_REFRESH_TOKEN / TOKEN_EXPIRED / USER_DISABLED → permanent
  //     failure. Caller (AuthContext) should logout the user.
  //   - Network error → transient. Caller may retry.
  refreshIdToken: async (refreshToken: string) => {
    try {
      const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
      const response = await axios.post(
        `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
        body,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      // Normalize snake_case → camelCase to match signIn/signUp shape.
      return {
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      // Permanent-failure shape: rethrow with the Firebase error message so
      // AuthContext can branch on it (TOKEN_EXPIRED → logout vs network →
      // retry-later).
      throw error.response ? error.response.data.error : error;
    }
  },

  // --- Session persistence helpers (Plan 05-12) ---
  //
  // saveAuthSession extends the original saveToken (kept for back-compat) by
  // also persisting refreshToken + idTokenExpiresAt. Called by AuthContext
  // login/signup AND by the refresh path so the new idToken survives a cold
  // start.
  saveAuthSession: async (
    idToken: string,
    refreshToken: string | null,
    expiresInSeconds: number | string,
    userData: any,
  ) => {
    const seconds =
      typeof expiresInSeconds === 'string'
        ? parseInt(expiresInSeconds, 10)
        : expiresInSeconds;
    const expiresAt = Date.now() + (Number.isFinite(seconds) ? seconds : 3600) * 1000;
    await AsyncStorage.setItem('userToken', idToken);
    if (refreshToken) {
      await AsyncStorage.setItem('userRefreshToken', refreshToken);
    }
    await AsyncStorage.setItem('userIdTokenExpiresAt', String(expiresAt));
    if (userData !== undefined) {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem('userRefreshToken');
  },

  getIdTokenExpiresAt: async (): Promise<number> => {
    const raw = await AsyncStorage.getItem('userIdTokenExpiresAt');
    return raw ? parseInt(raw, 10) : 0;
  },

  // Backend User Methods
  createBackendUser: async (firebaseUid: string, email: string) => {
    try {
      await apiClient.post('/api/users', { firebaseUid, email });
    } catch (error) {
      console.error('Failed to create backend user', error);
    }
  },

  // Resolve a free-text city to a normalized "City, Country" string via the
  // public backend geocode endpoint (Nominatim). Returns a uniform shape so
  // callers can simply gate on `ok` — a 404/network error becomes { ok: false }.
  geocodeCity: async (city: string): Promise<{ ok: boolean; location?: string }> => {
    try {
      const response = await apiClient.get('/api/geocode/city', { params: { q: city } });
      return response.data;
    } catch {
      return { ok: false };
    }
  },

  getBackendUser: async (firebaseUid: string, config?: AxiosRequestConfig) => {
    try {
      const response = await apiClient.get(`/api/users/${firebaseUid}`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to get backend user', error);
      return null;
    }
  },

  updateBackendUser: async (firebaseUid: string, data: any) => {
    try {
      const response = await apiClient.put(`/api/users/${firebaseUid}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update backend user', error);
      throw error;
    }
  },

  uploadAvatar: async (firebaseUid: string, imageAsset: { uri: string; type?: string; fileName?: string }) => {
    try {
      const formData = new FormData();
      const file = {
        uri: imageAsset.uri,
        type: imageAsset.type || 'image/jpeg',
        name: imageAsset.fileName || 'avatar.jpg',
      };
      // @ts-ignore - React Native FormData accepts this shape
      formData.append('avatar', file);
      const response = await apiClient.post(`/api/users/${firebaseUid}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to upload avatar', error);
      throw error;
    }
  },

  requestSellerStatus: async (firebaseUid: string) => {
    try {
      const response = await apiClient.post(`/api/users/${firebaseUid}/request-seller`);
      return response.data;
    } catch (error) {
      console.error('Failed to request seller status', error);
      throw error;
    }
  },

  requestBrokerStatus: async (firebaseUid: string) => {
    try {
      const response = await apiClient.post(`/api/users/${firebaseUid}/request-broker`);
      return response.data;
    } catch (error) {
      console.error('Failed to request broker status', error);
      throw error;
    }
  },

  requestLogisticsStatus: async (firebaseUid: string) => {
    try {
      const response = await apiClient.post(`/api/users/${firebaseUid}/request-logistics`);
      return response.data;
    } catch (error) {
      console.error('Failed to request logistics status', error);
      throw error;
    }
  },

  getBrokerProfile: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get(`/api/brokers/${firebaseUid}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to get broker profile', error);
      }
      return null;
    }
  },

  updateBrokerProfile: async (firebaseUid: string, data: any) => {
    try {
      const response = await apiClient.put(`/api/brokers/${firebaseUid}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update broker profile', error);
      throw error;
    }
  },

  getLogisticsProfile: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get(`/api/logistics/${firebaseUid}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to get logistics profile', error);
      }
      return null;
    }
  },

  updateLogisticsProfile: async (firebaseUid: string, data: any) => {
    try {
      const response = await apiClient.put(`/api/logistics/${firebaseUid}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update logistics profile', error);
      throw error;
    }
  },

  sendOtp: async (phoneNumber: string) => {
    try {
      const response = await apiClient.post('/api/otp/send', { phoneNumber });
      return response.data;
    } catch (error) {
      console.error('Failed to send OTP', error);
      throw error;
    }
  },

  verifyOtp: async (phoneNumber: string, code: string, firebaseUid: string) => {
    try {
      const response = await apiClient.post('/api/otp/verify', { phoneNumber, code, firebaseUid });
      return response.data;
    } catch (error: any) {
      console.error('Failed to verify OTP', error);
      throw new Error(error.response?.data?.message || 'Verification failed');
    }
  },

  deleteAccount: async (idToken: string, firebaseUid: string) => {
    try {
      // Backend leg — migrated to apiClient (Plan 04-05).
      await apiClient.delete(`/api/users/${firebaseUid}`);
      // Identity Toolkit leg — stays on plain axios (Firebase Web API key surface).
      await axios.post(`${AUTH_URL}:delete?key=${API_KEY}`, { idToken });
      return true;
    } catch (error: any) {
      console.error('Delete Account Error:', error.response?.data || error.message);
      throw new Error('Failed to delete account');
    }
  },

  // --- Admin Methods ---

  getAdminStatus: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get(`/api/admin/status/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to check admin status', error);
      return { isAdmin: false };
    }
  },

  getAdminRequests: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get('/api/admin/requests', { params: { uid: firebaseUid } });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch admin requests', error);
      throw error;
    }
  },

  approveRequest: async (callerUid: string, targetUid: string, type: string) => {
    try {
      const response = await apiClient.post(`/api/admin/requests/${targetUid}/approve`, { callerUid, type });
      return response.data;
    } catch (error) {
      console.error('Failed to approve request', error);
      throw error;
    }
  },

  rejectRequest: async (callerUid: string, targetUid: string, type: string) => {
    try {
      const response = await apiClient.post(`/api/admin/requests/${targetUid}/reject`, { callerUid, type });
      return response.data;
    } catch (error) {
      console.error('Failed to reject request', error);
      throw error;
    }
  },

  getAdminUsers: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get('/api/admin/users', { params: { uid: firebaseUid } });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch admin users', error);
      throw error;
    }
  },

  addAdminUser: async (callerUid: string, email: string) => {
    try {
      const response = await apiClient.post('/api/admin/users', { callerUid, email });
      return response.data;
    } catch (error) {
      console.error('Failed to add admin user', error);
      throw error;
    }
  },

  removeAdminUser: async (callerUid: string, adminId: string) => {
    try {
      const response = await apiClient.delete(`/api/admin/users/${adminId}`, { params: { uid: callerUid } });
      return response.data;
    } catch (error) {
      console.error('Failed to remove admin user', error);
      throw error;
    }
  },

  // --- Payment Methods ---

  createPaymentIntent: async (currency: string, carId: string, buyerUid: string) => {
    try {
      const response = await apiClient.post('/api/payments/create-payment-intent', {
        currency,
        carId,
        buyerUid,
      }, { timeout: 30000 });
      return response.data;
    } catch (error) {
      console.error('Failed to create payment intent', error);
      throw error;
    }
  },

  confirmBooking: async (paymentIntentId: string, carId: string, buyerUid: string) => {
    try {
      const response = await apiClient.post('/api/payments/confirm-booking', {
        paymentIntentId,
        carId,
        buyerUid,
      }, { timeout: 30000 });
      return response.data;
    } catch (error) {
      console.error('Failed to confirm booking', error);
      throw error;
    }
  },

  // --- Order Methods ---

  createOrders: async (payload: { buyerUid: string; car: any; items: any[]; buyerNote?: string }) => {
    try {
      const response = await apiClient.post('/api/orders', payload);
      return response.data;
    } catch (error) {
      console.error('Failed to create orders', error);
      throw error;
    }
  },

  getBuyerOrders: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get(`/api/orders/buyer/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch buyer orders', error);
      throw error;
    }
  },

  getProviderOrders: async (firebaseUid: string) => {
    try {
      const response = await apiClient.get(`/api/orders/provider/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch provider orders', error);
      throw error;
    }
  },

  updateOrderStatus: async (orderId: string, status: string, callerUid: string) => {
    try {
      const response = await apiClient.patch(`/api/orders/${orderId}/status`, { status, callerUid });
      return response.data;
    } catch (error) {
      console.error('Failed to update order status', error);
      throw error;
    }
  },

  updateServiceStatus: async (orderId: string, serviceIndex: number, status: string, callerUid: string) => {
    try {
      const response = await apiClient.patch(`/api/orders/${orderId}/services/${serviceIndex}/status`, { status, callerUid });
      return response.data;
    } catch (error) {
      console.error('Failed to update service status', error);
      throw error;
    }
  },

  // Public total-member count for the home-screen social-proof strip.
  // Returns { count, growthPct, avatars } or null on failure (caller hides the
  // strip when null — e.g. before the backend route is deployed to prod).
  // `avatars` is up to 5 real https avatar URLs (providers + users with a photo).
  getMemberStats: async (): Promise<{ count: number; growthPct: number; avatars: string[] } | null> => {
    try {
      const response = await apiClient.get('/api/stats/users');
      const { count, growthPct, avatars } = response.data ?? {};
      if (typeof count !== 'number' || typeof growthPct !== 'number') return null;
      const safeAvatars = Array.isArray(avatars)
        ? avatars.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
        : [];
      return { count, growthPct, avatars: safeAvatars };
    } catch (error) {
      console.error('Failed to fetch member stats', error);
      return null;
    }
  },
};

