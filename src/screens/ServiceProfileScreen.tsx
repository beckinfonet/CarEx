import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft, Plus, Trash2, Briefcase, Truck, Pencil, X, Edit2, Save } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';
import { RootStackParamList } from '../types/navigation';

const CURRENCIES = [
  { code: '$', label: 'USD', flag: '🇺🇸' },
  { code: 'сом', label: 'KGS', flag: '🇰🇬' },
];

interface ServiceItem {
  name: string;
  description: string;
  fee: string;
  currency: string;
}

export const ServiceProfileScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceProfile'>>();
  const serviceType = route.params.type;
  const isBroker = serviceType === 'broker';

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [isEditingInfo, setIsEditingInfo] = useState(false);

  // Add/Edit modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalFee, setModalFee] = useState('');
  const [modalCurrency, setModalCurrency] = useState('$');

  const title = isBroker ? t.viewBrokerage : t.viewLogistics;
  const Icon = isBroker ? Briefcase : Truck;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user?.localId) return;
    setLoading(true);
    try {
      const profile = isBroker
        ? await AuthService.getBrokerProfile(user.localId)
        : await AuthService.getLogisticsProfile(user.localId);

      if (profile) {
        setCompanyName(profile.companyName || '');
        setDescription(profile.description || '');
        setPhoneNumber(profile.phoneNumber || '');
        setTelegramUsername(profile.telegramUsername || '');
        if (!profile.companyName) {
          setIsEditingInfo(true);
        }
        if (profile.services && profile.services.length > 0) {
          setServices(
            profile.services.map((s: any) => ({
              name: s.name || '',
              description: s.description || '',
              fee: s.fee != null ? String(s.fee) : '',
              currency: s.currency || '$',
            })),
          );
        }
      } else {
        setIsEditingInfo(true);
      }
    } catch {
      setIsEditingInfo(true);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingIndex(null);
    setModalName('');
    setModalDescription('');
    setModalFee('');
    setModalCurrency('$');
    setModalVisible(true);
  };

  const openEditModal = (index: number) => {
    const item = services[index];
    setEditingIndex(index);
    setModalName(item.name);
    setModalDescription(item.description);
    setModalFee(item.fee);
    setModalCurrency(item.currency || '$');
    setModalVisible(true);
  };

  const handleModalSave = () => {
    if (!modalName.trim()) {
      Alert.alert(t.error, t.serviceName);
      return;
    }
    const newItem: ServiceItem = {
      name: modalName.trim(),
      description: modalDescription.trim(),
      fee: modalFee,
      currency: modalCurrency,
    };

    if (editingIndex !== null) {
      setServices(prev => {
        const updated = [...prev];
        updated[editingIndex] = newItem;
        return updated;
      });
    } else {
      setServices(prev => [...prev, newItem]);
    }
    setModalVisible(false);
  };

  const removeService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user?.localId) return;

    if (!companyName.trim()) {
      Alert.alert(t.error, t.companyName);
      return;
    }

    const validServices = services
      .filter(s => s.name.trim())
      .map(s => ({
        name: s.name.trim(),
        description: s.description.trim(),
        fee: parseFloat(s.fee) || 0,
        currency: s.currency || '$',
      }));

    setSaving(true);
    try {
      const data: any = {
        companyName: companyName.trim(),
        description: description.trim(),
        phoneNumber: phoneNumber.trim(),
        telegramUsername: telegramUsername.trim(),
        services: validServices,
      };

      if (isBroker) {
        await AuthService.updateBrokerProfile(user.localId, data);
      } else {
        await AuthService.updateLogisticsProfile(user.localId, data);
      }

      setIsEditingInfo(false);
      Alert.alert(t.success, t.profileSavedSuccess);
    } catch {
      Alert.alert(t.error, 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Add/Edit Service Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? t.serviceName : t.addService}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalLabel}>{t.serviceName}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t.serviceName}
                placeholderTextColor={COLORS.textSecondary}
                value={modalName}
                onChangeText={setModalName}
              />

              <Text style={styles.modalLabel}>{t.description}</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder={t.serviceDescription}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={3}
                value={modalDescription}
                onChangeText={setModalDescription}
              />

              <Text style={styles.modalLabel}>{t.serviceFee}</Text>
              <View style={styles.feeRow}>
                <TextInput
                  style={[styles.modalInput, styles.feeInput]}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={modalFee}
                  onChangeText={setModalFee}
                />
                <View style={styles.currencyToggle}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity
                      key={c.code}
                      style={[
                        styles.currencyOption,
                        modalCurrency === c.code && styles.currencyOptionActive,
                      ]}
                      onPress={() => setModalCurrency(c.code)}>
                      <Text style={styles.currencyFlag}>{c.flag}</Text>
                      <Text
                        style={[
                          styles.currencyLabel,
                          modalCurrency === c.code && styles.currencyLabelActive,
                        ]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleModalSave}>
                  <Text style={styles.modalSaveText}>{t.saveProfile}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.iconRow}>
            <Icon size={32} color={COLORS.accent} />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>{t.mainInfo}</Text>
            {!isEditingInfo && (
              <TouchableOpacity onPress={() => setIsEditingInfo(true)} style={styles.editButton}>
                <Edit2 size={20} color={COLORS.accent} />
              </TouchableOpacity>
            )}
          </View>

          {isEditingInfo ? (
            <>
              <TextInput
                style={styles.input}
                placeholder={t.companyName}
                placeholderTextColor={COLORS.textSecondary}
                value={companyName}
                onChangeText={setCompanyName}
              />
              <TextInput
                style={styles.input}
                placeholder={t.phoneNumber}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
              <TextInput
                style={styles.input}
                placeholder={t.telegramUsername}
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                value={telegramUsername}
                onChangeText={setTelegramUsername}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t.serviceDescription}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
              <View style={styles.infoButtonRow}>
                <TouchableOpacity style={styles.infoCancelButton} onPress={() => setIsEditingInfo(false)}>
                  <X size={18} color={COLORS.textPrimary} />
                  <Text style={styles.infoCancelText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.infoSaveButton, saving && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Save size={18} color="#FFF" />
                      <Text style={styles.infoSaveText}>{t.saveProfile}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.companyName}:</Text>
                <Text style={styles.infoValue}>{companyName || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.phoneNumber}:</Text>
                <Text style={styles.infoValue}>{phoneNumber || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.telegramUsername}:</Text>
                <Text style={styles.infoValue}>{telegramUsername || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.serviceDescription}:</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{description || '-'}</Text>
              </View>
            </>
          )}

          <View style={styles.servicesHeader}>
            <Text style={styles.sectionHeader}>{t.myServices}</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Plus size={18} color="#000" />
              <Text style={styles.addButtonText}>{t.addService}</Text>
            </TouchableOpacity>
          </View>

          {services.length === 0 ? (
            <TouchableOpacity style={styles.emptyServices} onPress={openAddModal}>
              <Plus size={24} color={COLORS.textSecondary} />
              <Text style={styles.emptyServicesText}>{t.noServicesAdded}</Text>
              <Text style={styles.emptyServicesHint}>{t.addAtLeastOneService}</Text>
            </TouchableOpacity>
          ) : (
            services.map((item, index) => (
              <View key={index} style={styles.serviceCard}>
                <View style={styles.serviceCardTop}>
                  <View style={styles.serviceCardInfo}>
                    <Text style={styles.serviceCardName}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.serviceCardDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.serviceCardFee}>
                    <Text style={styles.serviceCardFeeText}>
                      {item.currency || '$'}{item.fee || '0'}
                    </Text>
                  </View>
                </View>
                <View style={styles.serviceCardActions}>
                  <TouchableOpacity
                    style={styles.serviceCardEditBtn}
                    onPress={() => openEditModal(index)}>
                    <Pencil size={14} color={COLORS.accent} />
                    <Text style={styles.serviceCardEditText}>{t.editListing}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.serviceCardDeleteBtn}
                    onPress={() => removeService(index)}>
                    <Trash2 size={14} color="#EF4444" />
                    <Text style={styles.serviceCardDeleteText}>{t.removeService}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveButtonText}>{t.saveServiceProfile}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  iconRow: {
    alignItems: 'center',
    marginVertical: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 0,
  },
  editButton: {
    padding: 8,
    marginTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
    flex: 1,
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  infoCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
    gap: 8,
  },
  infoCancelText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  infoSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.accent,
    gap: 8,
  },
  infoSaveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: SIZES.borderRadius,
    gap: 6,
  },
  addButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyServices: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 12,
    gap: 8,
  },
  emptyServicesText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyServicesHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  // Service cards
  serviceCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  serviceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  serviceCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceCardName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  serviceCardDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  serviceCardFee: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  serviceCardFeeText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  serviceCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  serviceCardEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  serviceCardEditText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  serviceCardDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  serviceCardDeleteText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },

  // Save button
  saveButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
    paddingBottom: 40,
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feeInput: {
    flex: 1,
  },
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  currencyOptionActive: {
    backgroundColor: COLORS.accent,
  },
  currencyFlag: {
    fontSize: 16,
  },
  currencyLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  currencyLabelActive: {
    color: '#000',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
