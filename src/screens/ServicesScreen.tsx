import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Briefcase, Truck, Phone, User, MessageCircle, Send, ChevronRight } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import axios from 'axios';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { useLanguage } from '../context/LanguageContext';

type Tab = 'brokers' | 'logistics';

interface ServiceProvider {
  id: string;
  companyName: string;
  description?: string;
  phoneNumber?: string;
  telegramUsername?: string;
  ownerName: string;
  ownerAvatarUrl?: string | null;
  ownerEmail?: string | null;
  services?: { name: string; description?: string; fee: number | string; currency?: string }[];
  coverageAreas?: string[];
  paymentOptions?: string[];
  timelines?: string;
}

export const ServicesScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<Tab>('brokers');
  const [brokers, setBrokers] = useState<ServiceProvider[]>([]);
  const [logistics, setLogistics] = useState<ServiceProvider[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(true);
  const [loadingLogistics, setLoadingLogistics] = useState(true);

  const fetchBrokers = useCallback(async () => {
    setLoadingBrokers(true);
    try {
      const res = await axios.get(`${API_URL}/api/brokers`);
      setBrokers(res.data);
    } catch (e) {
      console.error('Failed to fetch brokers', e);
    } finally {
      setLoadingBrokers(false);
    }
  }, []);

  const fetchLogistics = useCallback(async () => {
    setLoadingLogistics(true);
    try {
      const res = await axios.get(`${API_URL}/api/logistics`);
      setLogistics(res.data);
    } catch (e) {
      console.error('Failed to fetch logistics partners', e);
    } finally {
      setLoadingLogistics(false);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
    fetchLogistics();
  }, [fetchBrokers, fetchLogistics]);

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => Alert.alert(t.error, 'Cannot open dialer'));
  };

  const handleWhatsApp = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() => Alert.alert(t.error, 'Cannot open WhatsApp'));
  };

  const handleTelegram = (username?: string) => {
    if (!username) return;
    Linking.openURL(`https://t.me/${username}`).catch(() => Alert.alert(t.error, 'Cannot open Telegram'));
  };

  const renderProvider = ({ item }: { item: ServiceProvider }) => {
    const hasContacts = item.phoneNumber || item.telegramUsername;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            {item.ownerAvatarUrl ? (
              <Image source={{ uri: item.ownerAvatarUrl }} style={styles.avatar} />
            ) : (
              <User size={24} color={COLORS.textSecondary} />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.companyName}>{item.companyName}</Text>
            {item.ownerName ? <Text style={styles.ownerName}>{item.ownerName}</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => navigation.navigate('ServiceDetails', { provider: item, type: activeTab === 'brokers' ? 'broker' : 'logistics' })}>
            <ChevronRight size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        {item.services && item.services.length > 0 ? (
          <View style={styles.servicesList}>
            {item.services.map((s, i) => (
              <View key={i} style={styles.serviceItem}>
                <View style={styles.serviceItemLeft}>
                  <Text style={styles.serviceItemName}>{s.name}</Text>
                  {s.description ? (
                    <Text style={styles.serviceItemDesc} numberOfLines={1}>{s.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.serviceItemFee}>{s.fee === 'contact' ? t.feeTypeContact : (!s.fee || s.fee === '' || s.fee === '0') ? '-' : `${s.currency || '$'}${s.fee}`}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {item.coverageAreas && item.coverageAreas.length > 0 ? (
          <View style={styles.tags}>
            {item.coverageAreas.map((a, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{a}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {hasContacts ? (
          <View style={styles.contactRow}>
            {item.phoneNumber ? (
              <TouchableOpacity style={styles.contactButton} onPress={() => handleCall(item.phoneNumber)}>
                <Phone size={16} color="#FFF" />
                <Text style={styles.contactButtonText}>{t.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {item.phoneNumber ? (
              <TouchableOpacity style={[styles.contactButton, styles.whatsappButton]} onPress={() => handleWhatsApp(item.phoneNumber)}>
                <MessageCircle size={16} color="#FFF" />
                <Text style={styles.contactButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {item.telegramUsername ? (
              <TouchableOpacity style={[styles.contactButton, styles.telegramButton]} onPress={() => handleTelegram(item.telegramUsername)}>
                <Send size={16} color="#FFF" />
                <Text style={styles.contactButtonText}>Telegram</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const data = activeTab === 'brokers' ? brokers : logistics;
  const isLoading = activeTab === 'brokers' ? loadingBrokers : loadingLogistics;

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      );
    }

    const icon =
      activeTab === 'brokers' ? (
        <Briefcase size={48} color={COLORS.textSecondary} />
      ) : (
        <Truck size={48} color={COLORS.textSecondary} />
      );

    return (
      <View style={styles.emptyState}>
        {icon}
        <Text style={styles.emptyTitle}>
          {activeTab === 'brokers' ? t.brokers : t.logisticsTab}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'brokers' ? t.noBrokersYet : t.noLogisticsYet}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.services}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'brokers' && styles.activeTab]}
          onPress={() => setActiveTab('brokers')}>
          <Briefcase
            size={18}
            color={activeTab === 'brokers' ? COLORS.accent : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'brokers' && styles.activeTabText]}>
            {t.brokers}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'logistics' && styles.activeTab]}
          onPress={() => setActiveTab('logistics')}>
          <Truck
            size={18}
            color={activeTab === 'logistics' ? COLORS.accent : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'logistics' && styles.activeTabText]}>
            {t.logisticsTab}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        renderItem={renderProvider}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={data.length === 0 ? styles.listContentEmpty : styles.listContent}
      />
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  listContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.searchBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cardInfo: {
    flex: 1,
  },
  companyName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  ownerName: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  detailsButton: {
    padding: 8,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  telegramButton: {
    backgroundColor: '#2AABEE',
  },
  contactButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  servicesList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  serviceItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  serviceItemName: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  serviceItemDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  serviceItemFee: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: COLORS.searchBackground,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
