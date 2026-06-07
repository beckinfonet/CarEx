import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

/**
 * PushPrePromptModal — the soft, in-app contextual permission pre-prompt
 * (NPRF-06, CTX D-06). Shared by WatchButton and SaveSearchBar so the single
 * fire-once ask (D-04) renders identical copy from both controls.
 *
 * COPY: plain RU-first / functional (D-06) — pushPrePromptTitle /
 * pushPrePromptBody — NOT the UNHINGED personality voice. Two actions:
 *   - "Включить" (pushEnable)  → onEnable → OS dialog + register (acceptPrePrompt)
 *   - "Не сейчас" (notNow, reused) → onNotNow → persist seen, never re-ask
 *
 * This component renders NOTHING and requests NO permission unless `visible` is
 * true — it never appears on launch/mount (the parent gates `visible` on a
 * subscription success + the shouldShowPrePrompt flag).
 */
interface PushPrePromptModalProps {
  visible: boolean;
  onEnable: () => void;
  onNotNow: () => void;
}

export const PushPrePromptModal = ({
  visible,
  onEnable,
  onNotNow,
}: PushPrePromptModalProps) => {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNotNow}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID="push-preprompt">
          <Text style={styles.title}>{t.pushPrePromptTitle}</Text>
          <Text style={styles.body}>{t.pushPrePromptBody}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onNotNow}
              accessibilityRole="button"
              accessibilityLabel={t.notNow}
              testID="push-preprompt-notnow"
            >
              <Text style={styles.secondaryText}>{t.notNow}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onEnable}
              accessibilityRole="button"
              accessibilityLabel={t.pushEnable}
              testID="push-preprompt-enable"
            >
              <Text style={styles.primaryText}>{t.pushEnable}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.spacingLg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.spacingLg,
  },
  title: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    marginBottom: SIZES.spacingSm,
  },
  body: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SIZES.spacingLg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SIZES.spacingSm,
  },
  secondaryBtn: {
    minHeight: SIZES.minTapTarget,
    paddingHorizontal: SIZES.spacingMd,
    borderRadius: SIZES.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  primaryBtn: {
    minHeight: SIZES.minTapTarget,
    paddingHorizontal: SIZES.spacingMd,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accent,
    fontWeight: '600',
  },
});

export default PushPrePromptModal;
