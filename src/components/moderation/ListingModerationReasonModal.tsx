// Phase 10 Plan 07 — Sibling (NOT generalization) of the user-domain action
// modal (D-04 discipline).
//
// COPY of the form-modal shape, NOT a re-import. The user-domain reason
// taxonomy is 4-value (spam | policy_violation | fraud | other); the
// listing-domain `ListingReasonCategory` is the 5-value taxonomy (spam
// | policy_violation | fraud | inactive_seller | other). Each domain ships
// its own modal so Phase 11 LQUAL-03 can grep audit each independently
// without cross-domain enum drift (T-10-06).
//
// Decision references (Phase 10 RESEARCH.md / CONTEXT.md):
//   D-03  — 5-value LISTING_REASON_OPTIONS taxonomy
//   D-04  — Sibling component (no cross-import from user-domain action modal)
//   D-07  — Delete branch does NOT internally escalate to typed-confirmation;
//           the parent (Plan 08) opens the typed-confirmation modal with the
//           listing-title sentinel after this modal emits its payload
//
// Pure presentational: no moderation-service imports, no axios — parent owns
// the optimistic-flip + rollback + backend call.

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import type { ListingReasonCategory } from '../../services/moderation/ModerationService';

export type ListingReasonAction = 'suspend' | 'archive' | 'delete';

export interface ListingModerationReasonModalPayload {
  reasonCategory: ListingReasonCategory;
  note?: string;
}

export interface ListingModerationReasonModalProps {
  visible: boolean;
  action: ListingReasonAction;
  carId: string;
  listingTitle: string;
  submitting?: boolean;
  onSubmit: (payload: ListingModerationReasonModalPayload) => void;
  onClose: () => void;
}

// Module-level 5-value taxonomy literal — Phase 11 LQUAL-03 greps for this
// name to audit the listing-mod surface independently of user-mod.
const LISTING_REASON_OPTIONS: Array<{ value: ListingReasonCategory; key: string }> = [
  { value: 'spam',             key: 'listingReasonSpam' },
  { value: 'policy_violation', key: 'listingReasonPolicyViolation' },
  { value: 'fraud',            key: 'listingReasonFraud' },
  { value: 'inactive_seller',  key: 'listingReasonInactiveSeller' },
  { value: 'other',            key: 'listingReasonOther' },
];

const titleKeyForAction = (action: ListingReasonAction): string =>
  action === 'suspend' ? 'listingActionSuspend' :
  action === 'archive' ? 'listingActionArchive' :
  'listingActionDelete';

// Severity-mapped confirm button background (LUI-02 visual continuity)
const confirmBgForAction = (action: ListingReasonAction): string =>
  action === 'delete' ? COLORS.destructive :
  action === 'suspend' ? COLORS.warning :
  COLORS.textSecondary;

export const ListingModerationReasonModal: React.FC<ListingModerationReasonModalProps> = ({
  visible, action, listingTitle, submitting = false, onSubmit, onClose,
}) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  // `t` contains string[] fields (260528-hmt greeting variant pools); route via
  // `unknown` so the index-signature cast still compiles. Runtime unchanged.
  const T = t as unknown as Record<string, string>;

  const [reason, setReason] = useState<ListingReasonCategory | null>(null);
  const [note, setNote] = useState<string>('');

  // Reset-on-open (mirrors the form-modal reset pattern)
  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
    }
  }, [visible, action]);

  const isValid = reason !== null;
  const headerKey = titleKeyForAction(action);

  const handleConfirm = () => {
    if (!isValid || submitting) return;
    const trimmed = note.trim();
    onSubmit({ reasonCategory: reason!, note: trimmed || undefined });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]}
            onPress={() => {}}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{T[headerKey] ?? 'Listing action'}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>{listingTitle}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={T.modalCancel ?? 'Cancel'}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                testID="listing-reason-close"
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.fieldLabel}>{T.fieldReason ?? 'Reason'}</Text>
              {LISTING_REASON_OPTIONS.map((opt) => {
                const selected = reason === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    testID={`listing-reason-${opt.value}`}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                    onPress={() => setReason(opt.value)}
                    disabled={submitting}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: submitting }}
                    accessibilityLabel={T[opt.key] ?? opt.value}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.reasonLabel}>{T[opt.key] ?? opt.value}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.fieldLabel}>{T.fieldNote ?? 'Note (optional)'}</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={T.fieldNotePlaceholder ?? ''}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                textAlignVertical="top"
                maxLength={2000}
                editable={!submitting}
              />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                testID="listing-reason-cancel"
                style={[styles.cancelButton, submitting && { opacity: 0.5 }]}
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={T.modalCancel ?? 'Cancel'}
              >
                <Text style={styles.cancelText}>{T.modalCancel ?? 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="listing-reason-confirm"
                style={[
                  styles.confirmButton,
                  { backgroundColor: confirmBgForAction(action) },
                  (!isValid || submitting) && { opacity: 0.5 },
                ]}
                onPress={handleConfirm}
                disabled={!isValid || submitting}
                accessibilityRole="button"
                accessibilityLabel={T[headerKey] ?? 'Confirm'}
                accessibilityState={{ disabled: !isValid, busy: submitting }}
              >
                <Text style={styles.confirmText}>{T.modalConfirm ?? 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SIZES.spacingSm,
    maxHeight: '88%',
    minHeight: '40%',
  },
  handle: {
    width: SIZES.bottomSheetHandleWidth,
    height: SIZES.bottomSheetHandleHeight,
    borderRadius: SIZES.bottomSheetHandleHeight / 2,
    backgroundColor: COLORS.textTertiary,
    alignSelf: 'center',
    marginBottom: SIZES.spacingSm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: SIZES.spacingMd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SIZES.spacingSm,
  },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary },
  subtitle: { ...TYPOGRAPHY.label, color: COLORS.textSecondary, marginTop: 2 },
  body: { flexShrink: 1 },
  bodyContent: {
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: SIZES.spacingMd,
    gap: SIZES.spacingSm,
  },
  fieldLabel: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.textPrimary,
    marginBottom: SIZES.spacingXs,
    marginTop: SIZES.spacingSm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingSm,
    padding: SIZES.spacingMd,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SIZES.spacingXs,
  },
  reasonRowSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.accent },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  reasonLabel: { ...TYPOGRAPHY.label, color: COLORS.textPrimary, flex: 1 },
  noteInput: {
    minHeight: 80,
    maxHeight: 160,
    padding: SIZES.spacingMd,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.label,
  },
  footer: {
    flexDirection: 'row',
    gap: SIZES.spacingMd,
    padding: SIZES.spacingLg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTapTarget,
  },
  confirmText: { ...TYPOGRAPHY.labelStrong, color: '#FFFFFF' },
});
