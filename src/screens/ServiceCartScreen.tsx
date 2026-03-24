import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, ShoppingCart, Trash2, Car, X, Briefcase, Truck, CheckCircle } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { AuthService } from '../services/AuthService';
import { RootStackParamList } from '../types/navigation';

export const ServiceCartScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { car, items, removeItem, clearCart, getProviderGroups, itemCount } = useCart();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [buyerNote, setBuyerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const providerGroups = getProviderGroups();

  const formatFee = (fee: any, currency?: string) => {
    if (fee === 'contact') return t.feeTypeContact;
    if (!fee || fee === '' || fee === '0' || fee === 0) return '-';
    return `${currency || '$'}${fee}`;
  };

  const handleSubmit = async () => {
    if (!user?.localId) {
      navigation.navigate('Login');
      return;
    }
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        buyerUid: user.localId,
        car: car ? {
          id: car.id,
          makeName: car.makeName,
          modelName: car.modelName,
          year: car.year,
          price: car.price,
          currency: car.currency,
          imageUrl: car.imageUrl,
          listingId: car.listingId,
        } : null,
        items: items.map(i => ({
          providerUid: i.provider.ownerUid,
          providerType: i.provider.type,
          providerSnapshot: {
            companyName: i.provider.companyName,
            phoneNumber: i.provider.phoneNumber,
            telegramUsername: i.provider.telegramUsername,
          },
          service: {
            name: i.service.name,
            description: i.service.description,
            fee: i.service.fee,
            currency: i.service.currency,
          },
        })),
        buyerNote,
      };

      await AuthService.createOrders(payload);
      clearCart();
      setSubmitted(true);
    } catch {
      Alert.alert(t.error, 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.successContainer}>
          <CheckCircle size={64} color="#10B981" />
          <Text style={styles.successTitle}>{t.orderSubmitted}</Text>
          <Text style={styles.successHint}>{t.orderSubmittedHint}</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => navigation.navigate('MyOrders')}>
            <Text style={styles.successBtnText}>{t.viewMyOrders}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.successSecondaryBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.successSecondaryText}>{t.home}</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{t.cart}</Text>
        <View style={{ width: 40 }} />
      </View>

      {itemCount === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingCart size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>{t.emptyCart}</Text>
          <Text style={styles.emptyHint}>{t.emptyCartHint}</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Services')}>
            <Text style={styles.browseBtnText}>{t.services}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
            {car ? (
              <View style={styles.carCard}>
                <Car size={20} color={COLORS.accent} />
                <View style={styles.carInfo}>
                  <Text style={styles.carLabel}>{t.selectedVehicle}</Text>
                  <Text style={styles.carName}>{car.year} {car.makeName} {car.modelName}</Text>
                </View>
                {car.imageUrl ? (
                  <Image source={{ uri: car.imageUrl }} style={styles.carThumb} />
                ) : null}
              </View>
            ) : (
              <View style={styles.carCard}>
                <Car size={20} color={COLORS.textSecondary} />
                <Text style={styles.noCarText}>{t.independentOrder}</Text>
              </View>
            )}

            {providerGroups.map((group, gi) => (
              <View key={gi} style={styles.providerGroup}>
                <View style={styles.providerHeader}>
                  {group.provider.type === 'broker' ? (
                    <Briefcase size={18} color={COLORS.accent} />
                  ) : (
                    <Truck size={18} color="#F59E0B" />
                  )}
                  <Text style={styles.providerName}>{group.provider.companyName}</Text>
                </View>

                {group.services.map((svc, si) => (
                  <View key={si} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{svc.name}</Text>
                      {svc.description ? (
                        <Text style={styles.cartItemDesc} numberOfLines={1}>{svc.description}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.cartItemFee}>{formatFee(svc.fee, svc.currency)}</Text>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeItem(group.provider.ownerUid, group.provider.type, svc.name)}>
                      <X size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {group.subtotal > 0 ? (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>{t.subtotal}</Text>
                    <Text style={styles.subtotalValue}>{group.currency}{group.subtotal}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>{t.buyerNote}</Text>
              <TextInput
                style={styles.noteInput}
                placeholder={t.buyerNotePlaceholder}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={3}
                value={buyerNote}
                onChangeText={setBuyerNote}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerItemCount}>{itemCount} {t.services.toLowerCase()}</Text>
              <Text style={styles.footerProviders}>
                {providerGroups.length} {providerGroups.length === 1 ? 'provider' : 'providers'}
              </Text>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitText}>{t.submitOrder}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
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
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40,
  },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600' },
  emptyHint: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  browseBtn: {
    marginTop: 12, backgroundColor: COLORS.accent,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10,
  },
  browseBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  scrollContent: { flex: 1 },
  scrollContainer: { padding: SIZES.padding, paddingBottom: 100 },
  carCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBackground, borderRadius: SIZES.borderRadius,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  carInfo: { flex: 1 },
  carLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' },
  carName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  carThumb: { width: 50, height: 36, borderRadius: 6 },
  noCarText: { color: COLORS.textSecondary, fontSize: 14, flex: 1 },
  providerGroup: {
    backgroundColor: COLORS.cardBackground, borderRadius: SIZES.borderRadius,
    padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  providerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  providerName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  cartItemInfo: { flex: 1, marginRight: 10 },
  cartItemName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' },
  cartItemDesc: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  cartItemFee: { color: COLORS.accent, fontSize: 14, fontWeight: '600', marginRight: 10 },
  removeBtn: { padding: 6 },
  subtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, marginTop: 4,
  },
  subtotalLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  subtotalValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  noteSection: { marginTop: 4 },
  noteLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  noteInput: {
    backgroundColor: COLORS.cardBackground, borderRadius: SIZES.borderRadius,
    padding: 14, color: COLORS.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: COLORS.border,
    minHeight: 80, textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  footerInfo: {},
  footerItemCount: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  footerProviders: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  submitBtn: {
    backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 10, minWidth: 140, alignItems: 'center',
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  successContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40,
  },
  successTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  successHint: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  successBtn: {
    marginTop: 12, backgroundColor: COLORS.accent,
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10,
  },
  successBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  successSecondaryBtn: {
    paddingVertical: 12, paddingHorizontal: 32,
  },
  successSecondaryText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
});
