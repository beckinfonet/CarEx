import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shield, ShieldCheck, ShieldOff, Pencil, Trash2 } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import type { SearchUserItem, ProviderRole } from '../../services/moderation/ModerationService';

export type QuickAction =
  | 'suspend'
  | 'unsuspend'
  | 'revoke_role'
  | 'edit_profile'
  | 'delete_profile';

// onSelect carries an OPTIONAL role — REQUIRED when action === 'delete_profile' (per RESEARCH §Pitfall 11),
// and undefined for every other action. The parent screen reads role verbatim into DeleteProfileBody.
export interface QuickActionSelection {
  action: QuickAction;
  role?: ProviderRole;
}

export interface QuickActionSheetProps {
  visible: boolean;
  target: SearchUserItem | null;
  onSelect: (selection: QuickActionSelection) => void;
  onClose: () => void;
}

export const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  visible,
  target,
  onSelect,
  onClose,
}) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const T = t as Record<string, string>;

  if (!target) return null;

  const isActive = target.moderationStatus.state === 'active';
  const hasBroker = target.brokerStatus === 'APPROVED';
  const hasLogistics = target.logisticsStatus === 'APPROVED';
  const hasSeller = target.sellerStatus === 'APPROVED';

  const canSuspend = isActive;
  const canUnsuspend = !isActive;
  const canRevokeRole = hasBroker || hasLogistics || hasSeller;
  const canEditProfile = hasBroker || hasLogistics;
  const canDeleteProfile = hasBroker || hasLogistics;

  const fire = (selection: QuickActionSelection) => {
    onSelect(selection);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header} accessible accessibilityLabel={`${T.actionSuspend} ${target.email}`}>
            <Text style={styles.headerEmail} numberOfLines={1}>{target.email}</Text>
          </View>

          <ActionRow
            icon={<Shield size={20} color={canSuspend ? COLORS.accent : COLORS.textTertiary} />}
            label={T.actionSuspend}
            disabled={!canSuspend}
            onPress={() => fire({ action: 'suspend' })}
            testID="quickaction-suspend"
          />
          <ActionRow
            icon={<ShieldCheck size={20} color={canUnsuspend ? COLORS.successFg : COLORS.textTertiary} />}
            label={T.actionUnsuspend}
            disabled={!canUnsuspend}
            onPress={() => fire({ action: 'unsuspend' })}
            testID="quickaction-unsuspend"
          />
          <ActionRow
            icon={<ShieldOff size={20} color={canRevokeRole ? COLORS.warning : COLORS.textTertiary} />}
            label={T.actionRevokeRole}
            disabled={!canRevokeRole}
            onPress={() => fire({ action: 'revoke_role' })}
            testID="quickaction-revoke"
          />
          <ActionRow
            icon={<Pencil size={20} color={canEditProfile ? COLORS.accent : COLORS.textTertiary} />}
            label={T.actionEditProfile}
            disabled={!canEditProfile}
            onPress={() => fire({ action: 'edit_profile' })}
            testID="quickaction-edit"
          />

          {/* Delete-profile rows — role-explicit per RESEARCH §Pitfall 11 */}
          {hasBroker && hasLogistics ? (
            <>
              <ActionRow
                icon={<Trash2 size={20} color={COLORS.destructive} />}
                label={T.deleteBrokerProfile}
                disabled={false}
                onPress={() => fire({ action: 'delete_profile', role: 'broker' })}
                testID="quickaction-delete-broker"
              />
              <ActionRow
                icon={<Trash2 size={20} color={COLORS.destructive} />}
                label={T.deleteLogisticsProfile}
                disabled={false}
                onPress={() => fire({ action: 'delete_profile', role: 'logistics' })}
                testID="quickaction-delete-logistics"
              />
            </>
          ) : (
            <ActionRow
              icon={<Trash2 size={20} color={canDeleteProfile ? COLORS.destructive : COLORS.textTertiary} />}
              label={T.actionDeleteProfile}
              disabled={!canDeleteProfile}
              onPress={() => {
                // Single-role path: pass that role explicitly
                const role: ProviderRole | undefined =
                  hasBroker ? 'broker' : hasLogistics ? 'logistics' : undefined;
                if (!role) return; // disabled row — guard belt-and-braces
                fire({ action: 'delete_profile', role });
              }}
              testID="quickaction-delete"
            />
          )}

          <TouchableOpacity
            style={styles.cancelRow}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={T.modalCancel}
            testID="quickaction-cancel"
          >
            <Text style={styles.cancelText}>{T.modalCancel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ icon, label, disabled, onPress, testID }) => (
  <TouchableOpacity
    style={[styles.actionRow, disabled && styles.actionRowDisabled]}
    disabled={disabled}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    accessibilityLabel={label}
    testID={testID}
  >
    {icon}
    <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SIZES.spacingSm,
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
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: SIZES.spacingMd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerEmail: { ...TYPOGRAPHY.labelStrong, color: COLORS.textPrimary },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingMd,
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: 14,
    minHeight: 48,
  },
  actionRowDisabled: { opacity: 1 }, // glyph + label opacity handled per element
  actionLabel: { ...TYPOGRAPHY.label, color: COLORS.textPrimary },
  actionLabelDisabled: { opacity: 0.4 },
  cancelRow: {
    paddingVertical: SIZES.spacingMd,
    alignItems: 'center',
    minHeight: SIZES.minTapTarget,
    justifyContent: 'center',
  },
  cancelText: { ...TYPOGRAPHY.labelStrong, color: COLORS.textSecondary },
});
