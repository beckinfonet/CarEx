import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  ArrowLeft,
  Clock,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Briefcase,
  Truck,
  X,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { GatedScreenWrapper } from '../components/moderation/GatedScreenWrapper';
import { RootStackParamList } from '../types/navigation';

export const ServiceApplicationScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceApplication'>>();
  const serviceType = route.params.type;

  const { user, requestBroker, requestLogistics, sendPhoneOtp, verifyPhone } = useAuth();

  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const isBroker = serviceType === 'broker';
  const status = isBroker ? user?.brokerStatus : user?.logisticsStatus;

  const title = isBroker ? t.applyAsBroker : t.applyAsLogistics;
  const becomeLabel = isBroker ? t.becomeBroker : t.becomeLogistics;
  const statusNoneText = isBroker ? t.brokerStatusNone : t.logisticsStatusNone;
  const statusPendingText = isBroker ? t.brokerStatusPending : t.logisticsStatusPending;
  const statusRejectedText = isBroker ? t.brokerStatusRejected : t.logisticsStatusRejected;
  const profileRequiredText = isBroker ? t.profileRequiredForBroker : t.profileRequiredForLogistics;
  const Icon = isBroker ? Briefcase : Truck;

  const handleRequest = async () => {
    if (!user.firstName || !user.lastName || !user.phoneNumber) {
      Alert.alert(t.error, profileRequiredText, [
        { text: t.goToProfile, onPress: () => navigation.navigate('Profile' as never) },
        { text: t.cancel, style: 'cancel' },
      ]);
      return;
    }

    setRequesting(true);
    try {
      if (isBroker) {
        await requestBroker();
      } else {
        await requestLogistics();
      }
      Alert.alert(t.requestSent, t.requestSentDesc);
    } catch {
      Alert.alert(t.error, 'Failed to send request.');
    } finally {
      setRequesting(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (!user.phoneNumber) {
      Alert.alert(t.error, profileRequiredText);
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp();
      setOtpModalVisible(true);
    } catch {
      Alert.alert(t.error, 'Failed to send verification code.');
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
      Alert.alert(t.success, t.phoneVerified);
    } catch {
      Alert.alert(t.error, t.wrongCode);
    } finally {
      setVerifying(false);
    }
  };

  const renderContent = () => {
    if (!user) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.statusDescription}>{profileRequiredText}</Text>
          <TouchableOpacity style={styles.requestButton} onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.requestButtonText}>{t.login}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'PENDING') {
      return (
        <View style={styles.statusContainer}>
          <Clock size={64} color={COLORS.accent} />
          <Text style={styles.statusTitle}>{t.requestSent}</Text>
          <Text style={styles.statusDescription}>{statusPendingText}</Text>
        </View>
      );
    }

    if (status === 'APPROVED') {
      return (
        <View style={styles.statusContainer}>
          <CheckCircle size={64} color="#22C55E" />
          <Text style={styles.statusTitle}>
            {isBroker ? t.brokerApproved : t.logisticsApproved}
          </Text>
          <Text style={styles.statusDescription}>
            {isBroker ? t.brokerStatusNone : t.logisticsStatusNone}
          </Text>
        </View>
      );
    }

    if (status === 'REJECTED') {
      return (
        <View style={styles.statusContainer}>
          <AlertTriangle size={64} color="#EF4444" />
          <Text style={styles.statusTitle}>{t.error}</Text>
          <Text style={styles.statusDescription}>{statusRejectedText}</Text>
        </View>
      );
    }

    // NONE or undefined — show application flow
    return (
      <View style={styles.statusContainer}>
        {!user.isPhoneVerified ? (
          <>
            <Smartphone size={64} color={COLORS.accent} />
            <Text style={styles.statusTitle}>{t.verifyPhone}</Text>
            <Text style={styles.statusDescription}>{t.verifyPhoneDesc}</Text>
            <TouchableOpacity style={styles.requestButton} onPress={handleVerifyPhone} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.requestButtonText}>{t.verifyPhone}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Icon size={64} color={COLORS.accent} />
            <Text style={styles.statusTitle}>{becomeLabel}</Text>
            <Text style={styles.statusDescription}>{statusNoneText}</Text>
            <TouchableOpacity style={styles.requestButton} onPress={handleRequest} disabled={requesting}>
              {requesting ? <ActivityIndicator color="#000" /> : <Text style={styles.requestButtonText}>{becomeLabel}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GatedScreenWrapper capability="apply_as_provider">
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* OTP Modal */}
      <Modal
        visible={otpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'center' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.enterCode}</Text>
                <TouchableOpacity onPress={() => setOtpModalVisible(false)}>
                  <X size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 24 }}>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 16 }}>
                  {t.verifyPhoneDesc}
                </Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <TouchableOpacity style={styles.requestButton} onPress={submitOtp} disabled={verifying}>
                  {verifying ? <ActivityIndicator color="#000" /> : <Text style={styles.requestButtonText}>{t.verify}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {renderContent()}
      </GatedScreenWrapper>
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
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  statusDescription: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  requestButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: SIZES.borderRadius,
    width: '100%',
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    minHeight: 280,
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
  otpInput: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
});
