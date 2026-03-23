import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, XCircle, Phone, Mail, Calendar, ShieldCheck } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';

type Tab = 'all' | 'seller' | 'broker' | 'logistics';

interface PendingRequest {
  firebaseUid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  telegramUsername?: string;
  isPhoneVerified?: boolean;
  createdAt?: string;
  requestType: string;
  requestDate?: string;
}

export const AdminDashboardScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [requests, setRequests] = useState<{ sellers: PendingRequest[]; brokers: PendingRequest[]; logistics: PendingRequest[] }>({ sellers: [], brokers: [], logistics: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user?.localId) return;
    try {
      const data = await AuthService.getAdminRequests(user.localId);
      setRequests(data);
    } catch {
      Alert.alert(t.error, 'Failed to load requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleApprove = (item: PendingRequest) => {
    const name = `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email;
    Alert.alert(
      t.confirmApprove,
      `${name} — ${getTypeLabel(item.requestType)}`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.approve,
          onPress: async () => {
            try {
              await AuthService.approveRequest(user.localId, item.firebaseUid, item.requestType);
              fetchRequests();
            } catch {
              Alert.alert(t.error, 'Failed to approve');
            }
          },
        },
      ],
    );
  };

  const handleReject = (item: PendingRequest) => {
    const name = `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email;
    Alert.alert(
      t.confirmReject,
      `${name} — ${getTypeLabel(item.requestType)}`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.reject,
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.rejectRequest(user.localId, item.firebaseUid, item.requestType);
              fetchRequests();
            } catch {
              Alert.alert(t.error, 'Failed to reject');
            }
          },
        },
      ],
    );
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'seller': return t.seller;
      case 'broker': return t.broker;
      case 'logistics': return t.logisticsPartner;
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'seller': return '#10B981';
      case 'broker': return COLORS.accent;
      case 'logistics': return '#F59E0B';
      default: return COLORS.textSecondary;
    }
  };

  const allRequests: PendingRequest[] = [
    ...requests.sellers,
    ...requests.brokers,
    ...requests.logistics,
  ].sort((a, b) => {
    const da = a.requestDate ? new Date(a.requestDate).getTime() : 0;
    const db = b.requestDate ? new Date(b.requestDate).getTime() : 0;
    return db - da;
  });

  const filteredRequests = activeTab === 'all'
    ? allRequests
    : activeTab === 'seller'
      ? requests.sellers
      : activeTab === 'broker'
        ? requests.brokers
        : requests.logistics;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: t.all, count: allRequests.length },
    { key: 'seller', label: t.sellers, count: requests.sellers.length },
    { key: 'broker', label: t.brokersTab, count: requests.brokers.length },
    { key: 'logistics', label: t.logisticsPartnersTab, count: requests.logistics.length },
  ];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const renderRequest = ({ item }: { item: PendingRequest }) => {
    const name = `${item.firstName || ''} ${item.lastName || ''}`.trim();
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.requestType) + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: getTypeColor(item.requestType) }]}>
              {getTypeLabel(item.requestType)}
            </Text>
          </View>
          <View style={styles.phoneBadge}>
            <ShieldCheck size={12} color={item.isPhoneVerified ? '#10B981' : COLORS.textSecondary} />
            <Text style={[styles.phoneBadgeText, { color: item.isPhoneVerified ? '#10B981' : COLORS.textSecondary }]}>
              {item.isPhoneVerified ? t.verified : t.notVerified}
            </Text>
          </View>
        </View>

        {name ? <Text style={styles.cardName}>{name}</Text> : null}

        <View style={styles.cardDetail}>
          <Mail size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>{item.email}</Text>
        </View>

        {item.phoneNumber ? (
          <View style={styles.cardDetail}>
            <Phone size={14} color={COLORS.textSecondary} />
            <Text style={styles.cardDetailText}>{item.phoneNumber}</Text>
          </View>
        ) : null}

        <View style={styles.cardDetail}>
          <Calendar size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>
            {t.requestDate}: {formatDate(item.requestDate)}
          </Text>
        </View>

        {item.createdAt ? (
          <View style={styles.cardDetail}>
            <Calendar size={14} color={COLORS.textSecondary} />
            <Text style={styles.cardDetailText}>
              {t.memberSince} {formatDate(item.createdAt)}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item)}>
            <XCircle size={16} color="#EF4444" />
            <Text style={styles.rejectText}>{t.reject}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveButton} onPress={() => handleApprove(item)}>
            <CheckCircle size={16} color="#FFF" />
            <Text style={styles.approveText}>{t.approve}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.pendingRequests}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
            {tab.count > 0 ? (
              <View style={[styles.badge, activeTab === tab.key && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === tab.key && styles.badgeTextActive]}>{tab.count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredRequests}
        renderItem={renderRequest}
        keyExtractor={(item, idx) => `${item.firebaseUid}-${item.requestType}-${idx}`}
        contentContainerStyle={filteredRequests.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <CheckCircle size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>{t.noPendingRequests}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 12,
    gap: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: COLORS.accent + '30',
  },
  badgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: COLORS.accent,
  },
  listContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  emptyContainer: {
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardDetailText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  rejectText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  approveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
