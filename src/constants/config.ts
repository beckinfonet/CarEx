import { Platform } from 'react-native';

const ENV = {
  dev: {
    apiUrl: Platform.OS === 'ios' ? 'http://localhost:5001' : 'http://10.0.2.2:5001',
  },
  prod: {
    apiUrl: 'https://carex-services-production.up.railway.app',
  }
};

// Change this to 'prod' before building for App Store
const currentEnv = 'prod';

export const API_URL = ENV[currentEnv].apiUrl;

// Web platform & deep linking
export const WEB_BASE_URL = 'https://www.carexmarket.com';
export const LISTING_URL = (carId: string) => `${WEB_BASE_URL}/listing/${carId}`;

// App store URLs
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.carex.market';
export const APP_STORE_URL = 'https://apps.apple.com/app/carex-marketplace/id6758438618';

