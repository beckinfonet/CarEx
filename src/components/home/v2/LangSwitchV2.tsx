import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { V2 } from './theme';

export interface LangSwitchV2Props {
  language: 'RU' | 'EN';
  setLanguage: (lang: 'RU' | 'EN') => void;
}

export const LangSwitchV2: React.FC<LangSwitchV2Props> = ({ language, setLanguage }) => {
  return (
    <TouchableOpacity
      style={styles.langSwitch}
      activeOpacity={0.85}
      onPress={() => setLanguage(language === 'RU' ? 'EN' : 'RU')}
    >
      <Text style={[styles.langText, language === 'RU' && styles.activeLang]}>RU</Text>
      <View style={styles.divider} />
      <Text style={[styles.langText, language === 'EN' && styles.activeLang]}>EN</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  langSwitch: {
    backgroundColor: V2.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: V2.border,
    alignSelf: 'flex-end',
  },
  langText: {
    color: V2.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  activeLang: {
    // Dark text on V2.blue chrome — same precedent as src/components/home/v2/FloatingSearchPill.tsx:25.
    backgroundColor: V2.blue,
    color: '#04101f',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: V2.border,
    marginHorizontal: 2,
  },
});
