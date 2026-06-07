import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

/**
 * PLACEHOLDER screen — Phase 12 Plan 12-06.
 *
 * Minimal default-export so App.tsx can register the `NotificationSettings`
 * route and compile NOW. The REAL settings screen (master mute, category
 * toggles, cadence selector, saved-search / watched-car management with
 * delete confirms) lands in Plan 12-10 (Wave 5), which OVERWRITES this file.
 * Do not build the full screen here.
 */
const NotificationSettingsScreen = () => {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.notificationSettings}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
});

export default NotificationSettingsScreen;
