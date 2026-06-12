import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { RequestService, RedactedCarRequest } from '../services/requests/RequestService';
import { RootStackParamList } from '../types/navigation';

type DetailRoute = RouteProp<RootStackParamList, 'CarRequestDetails'>;

export const CarRequestDetailsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();
  const { requestId } = route.params;

  const [request, setRequest] = useState<RedactedCarRequest | null>(null);
  const [unlockPrice, setUnlockPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('KGS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_approved' | 'not_found' | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await RequestService.getRequestDetail(requestId);
      setRequest(res.request);
      setUnlockPrice(res.unlockPrice);
      setCurrency(res.currency);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setError('not_approved');
      } else {
        setError('not_found');
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleUnlock = () => {
    // Slice 3 replaces this stub with the Stripe payment-intent + confirm flow.
    Alert.alert(t.unlockContact, t.unlockComingSoon);
  };

  const renderSpec = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return (
      <View style={styles.specRow} key={label}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{String(value)}</Text>
      </View>
    );
  };

  const budgetText = (req: RedactedCarRequest) =>
    req.budgetMin
      ? `${req.budgetMin.toLocaleString()} – ${req.budgetMax.toLocaleString()} ${req.currency}`
      : `${req.budgetMax.toLocaleString()} ${req.currency}`;

  const yearText = (req: RedactedCarRequest) => {
    if (req.yearMin && req.yearMax) {return `${req.yearMin}–${req.yearMax}`;}
    if (req.yearMin) {return `${req.yearMin}+`;}
    if (req.yearMax) {return `≤ ${req.yearMax}`;}
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.requestDetails}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.accent} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>{error === 'not_approved' ? t.sellersOnly : t.noOpenRequests}</Text>
        </View>
      ) : request ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>
            {request.makeName}
            {request.modelName ? ` ${request.modelName}` : ` · ${t.anyModel}`}
          </Text>

          <Text style={styles.section}>{t.specifications}</Text>
          {renderSpec(t.budget, budgetText(request))}
          {renderSpec(`${t.yearFrom} / ${t.yearTo}`, yearText(request))}
          {renderSpec(t.exteriorColor, request.exteriorColor)}
          {renderSpec(t.interiorColor, request.interiorColor)}
          {renderSpec(t.interiorMaterial, request.interiorMaterial)}
          {renderSpec(t.engine, request.engine)}
          {renderSpec(t.fuel, request.fuel)}
          {renderSpec(t.requestNote, request.note)}

          <View style={styles.contactBox}>
            <View style={styles.contactHeaderRow}>
              <Lock size={18} color={COLORS.textSecondary} />
              <Text style={styles.contactHidden}>{t.contactHidden}</Text>
            </View>
            <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} activeOpacity={0.85}>
              <Text style={styles.unlockBtnText}>
                {t.unlockContact}
                {unlockPrice != null ? ` · ${unlockPrice.toLocaleString()} ${currency}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 24 },
  body: { padding: SIZES.padding },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  section: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  specLabel: { color: COLORS.textSecondary, fontSize: 14 },
  specValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  contactBox: {
    marginTop: 24,
    padding: SIZES.padding,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  contactHidden: { color: COLORS.textSecondary, fontSize: 14 },
  unlockBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.padding },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
});
