import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUIVersion } from '../context/UIVersionContext';
import { SearchResultsV2 } from './SearchResultsV2';
import { RootStackParamList } from '../types/navigation';

export const SearchResultsRouter = () => {
  const { version } = useUIVersion();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // v1 doesn't have a search-results screen — redirect to Home.
  useEffect(() => {
    if (version === 'v1') {
      navigation.replace('Home', { clearFilters: false });
    }
  }, [version, navigation]);

  if (version === 'v1') return null;
  return <SearchResultsV2 />;
};
