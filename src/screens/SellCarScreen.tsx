import React, { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { ArrowLeft, Camera, X, ChevronDown } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const COUNTRIES = [
  { code: 'KR', name: 'South Korea', dial_code: '+82', flag: '🇰🇷', placeholder: '10-1234-5678' },
  { code: 'KG', name: 'Kyrgyzstan', dial_code: '+996', flag: '🇰🇬', placeholder: '555-123-456' },
  { code: 'KZ', name: 'Kazakhstan', dial_code: '+7', flag: '🇰🇿', placeholder: '777-123-45-67' },
  { code: 'UZ', name: 'Uzbekistan', dial_code: '+998', flag: '🇺🇿', placeholder: '90-123-45-67' },
  { code: 'CN', name: 'China', dial_code: '+86', flag: '🇨🇳', placeholder: '138-0013-8000' },
  { code: 'RU', name: 'Russia', dial_code: '+7', flag: '🇷🇺', placeholder: '912-345-67-89' },
];

export const SellCarScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Asset[]>([]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default KR

  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    price: '',
    mileage: '',
    fuel: t.gasoline,
    bodyType: t.sedan,
    description: '',
    // New Fields
    engine: '',
    transmission: 'Automatic',
    drivetrain: t.fwd,
    mpg: '',
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
    checkProfileAndAutofill();
  }, [user]);

  const checkProfileAndAutofill = () => {
    if (!user) return; // Should be handled by Auth protection usually

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

  const handleChoosePhoto = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 25 - images.length,
    });

    if (result.assets && result.assets.length > 0) {
      setImages([...images, ...result.assets]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

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

  const handleSubmit = async () => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }

    if (images.length === 0 || !formData.make || !formData.model || !formData.price || !formData.phoneNumber) {
      Alert.alert('Error', 'Please fill in all required fields (including phone number) and upload at least one image.');
      return;
    }

    // Combine country code and phone number
    const fullPhoneNumber = `${selectedCountry.dial_code}${formData.phoneNumber.replace(/^0+/, '')}`; // Remove leading zeros if any

    // Basic phone validation (ensure it has digits and length is reasonable)
    const cleanPhone = fullPhoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);

    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'knownIssues') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (key === 'phoneNumber') {
        data.append(key, fullPhoneNumber);
      } else {
        // @ts-ignore
        data.append(key, formData[key]);
      }
    });

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
      await axios.post(`${API_URL}/api/cars`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Car listed successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Upload Error Details:', error);
      Alert.alert('Error', 'Failed to upload car listing.');
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.sellHeader}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.imageSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageList}>
            {images.map((img, index) => (
              <View key={index} style={styles.imagePreviewContainer}>
                <Image source={{ uri: img.uri }} style={styles.uploadedImage} />
                <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)}>
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 25 && (
              <TouchableOpacity style={styles.addImageButton} onPress={handleChoosePhoto}>
                <Camera size={32} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                <Text style={styles.uploadText}>{t.photo}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
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
          <TextInput
            style={styles.input}
            placeholder={t.brand}
            placeholderTextColor={COLORS.textSecondary}
            value={formData.make}
            onChangeText={(text) => setFormData({ ...formData, make: text })}
          />
          <TextInput
            style={styles.input}
            placeholder={t.model}
            placeholderTextColor={COLORS.textSecondary}
            value={formData.model}
            onChangeText={(text) => setFormData({ ...formData, model: text })}
          />

          {renderDropdown(t.typeBody, formData.bodyType, 'bodyType', [t.sedan, t.suv, t.passenger, t.truck, t.special])}

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
          {renderDropdown(t.fuel, formData.fuel, 'fuel', [t.gasoline, t.diesel, t.hybrid, t.pluginHybrid, t.electric])}

          <TextInput
            style={styles.input}
            placeholder={t.mpgRange}
            placeholderTextColor={COLORS.textSecondary}
            value={formData.mpg}
            onChangeText={(text) => setFormData({ ...formData, mpg: text })}
          />
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
    height: 120,
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
});
