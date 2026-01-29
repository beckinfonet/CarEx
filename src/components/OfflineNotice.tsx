import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useNetwork } from '../hooks/useNetwork';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

export const OfflineNotice = () => {
  const isConnected = useNetwork();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  if (isConnected) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, height: 44 + insets.top }]}>
      <WifiOff size={16} color="#FFF" style={styles.icon} />
      <Text style={styles.text}>{t.noInternet}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#b52424',
    width: width,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    zIndex: 9999, // Ensure it sits on top of everything
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  icon: {
    marginRight: 8,
  },
});

