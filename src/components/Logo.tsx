import React from 'react';
import { Image } from 'react-native';

export const Logo = ({ size = 100, color }: { size?: number, color?: string }) => (
  <Image
    source={require('../assets/logo.png')}
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);
