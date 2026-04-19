import React, { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { ArrowLeft, Camera, X, ChevronDown, AlertTriangle, CheckCircle, Clock, Smartphone } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MakeModelFormField } from '../components/MakeModelFormField';
import { GatedScreenWrapper } from '../components/moderation/GatedScreenWrapper';
import { RootStackParamList } from '../types/navigation';

const COUNTRIES = [
  { code: 'KR', name: 'South Korea', dial_code: '+82', flag: '🇰🇷', placeholder: '10-1234-5678' },
  { code: 'KG', name: 'Kyrgyzstan', dial_code: '+996', flag: '🇰🇬', placeholder: '555-123-456' },
  { code: 'KZ', name: 'Kazakhstan', dial_code: '+7', flag: '🇰🇿', placeholder: '777-123-45-67' },
  { code: 'UZ', name: 'Uzbekistan', dial_code: '+998', flag: '🇺🇿', placeholder: '90-123-45-67' },
  { code: 'RU', name: 'Russia', dial_code: '+7', flag: '🇷🇺', placeholder: '912-345-67-89' },
];

export const SellCarScreen = () => {
  const { t } = useLanguage();
  const { user, requestSeller, sendPhoneOtp, verifyPhone } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'SellCar'>>();
  const carId = route.params?.carId;
  const isEditMode = !!carId;

  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [loadingCar, setLoadingCar] = useState(isEditMode);
  const [images, setImages] = useState<Asset[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageOrientation, setImageOrientation] = useState<'vertical' | 'horizontal' | null>(null);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default KR

  // OTP State
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [formData, setFormData] = useState({
    makeId: '',
    modelId: '',
    trimLevel: '',
    wheelbase: '',
    year: '',
    price: '',
    mileage: '',
    fuel: t.gasoline,
    bodyType: t.sedan,
    description: '',
    // New Fields
    engine: '',
    transmission: t.automatic,
    drivetrain: t.fwd,
    mpg: '',
    fuelEfficiencyUnit: 'km' as 'km' | 'mpg',
    condition: t.excellent,
    knownIssues: [] as string[],
    exteriorColor: '',
    interiorColor: '',
    interiorMaterial: t.leather,
    seats: '',
    doors: '',
    phoneNumber: '', // Stores only local part
    telegramUsername: '',
  });

  useEffect(() => {
    if (user && user.sellerStatus === 'APPROVED') {
      checkProfileAndAutofill();
    }
  }, [user]);

  useEffect(() => {
    if (isEditMode && existingImageUrls.length > 0 && !imageOrientation) {
      setImageOrientation('vertical');
    }
  }, [isEditMode, existingImageUrls.length]);

  useEffect(() => {
    if (carId && user?.sellerStatus === 'APPROVED') {
      const fetchCar = async () => {
        setLoadingCar(true);
        try {
          const res = await axios.get(`${API_URL}/api/cars/${carId}`);
          const c = res.data;
          if (c.sellerId !== user?.localId) {
            Alert.alert(t.error, 'Not authorized to edit this listing.');
            navigation.goBack();
            return;
          }
          setExistingImageUrls(c.imageUrls || []);
          let phone = c.phoneNumber || '';
          let country = COUNTRIES[0];
          const foundCountry = COUNTRIES.find(cn => phone.startsWith(cn.dial_code));
          if (foundCountry) {
            country = foundCountry;
            phone = phone.replace(foundCountry.dial_code, '');
          }
          setSelectedCountry(country);
          setFormData({
            makeId: c.makeId?.toString() || '',
            modelId: c.modelId?.toString() || '',
            trimLevel: c.trimLevel || '',
            wheelbase: c.wheelbase || '',
            year: c.year?.toString() || '',
            price: c.price?.toString() || '',
            mileage: c.mileage?.toString() || '',
            fuel: c.fuel || t.gasoline,
            bodyType: c.bodyType || t.sedan,
            description: c.description || '',
            engine: c.engine || '',
            transmission: c.transmission || t.automatic,
            drivetrain: c.drivetrain || t.fwd,
            mpg: (() => {
              const m = c.mpg || '';
              const numMatch = m.match(/^([\d.,]+)/);
              return numMatch ? numMatch[1] : '';
            })(),
            fuelEfficiencyUnit: (() => {
              const m = c.mpg || '';
              if (m.toUpperCase().includes('MPG')) return 'mpg';
              return 'km';
            })(),
            condition: c.condition || t.excellent,
            knownIssues: c.knownIssues || [],
            exteriorColor: c.exteriorColor || '',
            interiorColor: c.interiorColor || '',
            interiorMaterial: c.interiorMaterial || t.leather,
            seats: c.seats?.toString() || '',
            doors: c.doors?.toString() || '',
            phoneNumber: phone,
            telegramUsername: c.telegramUsername || '',
          });
        } catch (e) {
          Alert.alert(t.error, 'Failed to load listing.');
          navigation.goBack();
        } finally {
          setLoadingCar(false);
        }
      };
      fetchCar();
    }
  }, [carId, user?.localId, user?.sellerStatus]);

  const handleRequestSeller = async () => {
    // Check mandatory fields first
    if (!user.firstName || !user.lastName || !user.phoneNumber) {
      Alert.alert(
        t.error,
        t.profileRequiredForSelling,
        [
          { text: t.goToProfile, onPress: () => navigation.navigate('Profile' as never) },
          { text: t.cancel, style: 'cancel' }
        ]
      );
      return;
    }

    setRequesting(true);
    try {
      await requestSeller();
      Alert.alert(t.requestSent, t.requestSentDesc);
    } catch (error) {
      Alert.alert(t.error, 'Failed to send request.');
    } finally {
      setRequesting(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (!user.phoneNumber) {
      Alert.alert(t.error, t.profileRequiredForSelling);
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp();
      setOtpModalVisible(true);
    } catch (error) {
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
    } catch (error) {
      Alert.alert(t.error, t.wrongCode);
    } finally {
      setVerifying(false);
    }
  };

  const checkProfileAndAutofill = () => {
    if (!user) return;

    // Check mandatory fields
    if (!user.firstName || !user.lastName || !user.phoneNumber) {
      Alert.alert(
        t.error,
        'Please complete your profile (Name, Phone) before selling a car.',
        [
          { text: 'Go to Profile', onPress: () => navigation.navigate('Profile' as never) },
          { text: 'Cancel', onPress: () => navigation.goBack(), style: 'cancel' }
        ]
      );
      return;
    }

    // Auto-fill
    let phone = user.phoneNumber || '';
    let country = COUNTRIES[0];

    // Try to detect country code
    const foundCountry = COUNTRIES.find(c => phone.startsWith(c.dial_code));
    if (foundCountry) {
      country = foundCountry;
      phone = phone.replace(foundCountry.dial_code, '');
    }

    setSelectedCountry(country);

    setFormData(prev => ({
      ...prev,
      phoneNumber: phone,
      telegramUsername: user.telegramUsername || prev.telegramUsername
    }));
  };

  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [customIssue, setCustomIssue] = useState('');

  const getImageDimensions = (uri: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
  };

  const handleChoosePhoto = async () => {
    if (!imageOrientation) return;
    const currentTotal = existingImageUrls.length + images.length;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 25 - currentTotal,
    });

    const assets = result.assets ?? [];
    if (assets.length === 0) return;

    const validAssets: Asset[] = [];
    let invalidCount = 0;
    const isVertical = imageOrientation === 'vertical';

    for (const asset of assets) {
      const uri = asset.uri;
      if (!uri) continue;
      try {
        const { width, height } = await getImageDimensions(uri);
        const assetIsVertical = height > width;
        const assetIsHorizontal = width > height;
        const matches = isVertical ? assetIsVertical : assetIsHorizontal;
        if (matches) {
          validAssets.push(asset);
        } else {
          invalidCount++;
        }
      } catch {
        invalidCount++;
      }
    }

    if (validAssets.length > 0) {
      setImages(prev => [...prev, ...validAssets]);
    }
    if (invalidCount > 0) {
      const orientationLabel = imageOrientation === 'vertical' ? t.vertical : t.horizontal;
      Alert.alert(
        t.wrongOrientation,
        (t.wrongOrientationMessage || 'Photos must be {{orientation}}. {{count}} photo(s) with wrong orientation were not added.')
          .replace('{{orientation}}', orientationLabel)
          .replace('{{count}}', String(invalidCount))
      );
    }
  };

  const removeImage = (index: number) => {
    if (index < existingImageUrls.length) {
      setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      setImages(prev => prev.filter((_, i) => i !== index - existingImageUrls.length));
    }
  };

  const displayImages = [
    ...existingImageUrls.map(uri => ({ uri, isExisting: true })),
    ...images.map(a => ({ uri: a.uri!, isExisting: false })),
  ];

  const toggleDropdown = (field: string) => {
    setExpandedField(expandedField === field ? null : field);
  };

  const handleSelect = (field: string, value: string) => {
    if (field === 'knownIssues') {
      const currentIssues = formData.knownIssues;
      if (currentIssues.includes(value)) {
        setFormData({ ...formData, knownIssues: currentIssues.filter(i => i !== value) });
      } else {
        setFormData({ ...formData, knownIssues: [...currentIssues, value] });
      }
    } else {
      setFormData({ ...formData, [field]: value });
      setExpandedField(null);
    }
  };

  const addCustomIssue = () => {
    if (customIssue.trim().length > 0) {
      const currentIssues = formData.knownIssues;
      if (!currentIssues.includes(customIssue.trim())) {
        setFormData({ ...formData, knownIssues: [...currentIssues, customIssue.trim()] });
      }
      setCustomIssue('');
    }
  };

  const removeIssue = (issue: string) => {
    const currentIssues = formData.knownIssues;
    setFormData({ ...formData, knownIssues: currentIssues.filter(i => i !== issue) });
  };

  const validateListing = (): string | null => {
    const totalImages = existingImageUrls.length + images.length;
    if (totalImages === 0) return t.photo;
    if (!formData.makeId) return t.brand;
    if (!formData.modelId) return t.model;
    if (!formData.year?.trim()) return t.enterYear;
    const yearNum = parseInt(formData.year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) return t.enterYear;
    if (!formData.price?.trim()) return t.enterPrice;
    const priceNum = parseInt(formData.price.replace(/\D/g, ''), 10);
    if (isNaN(priceNum) || priceNum <= 0) return t.enterPrice;
    if (!formData.mileage?.trim()) return t.enterMileage;
    const mileageNum = parseInt(formData.mileage.replace(/\D/g, ''), 10);
    if (isNaN(mileageNum) || mileageNum < 0) return t.enterMileage;
    if (!formData.phoneNumber?.trim()) return t.phoneNumber;
    const fullPhone = `${selectedCountry.dial_code}${formData.phoneNumber.replace(/^0+/, '')}`;
    if (fullPhone.replace(/\D/g, '').length < 10) return t.phoneNumber;
    return null;
  };

  const handleSubmit = async () => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }

    const missingField = validateListing();
    if (missingField) {
      Alert.alert(
        t.error,
        (t.listingValidationMissing || 'Required field: {field}').replace('{field}', missingField)
      );
      return;
    }

    if (isEditMode && !user?.localId) {
      Alert.alert('Error', 'You must be logged in to edit a listing.');
      return;
    }

    const fullPhoneNumber = `${selectedCountry.dial_code}${formData.phoneNumber.replace(/^0+/, '')}`;

    setLoading(true);

    const data = new FormData();
    const mpgValue = formData.mpg?.trim();
    const mpgForApi = mpgValue
      ? `${mpgValue} ${formData.fuelEfficiencyUnit === 'km' ? 'L/100km' : 'MPG'}`
      : '';
    Object.keys(formData).forEach(key => {
      if (key === 'fuelEfficiencyUnit') return;
      if (key === 'knownIssues') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (key === 'phoneNumber') {
        data.append(key, fullPhoneNumber);
      } else if (key === 'mpg') {
        data.append(key, mpgForApi);
      } else {
        // @ts-ignore
        data.append(key, formData[key]);
      }
    });

    if (!isEditMode && user?.localId) {
      data.append('sellerId', user.localId);
    }

    if (isEditMode) {
      data.append('sellerId', user!.localId);
      data.append('existingImageUrls', JSON.stringify(existingImageUrls));
    }

    images.forEach((img, index) => {
      if (img.uri) {
        const file = {
          uri: img.uri,
          type: img.type,
          name: img.fileName || `image_${index}.jpg`,
        };
        // @ts-ignore
        data.append('images', file);
      }
    });

    try {
      if (isEditMode) {
        await axios.put(`${API_URL}/api/cars/${carId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Alert.alert(t.success, 'Listing updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        await axios.post(`${API_URL}/api/cars`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Alert.alert(t.success, 'Car listed successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      console.error('Upload Error Details:', error);
      Alert.alert(t.error, isEditMode ? 'Failed to update listing.' : 'Failed to upload car listing.');
    } finally {
      setLoading(false);
    }
  };

  const renderDropdown = (label: string, value: string | string[], field: string, options: string[]) => {
    const isExpanded = expandedField === field;
    const displayValue = Array.isArray(value)
      ? (value.length > 0 ? value.join(', ') : t.none)
      : value;

    return (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={[styles.selectButton, isExpanded && styles.selectButtonExpanded]}
          onPress={() => toggleDropdown(field)}
        >
          <Text style={styles.selectLabel}>{label}</Text>
          <Text style={styles.selectValue}>{displayValue} {isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.dropdownOptions}>
            {options.map((option, index) => {
              const isSelected = Array.isArray(value) ? value.includes(option) : value === option;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dropdownOption, isSelected && styles.selectedDropdownOption]}
                  onPress={() => handleSelect(field, option)}
                >
                  <Text style={[styles.dropdownOptionText, isSelected && styles.selectedOptionText]}>
                    {option} {isSelected && '✓'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GatedScreenWrapper capability="create_listing">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? t.editListing : t.sellHeader}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Country Selection Modal */}
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
                <X size={24} color={COLORS.textPrimary} />
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

      {/* OTP Modal */}
      <Modal
        visible={otpModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'center' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
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
                style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
                placeholder="000000"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
              />
              <TouchableOpacity style={styles.submitButton} onPress={submitOtp} disabled={verifying}>
                {verifying ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>{t.verify}</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {(!user) ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusDescription}>{t.profileRequiredForSelling}</Text>
          <TouchableOpacity style={styles.requestButton} onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.requestButtonText}>{t.login}</Text>
          </TouchableOpacity>
        </View>
      ) : (user.sellerStatus === 'PENDING') ? (
        <View style={styles.statusContainer}>
          <Clock size={64} color={COLORS.accent} />
          <Text style={styles.statusTitle}>{t.requestSent}</Text>
          <Text style={styles.statusDescription}>{t.sellerStatusPending}</Text>
        </View>
      ) : (user.sellerStatus === 'NONE' || !user.sellerStatus) ? (
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
              <CheckCircle size={64} color={COLORS.textSecondary} />
              <Text style={styles.statusTitle}>{t.becomeSeller}</Text>
              <Text style={styles.statusDescription}>{t.sellerStatusNone}</Text>
              <TouchableOpacity style={styles.requestButton} onPress={handleRequestSeller} disabled={requesting}>
                {requesting ? <ActivityIndicator color="#000" /> : <Text style={styles.requestButtonText}>{t.becomeSeller}</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (user.sellerStatus === 'REJECTED') ? (
        <View style={styles.statusContainer}>
          <AlertTriangle size={64} color="#EF4444" />
          <Text style={styles.statusTitle}>{t.error}</Text>
          <Text style={styles.statusDescription}>{t.sellerStatusRejected}</Text>
        </View>
      ) : isEditMode && loadingCar ? (
        <View style={[styles.statusContainer, { flex: 1 }]}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.statusDescription}>{t.loading}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.content}>
            <View style={styles.imageSection}>
              {!imageOrientation ? (
                <View style={styles.orientationPicker}>
                  <Text style={styles.orientationTitle}>{t.choosePhotoOrientation}</Text>
                  <Text style={styles.orientationDesc}>{t.photoOrientationDesc}</Text>
                  <View style={styles.orientationOptions}>
                    <TouchableOpacity
                      style={[styles.orientationOption, imageOrientation === 'vertical' && styles.orientationOptionActive]}
                      onPress={() => setImageOrientation('vertical')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.orientationVisual}>
                        <View style={[styles.orientationRect, styles.orientationRectVertical]} />
                      </View>
                      <View style={styles.orientationRadioRow}>
                        <View style={[styles.radioOuter, imageOrientation === 'vertical' && styles.radioOuterActive]}>
                          {imageOrientation === 'vertical' && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.orientationLabel, imageOrientation === 'vertical' && styles.orientationLabelActive]}>{t.vertical}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.orientationOption, imageOrientation === 'horizontal' && styles.orientationOptionActive]}
                      onPress={() => setImageOrientation('horizontal')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.orientationVisual}>
                        <View style={[styles.orientationRect, styles.orientationRectHorizontal]} />
                      </View>
                      <View style={styles.orientationRadioRow}>
                        <View style={[styles.radioOuter, imageOrientation === 'horizontal' && styles.radioOuterActive]}>
                          {imageOrientation === 'horizontal' && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.orientationLabel, imageOrientation === 'horizontal' && styles.orientationLabelActive]}>{t.horizontal}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.orientationReminder}>
                    <CheckCircle size={18} color={COLORS.accent} style={styles.orientationReminderIcon} />
                    <Text style={styles.orientationReminderText}>{t.orientationSelectedMessage}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeOrientationButton}
                    onPress={() => {
                      if (images.length > 0) {
                        Alert.alert(
                          t.changeOrientation,
                          t.changeOrientationConfirm,
                          [
                            { text: t.cancel, style: 'cancel' },
                            { text: t.changeOrientationConfirmButton || 'Change', onPress: () => { setImages([]); setImageOrientation(null); } },
                          ]
                        );
                      } else {
                        setImageOrientation(null);
                      }
                    }}
                  >
                    <Text style={styles.changeOrientationText}>← {t.changeOrientation}</Text>
                  </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageList}>
                  {displayImages.map((img, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri: img.uri }} style={styles.uploadedImage} />
                      <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)}>
                        <X size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {displayImages.length < 25 && (
                    <TouchableOpacity style={styles.addImageButton} onPress={handleChoosePhoto}>
                      <Camera size={32} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                      <Text style={styles.uploadText}>{t.photo}</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
                </>
              )}
            </View>

            <View style={styles.form}>
              <Text style={styles.sectionHeader}>{t.mainInfo}</Text>

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
                  value={formData.phoneNumber}
                  onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder={t.telegramUsername}
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                value={formData.telegramUsername}
                onChangeText={(text) => setFormData({ ...formData, telegramUsername: text })}
              />
              <MakeModelFormField
                type="make"
                value={formData.makeId}
                onChange={(id) => setFormData({ ...formData, makeId: id, modelId: '' })}
                placeholder={t.brand}
                t={t}
              />
              <MakeModelFormField
                type="model"
                value={formData.modelId}
                onChange={(id) => setFormData({ ...formData, modelId: id })}
                selectedMakeId={formData.makeId}
                placeholder={t.model}
                t={t}
              />

              <TextInput
                style={styles.input}
                placeholder={t.trimLevel}
                placeholderTextColor={COLORS.textSecondary}
                value={formData.trimLevel}
                onChangeText={(text) => setFormData({ ...formData, trimLevel: text })}
              />
              <TextInput
                style={styles.input}
                placeholder={t.wheelbase}
                placeholderTextColor={COLORS.textSecondary}
                value={formData.wheelbase}
                onChangeText={(text) => setFormData({ ...formData, wheelbase: text })}
              />

              {renderDropdown(t.typeBody, formData.bodyType, 'bodyType', [t.sedan, t.hatchback, t.compactCar, t.suv, t.passenger, t.truck, t.special])}

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder={t.enterYear}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={formData.year}
                  onChangeText={(text) => setFormData({ ...formData, year: text })}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder={t.enterPrice}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                />
              </View>

              <Text style={styles.sectionHeader}>{t.specs}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.enterEngine}
                placeholderTextColor={COLORS.textSecondary}
                value={formData.engine}
                onChangeText={(text) => setFormData({ ...formData, engine: text })}
              />

              {renderDropdown(t.transmission, formData.transmission, 'transmission', [t.automatic, t.manual, t.cvt, t.robot])}
              {renderDropdown(t.drivetrain, formData.drivetrain, 'drivetrain', [t.fwd, t.rwd, t.awd, t.fourwd])}
              {renderDropdown(t.fuel, formData.fuel, 'fuel', [t.gasoline, t.diesel, t.hybrid, t.pluginHybrid, t.electric, t.gas])}

              <View>
                <Text style={styles.fieldLabel}>{t.fuelEfficiency}</Text>
                <View style={styles.fuelEfficiencyRow}>
                  <TextInput
                    style={[styles.input, styles.fuelEfficiencyInput]}
                    placeholder={formData.fuelEfficiencyUnit === 'km' ? (t.fuelEfficiencyPlaceholderKm || 'e.g. 7.5') : (t.fuelEfficiencyPlaceholderMpg || 'e.g. 28')}
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad"
                    value={formData.mpg}
                    onChangeText={(text) => setFormData({ ...formData, mpg: text })}
                  />
                  <View style={styles.unitToggle}>
                    <TouchableOpacity
                      style={[styles.unitButton, formData.fuelEfficiencyUnit === 'km' && styles.unitButtonActive]}
                      onPress={() => setFormData({ ...formData, fuelEfficiencyUnit: 'km' })}
                    >
                      <Text style={[styles.unitButtonText, formData.fuelEfficiencyUnit === 'km' && styles.unitButtonTextActive]}>
                        {t.fuelEfficiencyKm || 'L/100 km'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, formData.fuelEfficiencyUnit === 'mpg' && styles.unitButtonActive]}
                      onPress={() => setFormData({ ...formData, fuelEfficiencyUnit: 'mpg' })}
                    >
                      <Text style={[styles.unitButtonText, formData.fuelEfficiencyUnit === 'mpg' && styles.unitButtonTextActive]}>
                        {t.fuelEfficiencyMpg || 'MPG'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder={t.enterMileage}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={formData.mileage}
                onChangeText={(text) => setFormData({ ...formData, mileage: text })}
              />

              <Text style={styles.sectionHeader}>{t.conditionLabel}</Text>
              {renderDropdown(t.conditionLabel, formData.condition, 'condition', [t.excellent, t.good, t.fair, t.needsWork])}

              {renderDropdown(t.issuesLabel, formData.knownIssues, 'knownIssues', [t.issueEngine, t.issueTransmission, t.issueSuspension, t.issueElectrical, t.issueInterior, t.issueBody])}

              {/* Custom Issue Input */}
              <View style={styles.customIssueContainer}>
                <TextInput
                  style={[styles.input, styles.customIssueInput]}
                  placeholder={t.otherIssue}
                  placeholderTextColor={COLORS.textSecondary}
                  value={customIssue}
                  onChangeText={setCustomIssue}
                />
                <TouchableOpacity style={styles.addButton} onPress={addCustomIssue}>
                  <Text style={styles.addButtonText}>{t.add}</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Issues Chips */}
              {formData.knownIssues.length > 0 && (
                <View style={styles.issuesContainer}>
                  {formData.knownIssues.map((issue, index) => (
                    <View key={index} style={styles.issueChip}>
                      <Text style={styles.issueText}>{issue}</Text>
                      <TouchableOpacity onPress={() => removeIssue(issue)}>
                        <X size={14} color="#FFF" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.sectionHeader}>{t.extInt}</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder={t.bodyColor}
                  placeholderTextColor={COLORS.textSecondary}
                  value={formData.exteriorColor}
                  onChangeText={(text) => setFormData({ ...formData, exteriorColor: text })}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder={t.interiorColorInput}
                  placeholderTextColor={COLORS.textSecondary}
                  value={formData.interiorColor}
                  onChangeText={(text) => setFormData({ ...formData, interiorColor: text })}
                />
              </View>
              {renderDropdown(t.interiorMatLabel, formData.interiorMaterial, 'interiorMaterial', [t.cloth, t.leather, t.veganLeather, t.alcantara])}

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder={t.enterSeats}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={formData.seats}
                  onChangeText={(text) => setFormData({ ...formData, seats: text })}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder={t.enterDoors}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={formData.doors}
                  onChangeText={(text) => setFormData({ ...formData, doors: text })}
                />
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t.addDesc}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={4}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
              />

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitButtonText}>{t.submitListing}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  headerIcon: {
    color: COLORS.textPrimary,
    fontSize: 24,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  imageSection: {
    marginBottom: 24,
    minHeight: 120,
  },
  orientationPicker: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orientationTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orientationDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  orientationOptions: {
    flexDirection: 'row',
    gap: 20,
  },
  orientationOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: SIZES.borderRadius,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.searchBackground,
  },
  orientationOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  orientationVisual: {
    width: 60,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  orientationRect: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.6,
    borderRadius: 4,
  },
  orientationRectVertical: {
    width: 24,
    height: 48,
  },
  orientationRectHorizontal: {
    width: 48,
    height: 24,
  },
  orientationRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: COLORS.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  orientationLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  orientationLabelActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  orientationReminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: SIZES.borderRadius,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  orientationReminderIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  orientationReminderText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  changeOrientationButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  changeOrientationText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  imageList: {
    flexDirection: 'row',
  },
  imagePreviewContainer: {
    width: 120,
    height: 120,
    marginRight: 12,
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  uploadText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  form: {
    gap: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  fuelEfficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fuelEfficiencyInput: {
    flex: 1,
    minWidth: 60,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  unitButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  unitButtonActive: {
    backgroundColor: COLORS.accent,
  },
  unitButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  unitButtonTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  dropdownContainer: {
    marginBottom: 0,
  },
  selectButton: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  selectLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  selectValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  dropdownOptions: {
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.border,
    borderBottomLeftRadius: SIZES.borderRadius,
    borderBottomRightRadius: SIZES.borderRadius,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedDropdownOption: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Blue transparent
  },
  dropdownOptionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  selectedOptionText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  phoneContainer: {
    flexDirection: 'row',
    gap: 12,
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
    maxHeight: '50%',
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
  customIssueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customIssueInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  issuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  issueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  issueText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
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
});
