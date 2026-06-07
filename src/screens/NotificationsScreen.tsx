import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

/**
 * PLACEHOLDER screen — Phase 12 Plan 12-06.
 *
 * This is a minimal default-export so App.tsx can register the `Notifications`
 * route and compile NOW. The REAL notification-center screen (feed list,
 * pull-to-refresh, mark-all-read, deep-link taps) lands in Plan 12-08 (Wave 5),
 * which OVERWRITES this file. Do not build the full screen here.
 */
const NotificationsScreen = () => {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.notifications}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
});

export default NotificationsScreen;
