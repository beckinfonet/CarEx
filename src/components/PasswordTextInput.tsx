import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export type PasswordTextInputProps = Omit<TextInputProps, 'secureTextEntry'>;

export function PasswordTextInput({ style, ...props }: PasswordTextInputProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput {...props} secureTextEntry={!visible} style={[style, styles.inputPad]} />
      <TouchableOpacity
        style={styles.iconHit}
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? t.hidePassword : t.showPassword}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        disabled={props.editable === false}
      >
        {visible ? (
          <EyeOff size={22} color={COLORS.textSecondary} strokeWidth={2} />
        ) : (
          <Eye size={22} color={COLORS.textSecondary} strokeWidth={2} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputPad: {
    paddingRight: 52,
  },
  iconHit: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
