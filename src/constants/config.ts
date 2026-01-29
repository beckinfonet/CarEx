import { Platform } from 'react-native';

const ENV = {
  dev: {
    apiUrl: Platform.OS === 'ios' ? 'http://localhost:5001' : 'http://10.0.2.2:5001',
  },
  prod: {
    apiUrl: 'https://api.carex.com', // TODO: Replace with actual production URL
  }
};

// Change this to 'prod' before building for App Store
const currentEnv = 'dev'; 

export const API_URL = ENV[currentEnv].apiUrl;

