import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft } from 'lucide-react-native';
import { PasswordTextInput } from '../components/PasswordTextInput';

export const LoginScreen = () => {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const mapAuthError = (errorCode: string) => {
    switch (errorCode) {
      case 'INVALID_LOGIN_CREDENTIALS':
      case 'EMAIL_NOT_FOUND':
      case 'INVALID_PASSWORD':
        return t.invalidCredentials;
      case 'USER_DISABLED':
        return t.userDisabled;
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        return t.tooManyAttempts;
      default:
        return t.authError;
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage(t.fillAllFields || 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // @ts-ignore
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error: any) {
      const code = error.message || 'UNKNOWN_ERROR';
      setErrorMessage(mapAuthError(code));
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
        <Text style={styles.headerTitle}>{t.login}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
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
          value={email}
          onChangeText={setEmail}
        />
        <PasswordTextInput
          style={styles.input}
          placeholder={t.password}
          placeholderTextColor={COLORS.textSecondary}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={() => navigation.navigate('ForgotPassword' as never)}
        >
          <Text style={styles.forgotPasswordText}>{t.forgotPassword}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{t.login}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Signup' as never)}>
          <Text style={styles.linkText}>{t.noAccount}</Text>
        </TouchableOpacity>
      </View>
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
    padding: SIZES.padding,
    gap: 16,
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
    marginTop: 16,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red background
    padding: 12,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444', // Red text
    fontSize: 14,
    textAlign: 'center',
  },
});

