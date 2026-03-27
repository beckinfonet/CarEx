import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/config';

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
    await AsyncStorage.removeItem('userData');
  },

  // Backend User Methods
  createBackendUser: async (firebaseUid: string, email: string) => {
    try {
      await axios.post(`${API_URL}/api/users`, { firebaseUid, email });
    } catch (error) {
      console.error('Failed to create backend user', error);
    }
  },

  getBackendUser: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/users/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get backend user', error);
      return null;
    }
  },

  updateBackendUser: async (firebaseUid: string, data: any) => {
    try {
      const response = await axios.put(`${API_URL}/api/users/${firebaseUid}`, data);
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
      const response = await axios.post(`${API_URL}/api/users/${firebaseUid}/avatar`, formData, {
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
      const response = await axios.post(`${API_URL}/api/users/${firebaseUid}/request-seller`);
      return response.data;
    } catch (error) {
      console.error('Failed to request seller status', error);
      throw error;
    }
  },

  requestBrokerStatus: async (firebaseUid: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/users/${firebaseUid}/request-broker`);
      return response.data;
    } catch (error) {
      console.error('Failed to request broker status', error);
      throw error;
    }
  },

  requestLogisticsStatus: async (firebaseUid: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/users/${firebaseUid}/request-logistics`);
      return response.data;
    } catch (error) {
      console.error('Failed to request logistics status', error);
      throw error;
    }
  },

  getBrokerProfile: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/brokers/${firebaseUid}`);
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
      const response = await axios.put(`${API_URL}/api/brokers/${firebaseUid}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update broker profile', error);
      throw error;
    }
  },

  getLogisticsProfile: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/logistics/${firebaseUid}`);
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
      const response = await axios.put(`${API_URL}/api/logistics/${firebaseUid}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update logistics profile', error);
      throw error;
    }
  },

  sendOtp: async (phoneNumber: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/otp/send`, { phoneNumber });
      return response.data;
    } catch (error) {
      console.error('Failed to send OTP', error);
      throw error;
    }
  },

  verifyOtp: async (phoneNumber: string, code: string, firebaseUid: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/otp/verify`, { phoneNumber, code, firebaseUid });
      return response.data;
    } catch (error: any) {
      console.error('Failed to verify OTP', error);
      throw new Error(error.response?.data?.message || 'Verification failed');
    }
  },

  deleteAccount: async (idToken: string, firebaseUid: string) => {
    try {
      await axios.delete(`${API_URL}/api/users/${firebaseUid}`);
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
      const response = await axios.get(`${API_URL}/api/admin/status/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to check admin status', error);
      return { isAdmin: false };
    }
  },

  getAdminRequests: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/requests`, { params: { uid: firebaseUid } });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch admin requests', error);
      throw error;
    }
  },

  approveRequest: async (callerUid: string, targetUid: string, type: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/requests/${targetUid}/approve`, { callerUid, type });
      return response.data;
    } catch (error) {
      console.error('Failed to approve request', error);
      throw error;
    }
  },

  rejectRequest: async (callerUid: string, targetUid: string, type: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/requests/${targetUid}/reject`, { callerUid, type });
      return response.data;
    } catch (error) {
      console.error('Failed to reject request', error);
      throw error;
    }
  },

  getAdminUsers: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/users`, { params: { uid: firebaseUid } });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch admin users', error);
      throw error;
    }
  },

  addAdminUser: async (callerUid: string, email: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/users`, { callerUid, email });
      return response.data;
    } catch (error) {
      console.error('Failed to add admin user', error);
      throw error;
    }
  },

  removeAdminUser: async (callerUid: string, adminId: string) => {
    try {
      const response = await axios.delete(`${API_URL}/api/admin/users/${adminId}`, { params: { uid: callerUid } });
      return response.data;
    } catch (error) {
      console.error('Failed to remove admin user', error);
      throw error;
    }
  },

  // --- Payment Methods ---

  createPaymentIntent: async (currency: string, carId: string, buyerUid: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/payments/create-payment-intent`, {
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
      const response = await axios.post(`${API_URL}/api/payments/confirm-booking`, {
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
      const response = await axios.post(`${API_URL}/api/orders`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to create orders', error);
      throw error;
    }
  },

  getBuyerOrders: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/buyer/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch buyer orders', error);
      throw error;
    }
  },

  getProviderOrders: async (firebaseUid: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/provider/${firebaseUid}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch provider orders', error);
      throw error;
    }
  },

  updateOrderStatus: async (orderId: string, status: string, callerUid: string) => {
    try {
      const response = await axios.patch(`${API_URL}/api/orders/${orderId}/status`, { status, callerUid });
      return response.data;
    } catch (error) {
      console.error('Failed to update order status', error);
      throw error;
    }
  },

  updateServiceStatus: async (orderId: string, serviceIndex: number, status: string, callerUid: string) => {
    try {
      const response = await axios.patch(`${API_URL}/api/orders/${orderId}/services/${serviceIndex}/status`, { status, callerUid });
      return response.data;
    } catch (error) {
      console.error('Failed to update service status', error);
      throw error;
    }
  },
};

