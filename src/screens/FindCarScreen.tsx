import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Smartphone } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MakeModelFormField } from '../components/MakeModelFormField';
import {
  RequestService,
  CreateRequestInput,
} from '../services/requests/RequestService';
import type { RootStackParamList } from '../types/navigation';

type FindCarRoute = RouteProp<RootStackParamList, 'FindCar'>;

interface FormState {
  makeId: string;
  modelId: string;
  yearMin: string;
  yearMax: string;
  budgetMin: string;
  budgetMax: string;
  currency: 'KGS' | 'USD';
  exteriorColor: string;
  interiorColor: string;
  interiorMaterial: string;
  engine: string;
  fuel: string;
  note: string;
  telegramUsername: string;
}

const CURRENCY_OPTIONS: { value: 'KGS' | 'USD'; flag: string }[] = [
  { value: 'KGS', flag: '🇰🇬' },
  { value: 'USD', flag: '🇺🇸' },
];

const EMPTY: FormState = {
  makeId: '',
  modelId: '',
  yearMin: '',
  yearMax: '',
  budgetMin: '',
  budgetMax: '',
  currency: 'KGS',
  exteriorColor: '',
  interiorColor: '',
  interiorMaterial: '',
  engine: '',
  fuel: '',
  note: '',
  telegramUsername: '',
};

function toNum(s: string): number | null {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
}

export const FindCarScreen = () => {
  const { t } = useLanguage();
  const { user, sendPhoneOtp, verifyPhone } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<FindCarRoute>();
  const requestId = route.params?.requestId;
  const isEdit = !!requestId;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await RequestService.getMyRequests();
        const found = rows.find((r) => r._id === requestId);
        if (found && !cancelled) {
          setForm({
            makeId: found.makeId ?? '',
            modelId: found.modelId ?? '',
            yearMin: found.yearMin?.toString() ?? '',
            yearMax: found.yearMax?.toString() ?? '',
            budgetMin: found.budgetMin?.toString() ?? '',
            budgetMax: found.budgetMax?.toString() ?? '',
            currency: found.currency === 'USD' ? 'USD' : 'KGS',
            exteriorColor: found.exteriorColor ?? '',
            interiorColor: found.interiorColor ?? '',
            interiorMaterial: found.interiorMaterial ?? '',
            engine: found.engine ?? '',
            fuel: found.fuel ?? '',
            note: found.note ?? '',
            telegramUsername: found.telegramUsername ?? '',
          });
        }
      } catch (e) {
        console.error('Failed to load request', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, requestId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleVerifyPhone = async () => {
    if (!user?.phoneNumber) {
      Alert.alert(t.error, t.verifyPhoneToPost);
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp();
      setOtpModalVisible(true);
    } catch {
      Alert.alert(t.error, t.verifyPhoneToPost);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert(t.error, t.wrongCode);
      return;
    }
    setVerifying(true);
    try {
      await verifyPhone(otpCode);
      setOtpModalVisible(false);
      setOtpCode('');
      Alert.alert(t.success, t.phoneVerified);
    } catch {
      Alert.alert(t.error, t.wrongCode);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.makeId || toNum(form.budgetMax) === null) {
      Alert.alert(t.error, t.requestValidationMissing);
      return;
    }
    const input: CreateRequestInput = {
      makeId: form.makeId,
      modelId: form.modelId || null,
      yearMin: toNum(form.yearMin),
      yearMax: toNum(form.yearMax),
      budgetMin: toNum(form.budgetMin),
      budgetMax: toNum(form.budgetMax) as number,
      currency: form.currency,
      exteriorColor: form.exteriorColor || null,
      interiorColor: form.interiorColor || null,
      interiorMaterial: form.interiorMaterial || null,
      engine: form.engine || null,
      fuel: form.fuel || null,
      note: form.note || null,
      telegramUsername: form.telegramUsername || null,
    };
    setSubmitting(true);
    try {
      const successMsg = isEdit ? t.requestUpdated : t.requestPosted;
      await (isEdit
        ? RequestService.updateRequest(requestId as string, input)
        : RequestService.createRequest(input));
      Alert.alert(t.success, successMsg, [
        { text: t.done, onPress: () => navigation.navigate('MyRequests') },
      ]);
    } catch (e: any) {
      const code = e?.response?.data?.error;
      if (code === 'phone_not_verified') {
        Alert.alert(t.error, t.verifyPhoneToPost);
      } else {
        Alert.alert(t.error, t.requestValidationMissing);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.localId) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.statusText}>{t.loginToPost}</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryBtnText}>{t.login}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!user.isPhoneVerified) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Smartphone size={64} color={COLORS.accent} />
        <Text style={styles.statusTitle}>{t.verifyPhoneToPost}</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleVerifyPhone}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryBtnText}>{t.verifyPhone}</Text>
          )}
        </TouchableOpacity>

        <Modal
          visible={otpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOtpModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t.enterCode}</Text>
                  <TouchableOpacity
                    onPress={() => setOtpModalVisible(false)}>
                    <X size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={submitOtp}
                  disabled={verifying}>
                  {verifying ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.primaryBtnText}>{t.verify}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator color={COLORS.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? t.editRequest : t.findCarHeader}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{t.desiredCar}</Text>
        <MakeModelFormField
          type="make"
          value={form.makeId}
          onChange={(id) => setForm((p) => ({ ...p, makeId: id, modelId: '' }))}
          placeholder={t.brand}
          t={t}
        />
        <MakeModelFormField
          type="model"
          value={form.modelId}
          onChange={(id) => set('modelId', id)}
          selectedMakeId={form.makeId}
          placeholder={t.model}
          t={t}
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder={t.yearFrom}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            value={form.yearMin}
            onChangeText={(v) => set('yearMin', v)}
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder={t.yearTo}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            value={form.yearMax}
            onChangeText={(v) => set('yearMax', v)}
          />
        </View>

        <Text style={styles.section}>{t.budget}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder={t.budgetMin}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            value={form.budgetMin}
            onChangeText={(v) => set('budgetMin', v)}
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder={t.budgetMax}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            value={form.budgetMax}
            onChangeText={(v) => set('budgetMax', v)}
          />
        </View>

        <Text style={styles.section}>{t.currency}</Text>
        <View style={styles.currencyRow}>
          {CURRENCY_OPTIONS.map((opt, idx) => {
            const active = form.currency === opt.value;
            const isLast = idx === CURRENCY_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.currencyPill,
                  isLast && styles.currencyPillLast,
                  active && styles.currencyPillActive,
                ]}
                onPress={() => set('currency', opt.value)}>
                <Text
                  style={[
                    styles.currencyPillText,
                    active && styles.currencyPillTextActive,
                  ]}>
                  {opt.flag} {opt.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.section}>{t.extInt}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.bodyColor}
          placeholderTextColor={COLORS.textSecondary}
          value={form.exteriorColor}
          onChangeText={(v) => set('exteriorColor', v)}
        />
        <TextInput
          style={styles.input}
          placeholder={t.interiorColorInput}
          placeholderTextColor={COLORS.textSecondary}
          value={form.interiorColor}
          onChangeText={(v) => set('interiorColor', v)}
        />
        <TextInput
          style={styles.input}
          placeholder={t.interiorMatLabel}
          placeholderTextColor={COLORS.textSecondary}
          value={form.interiorMaterial}
          onChangeText={(v) => set('interiorMaterial', v)}
        />
        <TextInput
          style={styles.input}
          placeholder={t.enterEngine}
          placeholderTextColor={COLORS.textSecondary}
          value={form.engine}
          onChangeText={(v) => set('engine', v)}
        />
        <TextInput
          style={styles.input}
          placeholder={t.fuel}
          placeholderTextColor={COLORS.textSecondary}
          value={form.fuel}
          onChangeText={(v) => set('fuel', v)}
        />

        <Text style={styles.section}>{t.requestNote}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={t.requestNotePlaceholder}
          placeholderTextColor={COLORS.textSecondary}
          multiline
          value={form.note}
          onChangeText={(v) => set('note', v)}
        />

        <TextInput
          style={styles.input}
          placeholder={t.telegramUsername}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          value={form.telegramUsername}
          onChangeText={(v) => set('telegramUsername', v)}
        />

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isEdit ? t.saveRequest : t.postRequest}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: { width: 24 },
  form: { padding: SIZES.padding, paddingBottom: 48 },
  section: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.cardBackground,
    color: COLORS.textPrimary,
    borderRadius: SIZES.borderRadius,
    padding: 14,
    marginBottom: 12,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { width: '48%' },
  currencyRow: { flexDirection: 'row', marginBottom: 12 },
  currencyPill: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBackground,
  },
  currencyPillLast: { marginRight: 0 },
  currencyPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  currencyPillText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  currencyPillTextActive: { color: '#000' },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#000', fontWeight: '700' },
  statusTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SIZES.padding,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  otpInput: {
    backgroundColor: COLORS.cardBackground,
    color: COLORS.textPrimary,
    borderRadius: SIZES.borderRadius,
    padding: 14,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    marginBottom: 16,
  },
});
