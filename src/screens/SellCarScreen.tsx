import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';

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
  });

  const handleChoosePhoto = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 5 - images.length, // Allow remaining slots
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

  const handleSubmit = async () => {
    if (images.length === 0 || !formData.make || !formData.model || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields and upload at least one image.');
      return;
    }

    setLoading(true);

    const data = new FormData();
    data.append('make', formData.make);
    data.append('model', formData.model);
    data.append('year', formData.year);
    data.append('price', formData.price);
    data.append('mileage', formData.mileage);
    data.append('fuel', formData.fuel);
    data.append('bodyType', formData.bodyType);
    data.append('description', formData.description);

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
      await axios.post('http://localhost:5001/api/cars', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      Alert.alert('Success', 'Car listed successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Upload Error Details:', error);
      if (error.response) {
        Alert.alert('Error', `Upload failed: ${error.response.data.message || error.response.status}`);
      } else {
        Alert.alert('Error', 'Failed to create upload request.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.headerIcon}>←</Text>
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
                            <Text style={styles.removeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                ))}
                {images.length < 5 && (
                    <TouchableOpacity style={styles.addImageButton} onPress={handleChoosePhoto}>
                         <Text style={styles.uploadIcon}>📷</Text>
                         <Text style={styles.uploadText}>Фото</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>

        <View style={styles.form}>
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
          <TextInput
            style={styles.input}
            placeholder="Пробег (км)"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
            value={formData.mileage}
            onChangeText={(text) => setFormData({ ...formData, mileage: text })}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Описание"
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    marginTop: 8,
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
