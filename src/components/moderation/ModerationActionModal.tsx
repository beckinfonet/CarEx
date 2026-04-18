import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, AlertTriangle } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import type {
  SearchUserItem,
  Severity,
  ReasonCategory,
  RevokableRole,
  ProviderRole,
  SuspendBody,
  UnsuspendBody,
  RevokeRoleBody,
  EditProfileBody,
} from '../../services/moderation/ModerationService';

export type ModerationActionType = 'suspend' | 'unsuspend' | 'revoke_role' | 'edit_profile';

export type ModerationActionPayload =
  | { action: 'suspend'; body: SuspendBody }
  | { action: 'unsuspend'; body: UnsuspendBody }
  | { action: 'revoke_role'; body: RevokeRoleBody }
  | { action: 'edit_profile'; body: EditProfileBody };

export interface ModerationActionModalProps {
  visible: boolean;
  action: ModerationActionType;
  target: SearchUserItem;
  initialEditValues?: Partial<EditProfileBody['fields']>;
  submitting?: boolean;
  onSubmit: (payload: ModerationActionPayload) => void;
  onClose: () => void;
}

const SEVERITY_OPTIONS: Array<{ value: Severity; titleKey: string; descKey: string }> = [
  { value: 'feature_limited',     titleKey: 'severityFeatureLimited',     descKey: 'severityFeatureLimitedDesc' },
  { value: 'blocked_with_review', titleKey: 'severityBlockedWithReview',  descKey: 'severityBlockedWithReviewDesc' },
  { value: 'permanently_banned',  titleKey: 'severityPermanentlyBanned',  descKey: 'severityPermanentlyBannedDesc' },
];

const REASON_OPTIONS: Array<{ value: ReasonCategory; key: string }> = [
  { value: 'spam',              key: 'reasonSpam' },
  { value: 'policy_violation',  key: 'reasonPolicyViolation' },
  { value: 'fraud',             key: 'reasonFraud' },
  { value: 'other',             key: 'reasonOther' },
];

const titleKeyForAction = (action: ModerationActionType): string =>
  action === 'suspend' ? 'actionSuspend' :
  action === 'unsuspend' ? 'actionUnsuspend' :
  action === 'revoke_role' ? 'actionRevokeRole' :
  'actionEditProfile';

const confirmKeyForAction = (action: ModerationActionType): string =>
  action === 'suspend' ? 'confirmSuspend' :
  action === 'unsuspend' ? 'confirmUnsuspend' :
  action === 'revoke_role' ? 'confirmRevokeRole' :
  'confirmEditProfile';

export const ModerationActionModal: React.FC<ModerationActionModalProps> = ({
  visible, action, target, initialEditValues, submitting = false, onSubmit, onClose,
}) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const T = t as Record<string, string>;

  // ---- per-action state ----
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [reason, setReason] = useState<ReasonCategory | null>(null);
  const [note, setNote] = useState<string>('');
  const [revokeRoleValue, setRevokeRoleValue] = useState<RevokableRole | null>(null);
  const [editRole, setEditRole] = useState<ProviderRole>(
    target.brokerStatus === 'APPROVED' ? 'broker' :
    target.logisticsStatus === 'APPROVED' ? 'logistics' : 'broker',
  );
  const [editFields, setEditFields] = useState<Partial<EditProfileBody['fields']>>(
    initialEditValues ?? {},
  );

  // Reset state every time the modal opens for a new action+target
  useEffect(() => {
    if (visible) {
      setSeverity(null);
      setReason(null);
      setNote('');
      setRevokeRoleValue(null);
      setEditFields(initialEditValues ?? {});
    }
  }, [visible, action, target.localId, initialEditValues]);

  // ---- which roles are revokable on this target ----
  const revokableRoles = useMemo(() => {
    const r: RevokableRole[] = [];
    if (target.sellerStatus === 'APPROVED') r.push('seller');
    if (target.brokerStatus === 'APPROVED') r.push('broker');
    if (target.logisticsStatus === 'APPROVED') r.push('logistics');
    return r;
  }, [target]);

  // ---- isValid per action ----
  const editHasChanges = useMemo(() => {
    return Object.keys(editFields).some((k) => {
      const before = (initialEditValues ?? {})[k as keyof EditProfileBody['fields']];
      const after = editFields[k as keyof EditProfileBody['fields']];
      return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
    });
  }, [editFields, initialEditValues]);

  const isValid =
    action === 'suspend'      ? !!severity && !!reason :
    action === 'unsuspend'    ? true :
    action === 'revoke_role'  ? !!revokeRoleValue && !!reason :
    /* edit_profile */          editHasChanges;

  const handleConfirm = () => {
    if (!isValid || submitting) return;
    if (action === 'suspend') {
      onSubmit({ action: 'suspend', body: { severity: severity!, reasonCategory: reason!, note: note || undefined } });
    } else if (action === 'unsuspend') {
      onSubmit({ action: 'unsuspend', body: { note: note || undefined } });
    } else if (action === 'revoke_role') {
      onSubmit({ action: 'revoke_role', body: { role: revokeRoleValue!, reasonCategory: reason!, note: note || undefined } });
    } else {
      onSubmit({ action: 'edit_profile', body: { role: editRole, fields: editFields } });
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{T[titleKeyForAction(action)]}</Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={T.modalCancel}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.targetEmail} numberOfLines={1}>{target.email}</Text>

              {action === 'suspend' && (
                <>
                  <FieldLabel text={T.fieldSeverity} />
                  {SEVERITY_OPTIONS.map((opt) => (
                    <SeverityCard
                      key={opt.value}
                      title={T[opt.titleKey]}
                      desc={T[opt.descKey]}
                      selected={severity === opt.value}
                      isPermaBan={opt.value === 'permanently_banned'}
                      onPress={() => setSeverity(opt.value)}
                      disabled={submitting}
                    />
                  ))}

                  <FieldLabel text={T.fieldReason} />
                  <ReasonPills value={reason} onChange={setReason} disabled={submitting} t={T} />

                  <FieldLabel text={T.fieldNote} />
                  <NoteField value={note} onChange={setNote} placeholder={T.fieldNotePlaceholder} disabled={submitting} />
                </>
              )}

              {action === 'unsuspend' && (
                <>
                  <FieldLabel text={T.fieldNote} />
                  <NoteField value={note} onChange={setNote} placeholder={T.fieldNotePlaceholder} disabled={submitting} />
                </>
              )}

              {action === 'revoke_role' && (
                <>
                  <FieldLabel text={T.fieldRoleToRevoke} />
                  <View style={styles.pillRow}>
                    {revokableRoles.map((r) => (
                      <Pill
                        key={r}
                        label={r}
                        selected={revokeRoleValue === r}
                        onPress={() => setRevokeRoleValue(r)}
                        disabled={submitting}
                      />
                    ))}
                  </View>

                  <FieldLabel text={T.fieldReason} />
                  <ReasonPills value={reason} onChange={setReason} disabled={submitting} t={T} />

                  <FieldLabel text={T.fieldNote} />
                  <NoteField value={note} onChange={setNote} placeholder={T.fieldNotePlaceholder} disabled={submitting} />
                </>
              )}

              {action === 'edit_profile' && (
                <EditProfileForm
                  target={target}
                  role={editRole}
                  setRole={setEditRole}
                  fields={editFields}
                  setFields={setEditFields}
                  disabled={submitting}
                  t={T}
                />
              )}
            </ScrollView>

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
                style={[styles.confirmButton, (!isValid || submitting) && { opacity: 0.5 }]}
                onPress={handleConfirm}
                disabled={!isValid || submitting}
                accessibilityRole="button"
                accessibilityLabel={T[confirmKeyForAction(action)]}
                accessibilityState={{ disabled: !isValid, busy: submitting }}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.confirmText}>{T[confirmKeyForAction(action)]}</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---- Sub-components ----

const FieldLabel: React.FC<{ text: string }> = ({ text }) => (
  <Text style={styles.fieldLabel}>{text}</Text>
);

const SeverityCard: React.FC<{
  title: string; desc: string; selected: boolean; isPermaBan: boolean;
  onPress: () => void; disabled: boolean;
}> = ({ title, desc, selected, isPermaBan, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.severityCard, selected && styles.severityCardSelected]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="radio"
    accessibilityState={{ selected, disabled }}
    accessibilityLabel={`${title}. ${desc}`}
  >
    <View style={styles.severityCardHeader}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <Text style={styles.severityTitle}>{title}</Text>
      {isPermaBan && <AlertTriangle size={14} color={COLORS.warning} />}
    </View>
    <Text style={styles.severityDesc}>{desc}</Text>
  </TouchableOpacity>
);

const ReasonPills: React.FC<{
  value: ReasonCategory | null;
  onChange: (v: ReasonCategory) => void;
  disabled: boolean;
  t: Record<string, string>;
}> = ({ value, onChange, disabled, t }) => (
  <View style={styles.pillRow}>
    {REASON_OPTIONS.map((opt) => (
      <Pill
        key={opt.value}
        label={t[opt.key]}
        selected={value === opt.value}
        onPress={() => onChange(opt.value)}
        disabled={disabled}
      />
    ))}
  </View>
);

const Pill: React.FC<{
  label: string; selected: boolean; onPress: () => void; disabled: boolean;
}> = ({ label, selected, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.pill, selected && styles.pillSelected]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="radio"
    accessibilityState={{ selected, disabled }}
    accessibilityLabel={label}
  >
    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

const NoteField: React.FC<{
  value: string; onChange: (v: string) => void; placeholder: string; disabled: boolean;
}> = ({ value, onChange, placeholder, disabled }) => (
  <View>
    <TextInput
      style={styles.noteInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textSecondary}
      multiline
      textAlignVertical="top"
      maxLength={500}
      editable={!disabled}
    />
    <Text style={styles.noteCounter}>{value.length}/500</Text>
  </View>
);

const EditProfileForm: React.FC<{
  target: SearchUserItem;
  role: ProviderRole;
  setRole: (r: ProviderRole) => void;
  fields: Partial<EditProfileBody['fields']>;
  setFields: (f: Partial<EditProfileBody['fields']>) => void;
  disabled: boolean;
  t: Record<string, string>;
}> = ({ target, role, setRole, fields, setFields, disabled, t }) => {
  const hasBroker = target.brokerStatus === 'APPROVED';
  const hasLogistics = target.logisticsStatus === 'APPROVED';
  const showRoleTabs = hasBroker && hasLogistics;

  const setField = (k: keyof EditProfileBody['fields'], v: string) => {
    setFields({ ...fields, [k]: v });
  };
  const setCsvField = (k: 'coverageAreas' | 'timelines', v: string) => {
    const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
    setFields({ ...fields, [k]: arr });
  };

  return (
    <>
      {showRoleTabs && (
        <View style={styles.pillRow}>
          <Pill label={t.roleFilterBroker}    selected={role === 'broker'}    onPress={() => setRole('broker')}    disabled={disabled} />
          <Pill label={t.roleFilterLogistics} selected={role === 'logistics'} onPress={() => setRole('logistics')} disabled={disabled} />
        </View>
      )}

      <FieldLabel text={t.fieldCompanyName} />
      <TextInput
        style={styles.textInput}
        value={fields.companyName ?? ''}
        onChangeText={(v) => setField('companyName', v)}
        placeholderTextColor={COLORS.textSecondary}
        editable={!disabled}
      />

      <FieldLabel text={t.fieldPhoneNumber} />
      <TextInput
        style={styles.textInput}
        value={fields.phoneNumber ?? ''}
        onChangeText={(v) => setField('phoneNumber', v)}
        keyboardType="phone-pad"
        placeholderTextColor={COLORS.textSecondary}
        editable={!disabled}
      />

      <FieldLabel text={t.fieldTelegram} />
      <TextInput
        style={styles.textInput}
        value={fields.telegramUsername ?? ''}
        onChangeText={(v) => setField('telegramUsername', v)}
        autoCapitalize="none"
        placeholderTextColor={COLORS.textSecondary}
        editable={!disabled}
      />

      {role === 'logistics' && (
        <>
          <FieldLabel text={t.fieldCoverageAreas} />
          <TextInput
            style={styles.textInput}
            value={(fields.coverageAreas ?? []).join(', ')}
            onChangeText={(v) => setCsvField('coverageAreas', v)}
            placeholderTextColor={COLORS.textSecondary}
            editable={!disabled}
          />

          <FieldLabel text={t.fieldTimelines} />
          <TextInput
            style={styles.textInput}
            value={(fields.timelines ?? []).join(', ')}
            onChangeText={(v) => setCsvField('timelines', v)}
            placeholderTextColor={COLORS.textSecondary}
            editable={!disabled}
          />
        </>
      )}
    </>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: SIZES.spacingMd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary },
  body: { flexShrink: 1 },
  bodyContent: { paddingHorizontal: SIZES.spacingLg, paddingVertical: SIZES.spacingMd, gap: SIZES.spacingMd },
  targetEmail: { ...TYPOGRAPHY.label, color: COLORS.textSecondary, marginBottom: SIZES.spacingSm },
  fieldLabel: { ...TYPOGRAPHY.bodyStrong, color: COLORS.textPrimary, marginBottom: SIZES.spacingXs, marginTop: SIZES.spacingSm },
  severityCard: {
    padding: SIZES.spacingMd,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SIZES.spacingSm,
  },
  severityCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  severityCardHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacingSm, marginBottom: SIZES.spacingXs },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: COLORS.textSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.accent },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  severityTitle: { ...TYPOGRAPHY.labelStrong, color: COLORS.textPrimary, flex: 1 },
  severityDesc: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.spacingSm },
  pill: {
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm,
    borderRadius: SIZES.radiusPill,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: SIZES.minTapTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  pillText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  pillTextSelected: { color: COLORS.accent, fontWeight: '600' },
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
  noteCounter: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, alignSelf: 'flex-end', marginTop: SIZES.spacingXs },
  textInput: {
    padding: SIZES.spacingMd,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.label,
    minHeight: SIZES.minTapTarget,
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
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTapTarget,
  },
  confirmText: { ...TYPOGRAPHY.labelStrong, color: '#FFFFFF' },
});
