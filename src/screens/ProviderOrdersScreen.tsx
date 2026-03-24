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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft, Package, Car, User, XCircle, Clock, CheckCircle, AlertCircle, Play, Check,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';
import { RootStackParamList } from '../types/navigation';

const STATUS_CONFIG: Record<string, { color: string; icon: any; labelKey: string }> = {
  pending:     { color: '#F59E0B', icon: Clock,       labelKey: 'orderPending' },
  accepted:    { color: '#3B82F6', icon: CheckCircle, labelKey: 'orderAccepted' },
  in_progress: { color: '#8B5CF6', icon: Package,     labelKey: 'orderInProgress' },
  completed:   { color: '#10B981', icon: CheckCircle, labelKey: 'orderCompleted' },
  cancelled:   { color: '#6B7280', icon: XCircle,     labelKey: 'orderCancelled' },
  rejected:    { color: '#EF4444', icon: AlertCircle,  labelKey: 'orderRejected' },
};

const NEXT_STATUS: Record<string, { key: string; label: string; color: string }> = {
  pending:     { key: 'accepted',    label: 'Accept',      color: '#3B82F6' },
  accepted:    { key: 'in_progress', label: 'Start Work',  color: '#8B5CF6' },
  in_progress: { key: 'completed',   label: 'Complete',    color: '#10B981' },
};

export const ProviderOrdersScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user?.localId) return;
    try {
      const data = await AuthService.getProviderOrders(user.localId);
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateStatus = async (order: any, newStatus: string) => {
    try {
      await AuthService.updateOrderStatus(order.id || order._id, newStatus, user!.localId);
      fetchOrders();
    } catch {
      Alert.alert(t.error, 'Failed to update');
    }
  };

  const handleReject = (order: any) => {
    Alert.alert(t.reject, t.confirmCancelOrder, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.reject,
        style: 'destructive',
        onPress: () => updateStatus(order, 'rejected'),
      },
    ]);
  };

  const formatFee = (fee: any, currency?: string) => {
    if (fee === 'contact') return t.feeTypeContact;
    if (!fee || fee === '' || fee === '0' || fee === 0) return '-';
    return `${currency || '$'}${fee}`;
  };

  const renderOrder = ({ item }: { item: any }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const StatusIcon = config.icon;
    const statusLabel = (t as any)[config.labelKey] || item.status;
    const next = NEXT_STATUS[item.status];
    const canReject = item.status === 'pending';

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberRow}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
              <StatusIcon size={12} color={config.color} />
              <Text style={[styles.statusText, { color: config.color }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.buyerRow}>
          {item.buyerAvatar ? (
            <Image source={{ uri: item.buyerAvatar }} style={styles.buyerAvatar} />
          ) : (
            <View style={styles.buyerAvatarPlaceholder}><User size={16} color={COLORS.textSecondary} /></View>
          )}
          <View style={styles.buyerInfo}>
            <Text style={styles.buyerName}>{item.buyerName || item.buyerEmail || 'Buyer'}</Text>
            {item.buyerPhone ? <Text style={styles.buyerContact}>{item.buyerPhone}</Text> : null}
          </View>
        </View>

        {item.carSnapshot ? (
          <View style={styles.carRow}>
            <Car size={16} color={COLORS.textSecondary} />
            <Text style={styles.carText}>
              {item.carSnapshot.year} {item.carSnapshot.makeName} {item.carSnapshot.modelName}
            </Text>
            {item.carSnapshot.imageUrl ? (
              <Image source={{ uri: item.carSnapshot.imageUrl }} style={styles.carThumb} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.servicesList}>
          {(item.services || []).map((svc: any, i: number) => (
            <View key={i} style={styles.serviceRow}>
              <Text style={styles.svcName}>{svc.name}</Text>
              <Text style={styles.svcFee}>{formatFee(svc.fee, svc.currency)}</Text>
            </View>
          ))}
        </View>

        {item.totalAmount > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.subtotal}</Text>
            <Text style={styles.totalValue}>{item.totalCurrency}{item.totalAmount}</Text>
          </View>
        ) : null}

        {item.buyerNote ? (
          <Text style={styles.noteText}>{item.buyerNote}</Text>
        ) : null}

        {(next || canReject) ? (
          <View style={styles.actionRow}>
            {canReject ? (
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                <XCircle size={16} color="#EF4444" />
                <Text style={styles.rejectText}>{t.reject}</Text>
              </TouchableOpacity>
            ) : null}
            {next ? (
              <TouchableOpacity
                style={[styles.advanceBtn, { backgroundColor: next.color }]}
                onPress={() => updateStatus(item, next.key)}>
                {next.key === 'completed' ? <Check size={16} color="#FFF" /> : <Play size={16} color="#FFF" />}
                <Text style={styles.advanceText}>{next.label}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.incomingOrders}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Package size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>{t.noOrders}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id || item._id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SIZES.padding, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backButton: { padding: 8 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '500' },
  listContent: { padding: SIZES.padding, paddingBottom: 40 },
  orderCard: {
    backgroundColor: COLORS.cardBackground, borderRadius: SIZES.borderRadius,
    padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  orderHeader: { marginBottom: 10 },
  orderNumberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  orderNumber: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderDate: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  buyerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  buyerAvatar: { width: 36, height: 36, borderRadius: 18 },
  buyerAvatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.searchBackground, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  buyerInfo: { flex: 1 },
  buyerName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  buyerContact: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  carRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  carText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500', flex: 1 },
  carThumb: { width: 44, height: 32, borderRadius: 4 },
  servicesList: {
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8,
  },
  serviceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  svcName: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  svcFee: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  totalLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  totalValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  noteText: {
    color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  rejectText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  advanceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1, paddingVertical: 10, borderRadius: 8,
  },
  advanceText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
