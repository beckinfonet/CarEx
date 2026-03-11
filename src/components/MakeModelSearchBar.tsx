import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { OptimizedImage } from './OptimizedImage';
import { COLORS, SIZES } from '../constants/theme';
import { Search, ChevronLeft } from 'lucide-react-native';
import { getMakeLogoUrl, needsDarkLogoBg } from '../utils/makeLogos';
import { useVehicleCatalog, VehicleMake, VehicleModel } from '../hooks/useVehicleCatalog';

type Step = 'make' | 'model';

interface MakeModelSearchBarProps {
  selectedMake: VehicleMake | null;
  selectedModel: VehicleModel | null;
  onSelect: (make: VehicleMake | null, model: VehicleModel | null) => void;
  placeholder?: string;
  t?: { selectMake: string; selectModel: string; clear: string; searchWithMake?: string };
  containerStyle?: object;
}

export const MakeModelSearchBar = ({
  selectedMake,
  selectedModel,
  onSelect,
  placeholder = 'Search by make and model',
  t,
  containerStyle,
}: MakeModelSearchBarProps) => {
  const _t = t || { selectMake: 'Select Make', selectModel: 'Select Model', clear: 'Clear', searchWithMake: 'Search' };
  const { makes, models, loadingMakes, loadingModels, fetchModels } = useVehicleCatalog();
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<Step>('make');
  const [tempMake, setTempMake] = useState<VehicleMake | null>(null);

  const displayText =
    selectedMake && selectedModel
      ? `${selectedMake.name} ${selectedModel.name}`
      : selectedMake
        ? selectedMake.name
        : '';

  const openModal = () => {
    setStep('make');
    setTempMake(null);
    setModalVisible(true);
  };

  const handleSelectMake = (make: VehicleMake) => {
    setTempMake(make);
    setStep('model');
    fetchModels(make.id);
  };

  const handleSelectModel = (model: VehicleModel) => {
    onSelect(tempMake, model);
    setModalVisible(false);
  };

  const handleBack = () => {
    if (step === 'model') {
      setStep('make');
      setTempMake(null);
    } else {
      setModalVisible(false);
    }
  };

  const handleClear = () => {
    onSelect(null, null);
    setModalVisible(false);
  };

  const handleSearchWithMake = () => {
    onSelect(tempMake, null);
    setModalVisible(false);
  };

  const listData = step === 'make' ? makes : models;
  const isLoading = step === 'make' ? loadingMakes : loadingModels;
  const title = step === 'make' ? _t.selectMake : `${_t.selectModel}${tempMake ? ` (${tempMake.name})` : ''}`;

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity style={styles.touchable} onPress={openModal} activeOpacity={0.8}>
        <View style={styles.iconContainer}>
          <Search size={20} color={COLORS.textSecondary} />
        </View>
        <Text style={[styles.inputText, !displayText && styles.placeholder]}>
          {displayText || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  {step === 'model' ? (
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                      <ChevronLeft size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.backButton} />
                  )}
                  <Text style={styles.modalTitle}>{title}</Text>
                  <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                    <Text style={styles.clearText}>{_t.clear}</Text>
                  </TouchableOpacity>
                </View>

                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                  </View>
                ) : (
                  <>
                    <FlatList
                      data={listData}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.optionItem}
                          onPress={() => (step === 'make' ? handleSelectMake(item as VehicleMake) : handleSelectModel(item as VehicleModel))}
                          activeOpacity={0.7}
                        >
                          {step === 'make' && (() => {
                            const url = getMakeLogoUrl(item as VehicleMake);
                            const darkBg = needsDarkLogoBg(item as VehicleMake);
                            return url ? (
                              <View style={[styles.makeLogoContainer, darkBg && styles.makeLogoContainerDark]}>
                                <OptimizedImage source={{ uri: url }} style={styles.makeLogo} resizeMode="contain" />
                              </View>
                            ) : null;
                          })()}
                          <Text style={styles.optionText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                      style={styles.list}
                      keyboardShouldPersistTaps="handled"
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>
                          {step === 'make' ? 'No makes available' : 'No models for this make'}
                        </Text>
                      }
                    />
                    {step === 'model' && tempMake && (
                      <TouchableOpacity
                        style={styles.searchButton}
                        onPress={handleSearchWithMake}
                        activeOpacity={0.8}
                      >
                        <Search size={20} color="#000" />
                        <Text style={styles.searchButtonText}>{_t.searchWithMake || 'Search'}</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  touchable: {
    flexDirection: 'row',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconContainer: {
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  placeholder: {
    color: COLORS.textSecondary,
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
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    color: COLORS.accent,
    fontSize: 16,
  },
  list: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  makeLogoContainer: {
    width: 40,
    height: 28,
    marginRight: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeLogoContainerDark: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  makeLogo: {
    width: 32,
    height: 24,
    resizeMode: 'contain',
  },
  optionText: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 24,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    gap: 8,
  },
  searchButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
