import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { X } from 'lucide-react-native';

interface FilterModalProps {
  visible: boolean;
  type: string | null;
  onClose: () => void;
  onApply: (filterType: string, value: any) => void;
  currentValue: any;
  t: any;
}

export const FilterModal = ({ visible, type, onClose, onApply, currentValue, t }: FilterModalProps) => {
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (typeof currentValue === 'object' && currentValue !== null) {
        setMinVal(currentValue.min || '');
        setMaxVal(currentValue.max || '');
        setSelectedOption(null);
      } else {
        setSelectedOption(currentValue);
        setMinVal('');
        setMaxVal('');
      }
    }
  }, [visible, currentValue]);

  const handleApply = () => {
    if (!type) return;

    if (['Год', 'Цена', 'Пробег'].includes(type)) {
      onApply(type, { min: minVal, max: maxVal });
    } else {
      onApply(type, selectedOption);
    }
    onClose();
  };

  const handleClear = () => {
    if (!type) return;
    onApply(type, null);
    onClose();
  };

  const getTitle = (type: string | null) => {
    switch(type) {
      case 'Год': return t.year;
      case 'Цена': return t.price;
      case 'Топливо': return t.fuel;
      case 'КПП': return t.transmission;
      case 'Пробег': return t.mileage;
      default: return type;
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'Год':
      case 'Цена':
      case 'Пробег':
        return (
          <View style={styles.rangeContainer}>
            <TextInput
              style={styles.input}
              placeholder={t.from}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={minVal}
              onChangeText={setMinVal}
            />
            <Text style={styles.rangeText}>-</Text>
            <TextInput
              style={styles.input}
              placeholder={t.to}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={maxVal}
              onChangeText={setMaxVal}
            />
          </View>
        );
      case 'Топливо':
        return (
          <View style={styles.optionsContainer}>
            {[t.gasoline, t.diesel, t.electric, t.hybrid, t.pluginHybrid, t.gas].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionButton, selectedOption === opt && styles.selectedOption]}
                onPress={() => setSelectedOption(opt)}
              >
                <Text style={[styles.optionText, selectedOption === opt && styles.selectedOptionText]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 'КПП':
        return (
          <View style={styles.optionsContainer}>
            {[t.automatic, t.manual, t.cvt, t.robot].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionButton, selectedOption === opt && styles.selectedOption]}
                onPress={() => setSelectedOption(opt)}
              >
                <Text style={[styles.optionText, selectedOption === opt && styles.selectedOptionText]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>{getTitle(type)}</Text>
                <TouchableOpacity onPress={onClose}>
                  <X size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {renderContent()}

              <View style={styles.footer}>
                <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                  <Text style={styles.clearButtonText}>{t.reset}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                  <Text style={styles.applyButtonText}>{t.apply}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.cardBackground,
    width: '100%',
    borderRadius: SIZES.borderRadius,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  input: {
    backgroundColor: COLORS.searchBackground,
    flex: 1,
    padding: 12,
    borderRadius: 8,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rangeText: {
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.searchBackground,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  optionText: {
    color: COLORS.textSecondary,
  },
  selectedOptionText: {
    color: '#000',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  clearButton: {
    padding: 12,
  },
  clearButtonText: {
    color: COLORS.textSecondary,
  },
  applyButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});

