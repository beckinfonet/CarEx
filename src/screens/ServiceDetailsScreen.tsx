import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft, Briefcase, Truck, Phone, MessageCircle, Send, User, MapPin } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { RootStackParamList } from '../types/navigation';

export const ServiceDetailsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceDetails'>>();
  const { provider, type } = route.params;
  const isBroker = type === 'broker';

  const handleCall = () => {
    if (!provider.phoneNumber) return;
    Linking.openURL(`tel:${provider.phoneNumber}`).catch(() => Alert.alert(t.error, 'Cannot open dialer'));
  };

  const handleWhatsApp = () => {
    if (!provider.phoneNumber) return;
    const cleaned = provider.phoneNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() => Alert.alert(t.error, 'Cannot open WhatsApp'));
  };

  const handleTelegram = () => {
    if (!provider.telegramUsername) return;
    Linking.openURL(`https://t.me/${provider.telegramUsername}`).catch(() => Alert.alert(t.error, 'Cannot open Telegram'));
  };

  const formatFee = (fee: any, currency?: string) => {
    if (fee === 'contact') return t.feeTypeContact;
    if (!fee || fee === '' || fee === '0' || fee === 0) return '-';
    return `${currency || '$'}${fee}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{provider.companyName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.profileSection}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              {provider.ownerAvatarUrl ? (
                <Image source={{ uri: provider.ownerAvatarUrl }} style={styles.avatar} />
              ) : (
                <User size={32} color={COLORS.textSecondary} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.companyName}>{provider.companyName}</Text>
              {provider.ownerName ? <Text style={styles.ownerName}>{provider.ownerName}</Text> : null}
            </View>
            <View style={styles.typeBadge}>
              {isBroker ? <Briefcase size={14} color={COLORS.accent} /> : <Truck size={14} color="#F59E0B" />}
              <Text style={[styles.typeBadgeText, !isBroker && { color: '#F59E0B' }]}>
                {isBroker ? t.broker : t.logisticsPartner}
              </Text>
            </View>
          </View>

          {provider.description ? (
            <Text style={styles.description}>{provider.description}</Text>
          ) : null}
        </View>

        {provider.services && provider.services.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.servicesOffered}</Text>
            {provider.services.map((s: any, i: number) => (
              <View key={i} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  {s.description ? <Text style={styles.serviceDesc}>{s.description}</Text> : null}
                </View>
                <View style={styles.feeBadge}>
                  <Text style={styles.feeText}>{formatFee(s.fee, s.currency)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {provider.coverageAreas && provider.coverageAreas.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coverage Areas</Text>
            <View style={styles.tagsRow}>
              {provider.coverageAreas.map((a: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <MapPin size={12} color={COLORS.textSecondary} />
                  <Text style={styles.tagText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {(provider.phoneNumber || provider.telegramUsername) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.contactInfo}</Text>
            <View style={styles.contactButtons}>
              {provider.phoneNumber ? (
                <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                  <Phone size={20} color="#FFF" />
                  <View style={styles.contactBtnInfo}>
                    <Text style={styles.contactBtnLabel}>{t.phone}</Text>
                    <Text style={styles.contactBtnValue}>{provider.phoneNumber}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {provider.phoneNumber ? (
                <TouchableOpacity style={[styles.contactBtn, styles.whatsappBtn]} onPress={handleWhatsApp}>
                  <MessageCircle size={20} color="#FFF" />
                  <View style={styles.contactBtnInfo}>
                    <Text style={styles.contactBtnLabel}>WhatsApp</Text>
                    <Text style={styles.contactBtnValue}>{provider.phoneNumber}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {provider.telegramUsername ? (
                <TouchableOpacity style={[styles.contactBtn, styles.telegramBtn]} onPress={handleTelegram}>
                  <Send size={20} color="#FFF" />
                  <View style={styles.contactBtnInfo}>
                    <Text style={styles.contactBtnLabel}>Telegram</Text>
                    <Text style={styles.contactBtnValue}>@{provider.telegramUsername}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
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
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  profileSection: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.searchBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  profileInfo: {
    flex: 1,
  },
  companyName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  ownerName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  section: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  serviceDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  feeBadge: {
    backgroundColor: COLORS.searchBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feeText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.searchBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  contactButtons: {
    gap: 10,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 10,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  telegramBtn: {
    backgroundColor: '#2AABEE',
  },
  contactBtnInfo: {
    flex: 1,
  },
  contactBtnLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  contactBtnValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 1,
  },
});
