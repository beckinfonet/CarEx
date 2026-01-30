import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar, TextInput, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronRight, Heart, ArrowLeft, ChevronDown, Save, Edit2, X } from 'lucide-react-native';
import { AuthService } from '../services/AuthService';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

const COUNTRIES = [
  { code: 'KR', name: 'South Korea', dial_code: '+82', flag: '🇰🇷', placeholder: '10-1234-5678' },
  { code: 'KG', name: 'Kyrgyzstan', dial_code: '+996', flag: '🇰🇬', placeholder: '555-123-456' },
  { code: 'KZ', name: 'Kazakhstan', dial_code: '+7', flag: '🇰🇿', placeholder: '777-123-45-67' },
  { code: 'UZ', name: 'Uzbekistan', dial_code: '+998', flag: '🇺🇿', placeholder: '90-123-45-67' },
  { code: 'CN', name: 'China', dial_code: '+86', flag: '🇨🇳', placeholder: '138-0013-8000' },
  { code: 'RU', name: 'Russia', dial_code: '+7', flag: '🇷🇺', placeholder: '912-345-67-89' },
];

export const ProfileScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, logout, refreshUser } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
        setTelegramUsername(user.telegramUsername || '');
        
        // Auto-detect country
        if (user.phoneNumber) {
            const foundCountry = COUNTRIES.find(c => user.phoneNumber.startsWith(c.dial_code));
            if (foundCountry) {
                setSelectedCountry(foundCountry);
                setPhoneNumber(user.phoneNumber.replace(foundCountry.dial_code, ''));
            } else {
                setPhoneNumber(user.phoneNumber);
            }
        }

        // If mandatory fields are missing, default to Edit mode
        if (!user.firstName || !user.lastName || !user.phoneNumber) {
            setIsEditing(true);
        }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    // Format Phone
    let finalPhone = phoneNumber;
    if (phoneNumber && !phoneNumber.startsWith('+')) {
        // Remove leading 0 if present for some countries
        const cleanNumber = phoneNumber.replace(/^0+/, '');
        finalPhone = `${selectedCountry.dial_code}${cleanNumber}`;
    }

    const updateData = {
        firstName,
        lastName,
        phoneNumber: finalPhone,
        telegramUsername
    };

    try {
        await AuthService.updateBackendUser(user.localId, updateData);
        await refreshUser(); // Update context
        Alert.alert(t.success, t.profileSaved);
        setIsEditing(false); // Switch back to view mode
    } catch (error) {
        Alert.alert(t.error, t.profileSaveError);
    } finally {
        setSaving(false);
    }
  };

  const toggleEdit = () => {
      setIsEditing(!isEditing);
  };

  const handleLogout = async () => {
    Alert.alert(
      t.logout,
      t.logoutConfirm,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: t.logout, 
          style: 'destructive', 
          onPress: async () => {
            await logout();
            navigation.navigate('Home');
          } 
        }
      ]
    );
  };

  const menuItems = [
    // {
    //   id: 'listings',
    //   title: t.myListings,
    //   icon: <List size={24} color={COLORS.accent} />,
    //   onPress: () => Alert.alert(t.myListings, t.comingSoon || 'Coming Soon')
    // },
    {
      id: 'favorites',
      title: t.myFavorites,
      icon: <Heart size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('Favorites')
    },
  ];

  if (!user) {
    // Should generally be redirected by Auth stack, but for safety
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
            <Text style={styles.text}>{t.noAccount}</Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.buttonText}>{t.login}</Text>
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
        <Text style={styles.headerTitle}>{t.myProfile}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1 }}>
            <View style={styles.userInfoContainer}>
                <View style={styles.avatarContainer}>
                    <User size={40} color={COLORS.textPrimary} />
                </View>
                <View style={styles.userDetails}>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userLabel}>{t.accountSettings}</Text>
                </View>
            </View>

            <View style={styles.menuContainer}>
                {menuItems.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
                        <View style={styles.menuIcon}>
                            {item.icon}
                        </View>
                        <Text style={styles.menuTitle}>{item.title}</Text>
                        <ChevronRight size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Profile Form */}
            <View style={styles.formContainer}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>{t.mainInfo}</Text>
                    {!isEditing && (
                        <TouchableOpacity onPress={toggleEdit} style={styles.editButton}>
                            <Edit2 size={20} color={COLORS.accent} />
                        </TouchableOpacity>
                    )}
                </View>
                
                {isEditing ? (
                    <>
                        <TextInput 
                            style={styles.input}
                            placeholder={t.firstName}
                            placeholderTextColor={COLORS.textSecondary}
                            value={firstName}
                            onChangeText={setFirstName}
                        />
                        <TextInput 
                            style={styles.input}
                            placeholder={t.lastName}
                            placeholderTextColor={COLORS.textSecondary}
                            value={lastName}
                            onChangeText={setLastName}
                        />

                        <Text style={styles.label}>{t.phoneNumber}</Text>
                        <View style={styles.phoneContainer}>
                        <TouchableOpacity style={styles.countryButton} onPress={() => setCountryModalVisible(true)}>
                            <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                            <Text style={styles.countryCode}>{selectedCountry.dial_code}</Text>
                            <ChevronDown size={16} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <TextInput
                            style={[styles.input, styles.phoneInput]}
                            placeholder={selectedCountry.placeholder}
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="phone-pad"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                        />
                        </View>

                        <Text style={styles.label}>{t.telegramUsername}</Text>
                        <TextInput 
                            style={styles.input}
                            placeholder={t.telegramUsername}
                            placeholderTextColor={COLORS.textSecondary}
                            value={telegramUsername}
                            onChangeText={setTelegramUsername}
                            autoCapitalize="none"
                        />

                        <View style={styles.buttonRow}>
                            <TouchableOpacity 
                                style={[styles.cancelButton]} 
                                onPress={() => setIsEditing(false)}
                            >
                                <X size={20} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.saveButton, saving && styles.disabledButton]} 
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.saveButtonText}>{t.saveProfile}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t.firstName}:</Text>
                            <Text style={styles.infoValue}>{firstName || '-'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t.lastName}:</Text>
                            <Text style={styles.infoValue}>{lastName || '-'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t.phoneNumber}:</Text>
                            <Text style={styles.infoValue}>
                                {phoneNumber ? `${selectedCountry.dial_code} ${phoneNumber}` : '-'}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t.telegramUsername}:</Text>
                            <Text style={styles.infoValue}>{telegramUsername || '-'}</Text>
                        </View>
                    </>
                )}
            </View>
        </View>

        {/* Country Modal */}
        <Modal
          visible={countryModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setCountryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Country</Text>
                <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                  <ChevronDown size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={COUNTRIES}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryItem}
                    onPress={() => {
                      setSelectedCountry(item);
                      setCountryModalVisible(false);
                    }}
                  >
                    <Text style={styles.countryItemFlag}>{item.flag}</Text>
                    <Text style={styles.countryItemName}>{item.name}</Text>
                    <Text style={styles.countryItemCode}>{item.dial_code}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#EF4444" style={{ marginRight: 10 }} />
            <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: COLORS.textPrimary,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: SIZES.borderRadius,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    padding: 20,
    borderRadius: SIZES.borderRadius,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.searchBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userDetails: {
    flex: 1,
  },
  userEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  userLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  menuContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    marginBottom: 24,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 20,
    marginBottom: 20,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeader: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 8,
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
    fontSize: 16,
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  phoneContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: 100,
    justifyContent: 'space-between',
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 20,
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
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  countryItemFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  countryItemName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    flex: 1,
  },
  countryItemCode: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

