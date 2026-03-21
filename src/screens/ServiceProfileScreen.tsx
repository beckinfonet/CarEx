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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft, Plus, Trash2, Briefcase, Truck } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';
import { RootStackParamList } from '../types/navigation';

interface ServiceItem {
  name: string;
  fee: string;
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
        if (profile.services && profile.services.length > 0) {
          setServices(
            profile.services.map((s: any) => ({
              name: s.name || '',
              fee: s.fee != null ? String(s.fee) : '',
            })),
          );
        }
      }
    } catch {
      // Profile may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const addServiceRow = () => {
    setServices(prev => [...prev, { name: '', fee: '' }]);
  };

  const updateService = (index: number, field: 'name' | 'fee', value: string) => {
    setServices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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
        fee: parseFloat(s.fee) || 0,
        currency: '$',
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.iconRow}>
            <Icon size={32} color={COLORS.accent} />
          </View>

          <Text style={styles.sectionHeader}>{t.mainInfo}</Text>

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

          <View style={styles.servicesHeader}>
            <Text style={styles.sectionHeader}>{t.myServices}</Text>
            <TouchableOpacity style={styles.addButton} onPress={addServiceRow}>
              <Plus size={18} color="#000" />
              <Text style={styles.addButtonText}>{t.addService}</Text>
            </TouchableOpacity>
          </View>

          {services.length === 0 && (
            <View style={styles.emptyServices}>
              <Text style={styles.emptyServicesText}>{t.noServicesAdded}</Text>
            </View>
          )}

          {services.map((item, index) => (
            <View key={index} style={styles.serviceRow}>
              <View style={styles.serviceInputs}>
                <TextInput
                  style={[styles.input, styles.serviceNameInput]}
                  placeholder={t.serviceName}
                  placeholderTextColor={COLORS.textSecondary}
                  value={item.name}
                  onChangeText={val => updateService(index, 'name', val)}
                />
                <TextInput
                  style={[styles.input, styles.serviceFeeInput]}
                  placeholder="$0"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={item.fee}
                  onChangeText={val => updateService(index, 'fee', val)}
                />
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeService(index)}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}

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
  sectionHeader: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
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
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  emptyServicesText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  serviceInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  serviceNameInput: {
    flex: 2,
    marginBottom: 0,
  },
  serviceFeeInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
});
