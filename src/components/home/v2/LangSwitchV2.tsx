import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { LocaleGlobe } from './LocaleGlobe';
import { useTypography } from '../../../hooks/useTypography';

export interface LangSwitchV2Props {
  language: 'RU' | 'EN';
  setLanguage: (lang: 'RU' | 'EN') => void;
}

export const LangSwitchV2: React.FC<LangSwitchV2Props> = ({ language, setLanguage }) => {
  const typo = useTypography();
  const next: 'RU' | 'EN' = language === 'RU' ? 'EN' : 'RU';
  return (
    <TouchableOpacity
      style={styles.pill}
      activeOpacity={0.85}
      onPress={() => setLanguage(next)}
      accessibilityRole="button"
      accessibilityLabel={`Language: ${language}`}
      accessibilityHint="Double tap to switch language"
    >
      <LocaleGlobe size={16} />
      <Text
        allowFontScaling={false}
        style={[styles.code, { fontFamily: typo.display }]}
      >
        {language}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 10,
    gap: 6,
    borderRadius: 999,
    backgroundColor: V2.surface,
    borderWidth: 1,
    borderColor: V2.border,
    alignSelf: 'flex-end',
  },
  code: {
    color: V2.text,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.34,
  },
});
