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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft, Package, Car, User, XCircle, Clock, CheckCircle,
  AlertCircle, AlertTriangle, ChevronDown,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { OptimizedImage } from '../components/OptimizedImage';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';
import { RootStackParamList } from '../types/navigation';

const ORDER_STATUS_CONFIG: Record<string, { color: string; icon: any; labelKey: string }> = {
  pending:     { color: '#F59E0B', icon: Clock,        labelKey: 'orderPending' },
  accepted:    { color: '#3B82F6', icon: CheckCircle,  labelKey: 'orderAccepted' },
  in_progress: { color: '#8B5CF6', icon: Package,      labelKey: 'orderInProgress' },
  completed:   { color: '#10B981', icon: CheckCircle,  labelKey: 'orderCompleted' },
  cancelled:   { color: '#6B7280', icon: XCircle,      labelKey: 'orderCancelled' },
  rejected:    { color: '#EF4444', icon: AlertCircle,   labelKey: 'orderRejected' },
};

const SVC_STATUS_CONFIG: Record<string, { color: string; icon: any; labelKey: string }> = {
  pending:     { color: '#F59E0B', icon: Clock,          labelKey: 'svcPending' },
  in_progress: { color: '#8B5CF6', icon: Package,        labelKey: 'svcInProgress' },
  blocked:     { color: '#EF4444', icon: AlertTriangle,   labelKey: 'svcBlocked' },
  completed:   { color: '#10B981', icon: CheckCircle,    labelKey: 'svcCompleted' },
  cancelled:   { color: '#6B7280', icon: XCircle,        labelKey: 'svcCancelled' },
};

const SVC_STATUS_OPTIONS = ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'];

export const ProviderOrdersScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ orderId: string; serviceIndex: number; currentStatus: string } | null>(null);

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

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const handleServiceStatusChange = async (newStatus: string) => {
    if (!pickerTarget || !user?.localId) return;
    setPickerTarget(null);
    try {
      await AuthService.updateServiceStatus(pickerTarget.orderId, pickerTarget.serviceIndex, newStatus, user.localId);
      fetchOrders();
    } catch {
      Alert.alert(t.error, 'Failed to update status');
    }
  };

  const handleRejectOrder = (order: any) => {
    Alert.alert(t.reject, t.confirmCancelOrder, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.reject,
        style: 'destructive',
        onPress: async () => {
          try {
            await AuthService.updateOrderStatus(order.id || order._id, 'rejected', user!.localId);
            fetchOrders();
          } catch {
            Alert.alert(t.error, 'Failed to reject');
          }
        },
      },
    ]);
  };

  const formatFee = (fee: any, currency?: string) => {
    if (fee === 'contact') return t.feeTypeContact;
    if (!fee || fee === '' || fee === '0' || fee === 0) return '-';
    return `${currency || '$'}${fee}`;
  };

  const renderOrder = ({ item }: { item: any }) => {
    const orderConfig = ORDER_STATUS_CONFIG[item.status] || ORDER_STATUS_CONFIG.pending;
    const OrderStatusIcon = orderConfig.icon;
    const orderLabel = (t as any)[orderConfig.labelKey] || item.status;
    const isTerminal = ['completed', 'cancelled', 'rejected'].includes(item.status);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberRow}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: orderConfig.color + '20' }]}>
              <OrderStatusIcon size={12} color={orderConfig.color} />
              <Text style={[styles.statusText, { color: orderConfig.color }]}>{orderLabel}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
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
              <OptimizedImage source={{ uri: item.carSnapshot.imageUrl }} style={styles.carThumb} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.servicesList}>
          {(item.services || []).map((svc: any, i: number) => {
            const svcConfig = SVC_STATUS_CONFIG[svc.status || 'pending'] || SVC_STATUS_CONFIG.pending;
            const SvcIcon = svcConfig.icon;
            const svcLabel = (t as any)[svcConfig.labelKey] || svc.status || 'pending';

            return (
              <View key={i} style={styles.svcRow}>
                <View style={styles.svcInfo}>
                  <Text style={styles.svcName}>{svc.name}</Text>
                  <Text style={styles.svcFee}>{formatFee(svc.fee, svc.currency)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.svcStatusBtn, { borderColor: svcConfig.color }]}
                  disabled={isTerminal}
                  onPress={() => setPickerTarget({ orderId: item.id || item._id, serviceIndex: i, currentStatus: svc.status || 'pending' })}>
                  <SvcIcon size={12} color={svcConfig.color} />
                  <Text style={[styles.svcStatusLabel, { color: svcConfig.color }]}>{svcLabel}</Text>
                  {!isTerminal ? <ChevronDown size={12} color={svcConfig.color} /> : null}
                </TouchableOpacity>
              </View>
            );
          })}
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

        {item.status === 'pending' ? (
          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectOrder(item)}>
            <XCircle size={16} color="#EF4444" />
            <Text style={styles.rejectText}>{t.reject}</Text>
          </TouchableOpacity>
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

      <Modal visible={!!pickerTarget} transparent animationType="fade" onRequestClose={() => setPickerTarget(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerTarget(null)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>{t.updateStatus}</Text>
            {SVC_STATUS_OPTIONS.map(statusKey => {
              const cfg = SVC_STATUS_CONFIG[statusKey];
              const Icon = cfg.icon;
              const label = (t as any)[cfg.labelKey] || statusKey;
              const isCurrent = pickerTarget?.currentStatus === statusKey;
              return (
                <TouchableOpacity
                  key={statusKey}
                  style={[styles.pickerOption, isCurrent && styles.pickerOptionCurrent]}
                  onPress={() => handleServiceStatusChange(statusKey)}>
                  <Icon size={18} color={cfg.color} />
                  <Text style={[styles.pickerOptionText, { color: cfg.color }]}>{label}</Text>
                  {isCurrent ? <Text style={styles.pickerCurrentMark}>●</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
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
  orderNumberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  servicesList: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 },
  svcRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  svcInfo: { flex: 1, marginRight: 10 },
  svcName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' },
  svcFee: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  svcStatusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1,
  },
  svcStatusLabel: { fontSize: 12, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, marginTop: 4,
  },
  totalLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  totalValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  noteText: {
    color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  rejectText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16,
  },
  pickerTitle: {
    color: COLORS.textPrimary, fontSize: 16, fontWeight: '700',
    marginBottom: 16, textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
  },
  pickerOptionCurrent: {
    backgroundColor: COLORS.searchBackground,
  },
  pickerOptionText: { fontSize: 15, fontWeight: '600', flex: 1 },
  pickerCurrentMark: { color: COLORS.accent, fontSize: 10 },
});
