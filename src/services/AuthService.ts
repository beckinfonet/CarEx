import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

