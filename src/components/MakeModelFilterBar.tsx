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
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { X, Check, Search } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { OptimizedImage } from './OptimizedImage';
import { getMakeLogoUrl, needsDarkLogoBg } from '../utils/makeLogos';
import { useVehicleCatalog, VehicleMake, VehicleModel } from '../hooks/useVehicleCatalog';

interface MakeModelFilterBarProps {
  selectedMake: VehicleMake | null;
  selectedModel: VehicleModel | null;
  onSelect: (make: VehicleMake | null, model: VehicleModel | null) => void;
  t?: { selectMake: string; selectModel: string; make: string; model: string; searchWithMake?: string };
  containerStyle?: object;
}

export const MakeModelFilterBar = ({
  selectedMake,
  selectedModel,
  onSelect,
  t,
  containerStyle,
}: MakeModelFilterBarProps) => {
  const _t = t || { selectMake: 'Select Make', selectModel: 'Select Model', make: 'Make', model: 'Model', searchWithMake: 'Search by make' };
  const { height: windowHeight } = useWindowDimensions();
  const { makes, models, loadingMakes, loadingModels, fetchModels } = useVehicleCatalog();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [step, setStep] = useState<'make' | 'model'>('make');
  const [tempMake, setTempMake] = useState<VehicleMake | null>(null);

  const hasFilters = selectedMake != null || selectedModel != null;

  const openDropdown = () => {
    if (selectedMake) {
      setStep('model');
      setTempMake(selectedMake);
      fetchModels(selectedMake.id);
    } else {
      setStep('make');
      setTempMake(null);
    }
    setDropdownVisible(true);
  };

  const toggleDropdown = () => {
    if (dropdownVisible) {
      setDropdownVisible(false);
    } else {
      openDropdown();
    }
  };

  const handleSelectMake = (make: VehicleMake) => {
    setTempMake(make);
    setStep('model');
    fetchModels(make.id);
  };

  const handleSelectModel = (model: VehicleModel) => {
    onSelect(tempMake, model);
    setDropdownVisible(false);
  };

  const handleClearMake = () => {
    onSelect(null, null);
  };

  const handleClearModel = () => {
    onSelect(selectedMake, null);
  };

  const handleSearchWithMake = () => {
    onSelect(tempMake, null);
    setDropdownVisible(false);
  };

  const handleClearAll = () => {
    onSelect(null, null);
    setDropdownVisible(false);
  };

  const listData = step === 'make' ? makes : models;
  const isLoading = step === 'make' ? loadingMakes : loadingModels;

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={styles.filterBar}
        onPress={toggleDropdown}
        activeOpacity={0.9}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {!hasFilters && (
            <Text style={styles.placeholderText}>{_t.selectMake} / {_t.selectModel}</Text>
          )}
          {selectedMake && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{selectedMake.name}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleClearMake}
                style={styles.chipRemove}
              >
                <X size={14} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
          {selectedModel && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{selectedModel.name}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleClearModel}
                style={styles.chipRemove}
              >
                <X size={14} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {hasFilters && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <X size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal visible={dropdownVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.dropdownPanel, { height: windowHeight * 0.75 }]}>
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>
                    {step === 'make' ? _t.selectMake : `${_t.selectModel}${tempMake ? ` (${tempMake.name})` : ''}`}
                  </Text>
                </View>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                  </View>
                ) : (
                  <FlatList
                    data={listData}
                    keyExtractor={(item) => item.id}
                    style={styles.dropdownList}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      if (step === 'make') {
                        const make = item as VehicleMake;
                        const isSelected = selectedMake?.id === make.id;
                        return (
                          <TouchableOpacity
                            style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                            onPress={() => handleSelectMake(make)}
                            activeOpacity={0.7}
                          >
                            {getMakeLogoUrl(make) && (
                              <View style={[styles.makeLogoWrap, needsDarkLogoBg(make) && styles.makeLogoDark]}>
                                <OptimizedImage source={{ uri: getMakeLogoUrl(make)! }} style={styles.makeLogo} resizeMode="contain" />
                              </View>
                            )}
                            <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                              {make.name}
                            </Text>
                            {isSelected && (
                              <View style={styles.checkWrap}>
                                <Check size={18} color={COLORS.accent} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      }
                      const model = item as VehicleModel;
                      const isSelected = selectedModel?.id === model.id && selectedMake?.id === tempMake?.id;
                      return (
                        <TouchableOpacity
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                          onPress={() => handleSelectModel(model)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                            {model.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkWrap}>
                              <Check size={18} color={COLORS.accent} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>
                        {step === 'make' ? 'No makes available' : 'No models for this make'}
                      </Text>
                    }
                  />
                )}
                {step === 'model' && tempMake && (
                  <View style={styles.bottomActionsRow}>
                    <TouchableOpacity
                      style={styles.selectMakeButton}
                      onPress={() => { setStep('make'); setTempMake(null); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.selectMakeButtonText}>← {_t.selectMake}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.searchWithMakeButton}
                      onPress={handleSearchWithMake}
                      activeOpacity={0.8}
                    >
                      <Search size={20} color="#000" />
                      <Text style={styles.searchWithMakeButtonText}>{_t.searchWithMake || 'Search by make'}</Text>
                    </TouchableOpacity>
                  </View>
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
    marginBottom: 0,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipsScroll: {
    flex: 1,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  chipRemove: {
    padding: 2,
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    alignSelf: 'center',
  },
  clearAllButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dropdownPanel: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 24,
  },
  dropdownHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dropdownList: {
    flex: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  dropdownItemTextSelected: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  checkWrap: {
    marginLeft: 8,
  },
  makeLogoWrap: {
    width: 36,
    height: 24,
    marginRight: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeLogoDark: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  makeLogo: {
    width: 28,
    height: 20,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 24,
    fontSize: 15,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectMakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectMakeButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  searchWithMakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
  },
  searchWithMakeButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});
