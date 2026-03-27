import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { AuthService } from '../services/AuthService';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native';

export const ForgotPasswordScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const mapResetError = (code: string) => {
    switch (code) {
      case 'EMAIL_NOT_FOUND':
        return t.emailNotFound;
      case 'INVALID_EMAIL':
        return t.invalidEmail;
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        return t.tooManyAttempts;
      default:
        return t.authError;
    }
  };

  const handleReset = async () => {
    setErrorMessage('');
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage(t.fillAllFields);
      return;
    }

    setLoading(true);
    try {
      await AuthService.sendPasswordResetEmail(trimmed);
      setSent(true);
    } catch (error: any) {
      const code = error?.message || 'UNKNOWN';
      setErrorMessage(mapResetError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.resetPassword}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {sent ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconCircle}>
              <CheckCircle size={40} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>{t.resetEmailSent}</Text>
            <Text style={styles.successMessage}>{t.resetEmailSentDesc}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>{t.backToLogin}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Mail size={32} color={COLORS.accent} />
            </View>
            <Text style={styles.description}>{t.resetPasswordDesc}</Text>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder={t.email}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>{t.sendResetLink}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.linkText}>{t.backToLogin}</Text>
            </TouchableOpacity>
          </>
        )}
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
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
    paddingTop: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  successMessage: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
});
