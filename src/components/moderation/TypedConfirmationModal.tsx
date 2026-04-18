import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export type DestructiveAction = 'delete_profile' | 'revoke_role' | 'permanently_banned';

export interface TypedConfirmationModalProps {
  visible: boolean;
  action: DestructiveAction;
  targetEmail: string;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const BODY_KEY_FOR_ACTION: Record<DestructiveAction, string> = {
  delete_profile: 'typedConfirmWarningBodyDelete',
  revoke_role: 'typedConfirmWarningBodyRevoke',
  permanently_banned: 'typedConfirmWarningBodyPermaBan',
};

export const TypedConfirmationModal: React.FC<TypedConfirmationModalProps> = ({
  visible, action, targetEmail, submitting = false, onConfirm, onClose,
}) => {
  const { t } = useLanguage();
  const T = t as Record<string, string>;
  const [typed, setTyped] = useState('');

  // Reset on open
  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const normalized = typed.trim().toLowerCase();
  const targetNormalized = targetEmail.trim().toLowerCase();
  const matches = normalized.length > 0 && normalized === targetNormalized;
  const dirty = typed.length > 0;

  const borderColor = matches ? COLORS.successFg : (dirty ? COLORS.destructive : COLORS.border);

  const hint = T.typedConfirmHint?.replace('{email}', targetEmail) ?? targetEmail;

  const handleConfirm = () => {
    if (!matches || submitting) return;
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.warningBanner}>
              <AlertTriangle size={20} color={COLORS.destructive} />
              <Text style={styles.warningHeading}>{T.typedConfirmWarningHeading}</Text>
            </View>

            <Text style={styles.warningBody}>{T[BODY_KEY_FOR_ACTION[action]]}</Text>

            <Text style={styles.instruction}>{hint}</Text>

            <TextInput
              style={[styles.input, { borderColor }]}
              value={typed}
              onChangeText={setTyped}
              placeholder={T.typedConfirmInputPlaceholder}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />

            {dirty && !matches && (
              <Text style={styles.mismatchHint}>{T.typedConfirmMismatch}</Text>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cancelButton, submitting && { opacity: 0.5 }]}
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={T.modalCancel}
              >
                <Text style={styles.cancelText}>{T.modalCancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, (!matches || submitting) && { opacity: 0.5 }]}
                onPress={handleConfirm}
                disabled={!matches || submitting}
                accessibilityRole="button"
                accessibilityLabel={T.modalConfirm}
                accessibilityState={{ disabled: !matches, busy: submitting }}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.confirmText}>{T.modalConfirm}</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacingMd,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: SIZES.spacingLg,
    borderRadius: SIZES.radiusMd,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.destructive,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingSm,
    paddingVertical: SIZES.spacingSm,
    paddingHorizontal: SIZES.spacingSm,
    borderRadius: SIZES.radiusSm,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  warningHeading: { ...TYPOGRAPHY.labelStrong, color: COLORS.destructive, flex: 1 },
  warningBody: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SIZES.spacingMd },
  instruction: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, marginTop: SIZES.spacingLg },
  input: {
    marginTop: SIZES.spacingSm,
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: 12,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.label,
    minHeight: SIZES.minTapTarget,
  },
  mismatchHint: { ...TYPOGRAPHY.body, color: COLORS.destructive, marginTop: SIZES.spacingXs },
  footer: { flexDirection: 'row', gap: SIZES.spacingMd, marginTop: SIZES.spacingLg },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTapTarget,
  },
  cancelText: { ...TYPOGRAPHY.labelStrong, color: COLORS.textSecondary },
  confirmButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTapTarget,
  },
  confirmText: { ...TYPOGRAPHY.labelStrong, color: '#FFFFFF' },
});
