import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

// Format: array of segment lengths. e.g. [2, 4, 4] = XX-XXXX-XXXX
export const COUNTRY_FORMATS: Record<string, number[]> = {
  KR: [2, 4, 4],   // 10-1234-5678
  KG: [3, 3, 3],   // 555-123-456
  KZ: [3, 3, 2, 2], // 777-123-45-67
  UZ: [2, 3, 2, 2], // 90-123-45-67
  CN: [3, 4, 4],   // 138-0013-8000
  RU: [3, 3, 2, 2], // 912-345-67-89
};

const DEFAULT_FORMAT = [3, 4, 4]; // fallback for unknown countries

interface PhoneNumberFormatterProps {
  countryCode: string;
  value: string;
  onChange: (digits: string) => void;
  style?: ViewStyle;
  editable?: boolean;
}

export const PhoneNumberFormatter: React.FC<PhoneNumberFormatterProps> = ({
  countryCode,
  value,
  onChange,
  style,
  editable = true,
}) => {
  const pattern = COUNTRY_FORMATS[countryCode] ?? DEFAULT_FORMAT;
  const totalDigits = pattern.reduce((a, b) => a + b, 0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Parse value into digit array
  const digits = value.replace(/\D/g, '').split('').slice(0, totalDigits);

  const setDigit = (index: number, char: string) => {
    const newDigits = [...digits];
    if (char === '') {
      newDigits[index] = '';
    } else if (/\d/.test(char)) {
      newDigits[index] = char;
    }
    const result = newDigits.filter(Boolean).join('').slice(0, totalDigits);
    onChange(result);
  };

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleChange = (index: number, text: string) => {
    if (text.length > 1) {
      // Paste: take only digits and fill
      const pastedDigits = text.replace(/\D/g, '').split('');
      const newValue = Array(totalDigits).fill('');
      digits.forEach((d, i) => { newValue[i] = d; });
      pastedDigits.forEach((d, i) => {
        if (index + i < totalDigits) newValue[index + i] = d;
      });
      onChange(newValue.filter(Boolean).join('').slice(0, totalDigits));
      const nextIdx = Math.min(index + pastedDigits.length, totalDigits - 1);
      focusInput(nextIdx);
      return;
    }
    if (text === '') {
      setDigit(index, '');
      if (index > 0) focusInput(index - 1);
    } else {
      setDigit(index, text);
      if (index < totalDigits - 1) focusInput(index + 1);
    }
  };

  // Build flat index list for rendering
  const boxes: { index: number; isSeparator: boolean }[] = [];
  let idx = 0;
  pattern.forEach((len, segIdx) => {
    if (segIdx > 0) boxes.push({ index: -1, isSeparator: true });
    for (let i = 0; i < len; i++) {
      boxes.push({ index: idx++, isSeparator: false });
    }
  });

  return (
    <View style={[styles.container, style]}>
      {boxes.map((item, i) =>
        item.isSeparator ? (
          <View key={`sep-${i}`} style={styles.separator}>
            <Text style={styles.separatorText}>-</Text>
          </View>
        ) : (
          <TextInput
            key={item.index}
            ref={(r) => { inputRefs.current[item.index] = r; }}
            style={[styles.digitBox, digits[item.index] && styles.digitBoxFilled]}
            value={digits[item.index] || ''}
            onChangeText={(t) => handleChange(item.index, t)}
            keyboardType="number-pad"
            maxLength={totalDigits}
            selectTextOnFocus
            editable={editable}
            placeholder=""
          />
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  digitBox: {
    flex: 1,
    minWidth: 18,
    height: 36,
    backgroundColor: COLORS.searchBackground,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    padding: 0,
    marginHorizontal: 1,
  },
  digitBoxFilled: {
    borderColor: '#3D4A5C',
  },
  separator: {
    width: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
