import React from 'react';
import { useUIVersion } from '../context/UIVersionContext';
import { HomeScreen } from './HomeScreen';
import { HomeScreenV2 } from './HomeScreenV2';

export const HomeScreenRouter = () => {
  const { version } = useUIVersion();
  return version === 'v2' ? <HomeScreenV2 /> : <HomeScreen />;
};
