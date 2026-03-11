import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { ChevronDown } from 'lucide-react-native';
import { useVehicleCatalog, VehicleMake, VehicleModel } from '../hooks/useVehicleCatalog';
import { getMakeLogoUrl, needsDarkLogoBg } from '../utils/makeLogos';
import { OptimizedImage } from './OptimizedImage';

interface MakeModelFormFieldProps {
  type: 'make' | 'model';
  value: string; // ID
  onChange: (value: string) => void;
  selectedMakeId?: string | null; // Required when type is 'model'
  placeholder: string;
  label?: string;
  t?: { selectMake: string; selectModel: string; done: string };
}

export const MakeModelFormField = ({
  type,
  value,
  onChange,
  selectedMakeId,
  placeholder,
  label,
  t,
}: MakeModelFormFieldProps) => {
  const _t = t || {
    selectMake: 'Select Make',
    selectModel: 'Select Model',
    done: 'Done',
  };
  const { makes, models, loadingMakes, loadingModels, fetchModels } = useVehicleCatalog();
  const [modalVisible, setModalVisible] = useState(false);

  const isModel = type === 'model';
  const disabled = isModel && !selectedMakeId?.trim();
  const options = isModel ? models : makes;
  const loading = isModel ? loadingModels : loadingMakes;

  const displayName = value
    ? (isModel ? models.find((m) => m.id === value)?.name : makes.find((m) => m.id === value)?.name) || value
    : '';

  const selectedMakeName = selectedMakeId ? makes.find((m) => m.id === selectedMakeId)?.name : '';

  useEffect(() => {
    if (isModel && selectedMakeId?.trim()) {
      fetchModels(selectedMakeId);
    }
  }, [isModel, selectedMakeId, fetchModels]);

  const openModal = () => {
    if (disabled) return;
    if (isModel && selectedMakeId) {
      fetchModels(selectedMakeId);
    }
    setModalVisible(true);
  };

  const handleSelect = (item: VehicleMake | VehicleModel) => {
    onChange(item.id);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.touchable, disabled && styles.touchableDisabled]}
        onPress={openModal}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <Text style={[styles.valueText, !displayName && styles.placeholder]}>
          {displayName || placeholder}
        </Text>
        <ChevronDown size={20} color={disabled ? COLORS.textSecondary : COLORS.textPrimary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {isModel ? `${_t.selectModel} (${selectedMakeName})` : _t.selectMake}
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.doneText}>{_t.done}</Text>
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                  </View>
                ) : (
                  <FlatList
                    data={options}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.optionItem, value === item.id && styles.optionItemSelected]}
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.7}
                      >
                        {!isModel && (() => {
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
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>
                        {isModel ? 'No models for this make' : 'No makes available'}
                      </Text>
                    }
                  />
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
    marginBottom: 12,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  touchable: {
    flexDirection: 'row',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  touchableDisabled: {
    opacity: 0.6,
  },
  valueText: {
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
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  doneText: {
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
  optionItemSelected: {
    backgroundColor: COLORS.accent + '20',
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
});
