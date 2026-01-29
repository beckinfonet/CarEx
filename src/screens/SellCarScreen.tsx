import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { ArrowLeft, Camera, X } from 'lucide-react-native';

export const SellCarScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Asset[]>([]);
  
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    price: '',
    mileage: '',
    fuel: 'Бензин',
    bodyType: 'Седан',
    description: '',
    // New Fields
    engine: '',
    transmission: 'Automatic',
    drivetrain: 'FWD',
    mpg: '',
    condition: 'Excellent',
    knownIssues: [] as string[],
    exteriorColor: '',
    interiorColor: '',
    interiorMaterial: 'Leather',
    seats: '',
    doors: '',
  });

  const [expandedField, setExpandedField] = useState<string | null>(null);

  const handleChoosePhoto = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 5 - images.length,
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

  const handleSubmit = async () => {
    if (images.length === 0 || !formData.make || !formData.model || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields and upload at least one image.');
      return;
    }

    setLoading(true);

    const data = new FormData();
    Object.keys(formData).forEach(key => {
        if (key === 'knownIssues') {
            data.append(key, JSON.stringify(formData[key]));
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
        ? (value.length > 0 ? value.join(', ') : 'Нет') 
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
        <Text style={styles.headerTitle}>Продать авто</Text>
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
                {images.length < 5 && (
                    <TouchableOpacity style={styles.addImageButton} onPress={handleChoosePhoto}>
                         <Camera size={32} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                         <Text style={styles.uploadText}>Фото</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>

        <View style={styles.form}>
            <Text style={styles.sectionHeader}>Основная информация</Text>
            <TextInput
                style={styles.input}
                placeholder="Марка (например, BMW)"
                placeholderTextColor={COLORS.textSecondary}
                value={formData.make}
                onChangeText={(text) => setFormData({ ...formData, make: text })}
            />
            <TextInput
                style={styles.input}
                placeholder="Модель (например, X5)"
                placeholderTextColor={COLORS.textSecondary}
                value={formData.model}
                onChangeText={(text) => setFormData({ ...formData, model: text })}
            />
            <TextInput
                style={styles.input}
                placeholder="Тип кузова (Седан, SUV...)"
                placeholderTextColor={COLORS.textSecondary}
                value={formData.bodyType}
                onChangeText={(text) => setFormData({ ...formData, bodyType: text })}
            />
            <View style={styles.row}>
                <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Год"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={formData.year}
                onChangeText={(text) => setFormData({ ...formData, year: text })}
                />
                <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Цена ($)"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                />
            </View>

            <Text style={styles.sectionHeader}>Характеристики</Text>
            <TextInput
                style={styles.input}
                placeholder="Двигатель (e.g., 3.0L V6)"
                placeholderTextColor={COLORS.textSecondary}
                value={formData.engine}
                onChangeText={(text) => setFormData({ ...formData, engine: text })}
            />
            
            {renderDropdown('Трансмиссия', formData.transmission, 'transmission', ['Automatic', 'Manual', 'CVT'])}
            {renderDropdown('Привод', formData.drivetrain, 'drivetrain', ['FWD', 'RWD', 'AWD', '4WD'])}
            {renderDropdown('Топливо', formData.fuel, 'fuel', ['Gasoline', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric'])}
            
            <TextInput
                style={styles.input}
                placeholder="MPG / Запас хода"
                placeholderTextColor={COLORS.textSecondary}
                value={formData.mpg}
                onChangeText={(text) => setFormData({ ...formData, mpg: text })}
            />
            <TextInput
                style={styles.input}
                placeholder="Пробег (км)"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={formData.mileage}
                onChangeText={(text) => setFormData({ ...formData, mileage: text })}
            />

            <Text style={styles.sectionHeader}>Состояние</Text>
            {renderDropdown('Общее состояние', formData.condition, 'condition', ['Excellent', 'Good', 'Fair', 'Needs Work'])}
            
            {renderDropdown('Известные проблемы', formData.knownIssues, 'knownIssues', ['Engine', 'Transmission', 'Suspension', 'Electrical', 'Interior', 'Body/Cosmetic'])}

            <Text style={styles.sectionHeader}>Экстерьер / Интерьер</Text>
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Цвет кузова"
                    placeholderTextColor={COLORS.textSecondary}
                    value={formData.exteriorColor}
                    onChangeText={(text) => setFormData({ ...formData, exteriorColor: text })}
                />
                <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Цвет салона"
                    placeholderTextColor={COLORS.textSecondary}
                    value={formData.interiorColor}
                    onChangeText={(text) => setFormData({ ...formData, interiorColor: text })}
                />
            </View>
            {renderDropdown('Материал салона', formData.interiorMaterial, 'interiorMaterial', ['Cloth', 'Leather', 'Vegan Leather', 'Alcantara'])}
            
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Мест"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    value={formData.seats}
                    onChangeText={(text) => setFormData({ ...formData, seats: text })}
                />
                <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Дверей"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    value={formData.doors}
                    onChangeText={(text) => setFormData({ ...formData, doors: text })}
                />
            </View>

            <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Дополнительное описание"
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
                    <Text style={styles.submitButtonText}>Разместить объявление</Text>
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
});
