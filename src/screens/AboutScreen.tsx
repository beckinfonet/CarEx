import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ExternalLink } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { Logo } from '../components/Logo';

export const AboutScreen = () => {
  const navigation = useNavigation();

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>О приложении</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.logoContainer}>
          <Logo size={120} color={COLORS.accent} />
          <Text style={styles.appName}>CarEx</Text>
          <Text style={styles.version}>Версия 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Правовая информация</Text>

          <TouchableOpacity style={styles.linkItem} onPress={() => openLink('https://www.carexmarket.com/t&c')}>
            <View>
              <Text style={styles.linkText}>Условия использования</Text>
              <Text style={styles.linkSubtext}>Terms of Service</Text>
            </View>
            <ExternalLink size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.linkItem} onPress={() => openLink('https://www.carexmarket.com/privacy')}>
            <View>
              <Text style={styles.linkText}>Политика конфиденциальности</Text>
              <Text style={styles.linkSubtext}>Privacy Policy</Text>
            </View>
            <ExternalLink size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Контакты</Text>
          <Text style={styles.contactText}>
            Если у вас есть вопросы или предложения, свяжитесь с нами:
          </Text>
          <TouchableOpacity onPress={() => openLink('mailto:support@carexmarket.com')}>
            <Text style={styles.emailText}>support@carexmarket.com</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.copyright}>© 2024 CarEx Inc. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  appName: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
  },
  version: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 8,
  },
  section: {
    marginBottom: 32,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  linkSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  contactText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 24,
  },
  emailText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: 'bold',
  },
  copyright: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
});

