import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { COLORS } from '../constants/theme';
import { TRANSLATIONS } from '../constants/translations';
import {
  getPasswordRequirementChecks,
  type PasswordRequirementId,
} from '../utils/passwordPolicy';

type TDict = typeof TRANSLATIONS.RU;

const ROWS: { id: PasswordRequirementId; getLabel: (t: TDict) => string }[] = [
  { id: 'length', getLabel: (t) => t.passwordReqLength },
  { id: 'uppercase', getLabel: (t) => t.passwordReqUppercase },
  { id: 'number', getLabel: (t) => t.passwordReqNumber },
  { id: 'symbol', getLabel: (t) => t.passwordReqSymbol },
];

type Props = {
  password: string;
};

export function PasswordRequirements({ password }: Props) {
  const { t } = useLanguage();

  const checks = useMemo(() => {
    const list = getPasswordRequirementChecks(password);
    return new Map(list.map((c) => [c.id, c.met]));
  }, [password]);

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={styles.hint}>{t.passwordRequirementsHint}</Text>
      {ROWS.map(({ id, getLabel }) => {
        const met = checks.get(id) ?? false;
        return (
          <View key={id} style={styles.row} accessibilityRole="text">
            {met ? (
              <Check size={18} color={COLORS.success} strokeWidth={2.5} accessibilityLabel={t.passwordReqMet} />
            ) : (
              <Circle size={18} color={COLORS.textTertiary} strokeWidth={2} accessibilityLabel={t.passwordReqNotMet} />
            )}
            <Text style={[styles.label, met ? styles.labelMet : styles.labelPending]}>{getLabel(t)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: -4,
    marginBottom: 8,
    gap: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
    color: COLORS.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
  labelMet: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  labelPending: {
    color: COLORS.textSecondary,
  },
});
