// Phase 10 Plan 07 — Thinner sibling of ListingModerationReasonModal.
//
// Restore is a constructive action; backend's restoreListingSchema accepts
// only `{ note?: string }` (≤2000 chars). The user-mod analog is the
// unsuspend branch of the form-modal (note-only field). Sibling rather than
// branch-inside-reason-modal so the action vocabulary stays grep-able for
// Phase 11 LQUAL-03 (D-06 + D-C symmetry per Phase 8 CONTEXT).
//
// Pure presentational: parent (Plan 08 CarDetailsScreen / Plan 10
// AdminModeration Listings tab Recover row) owns the optimistic-flip +
// backend call + rollback.

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export interface ListingRestoreModalBody {
  note?: string;
}

export interface ListingRestoreModalProps {
  visible: boolean;
  /**
   * Passed for parent-side debugging/labeling — not used in the body sent to
   * backend (restoreListingSchema accepts only `{ note? }`).
   */
  carId: string;
  submitting?: boolean;
  onSubmit: (body: ListingRestoreModalBody) => void;
  onClose: () => void;
}

export const ListingRestoreModal: React.FC<ListingRestoreModalProps> = ({
  visible, submitting = false, onSubmit, onClose,
}) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  // `t` contains string[] fields (260528-hmt greeting variant pools); route via
  // `unknown` so the index-signature cast still compiles. Runtime unchanged.
  const T = t as unknown as Record<string, string>;

  const [note, setNote] = useState<string>('');

  // Reset-on-open
  useEffect(() => {
    if (visible) {
      setNote('');
    }
  }, [visible]);

  const handleConfirm = () => {
    if (submitting) return;
    const trimmed = note.trim();
    // Omit the `note` key entirely when empty — keeps the body shape clean
    // and matches Phase 8 D-C symmetry (restoreListingSchema allows empty body)
    onSubmit(trimmed ? { note: trimmed } : {});
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
              <Text style={styles.title}>
                {T.listingRestoreHeader ?? 'Restore listing'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={T.modalCancel ?? 'Cancel'}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                testID="listing-restore-close"
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.fieldLabel}>
                {T.fieldNote ?? 'Note (optional)'}
              </Text>
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
                testID="listing-restore-cancel"
                style={[styles.cancelButton, submitting && { opacity: 0.5 }]}
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={T.modalCancel ?? 'Cancel'}
              >
                <Text style={styles.cancelText}>{T.modalCancel ?? 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="listing-restore-confirm"
                style={[styles.confirmButton, submitting && { opacity: 0.5 }]}
                onPress={handleConfirm}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={T.listingRestoreHeader ?? 'Restore'}
                accessibilityState={{ disabled: submitting, busy: submitting }}
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
    minHeight: '36%',
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
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: SIZES.spacingMd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary, flex: 1 },
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
  },
  noteInput: {
    minHeight: 100,
    maxHeight: 200,
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
    backgroundColor: COLORS.successFg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTapTarget,
  },
  confirmText: { ...TYPOGRAPHY.labelStrong, color: '#FFFFFF' },
});
