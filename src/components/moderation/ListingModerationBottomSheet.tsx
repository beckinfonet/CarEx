// Phase 10 Plan 06 — Listing moderation bottom sheet.
//
// Sibling (NOT generalization) of the user-domain quick-action sheet per
// D-04 / Pattern S7 — the user-domain vocabulary stays grep-able
// independently of the listing-domain vocabulary so Phase 11 LQUAL-03 can
// audit each surface without cross-domain enum drift (T-10-06).
//
// Pure presentational per D-08:
//   - NO moderation-service imports (parent fires the network call)
//   - NO auth-context reads (parent gates visibility via the visible prop)
//   - The listingTitle prop is the pre-built canonical string from
//     src/utils/listingTitle (Pitfall 6 — single source of truth; the
//     parent screen builds the title and passes it down as a prop)
//
// Status-aware body (D-LUI-02 / D-LUI-03):
//   - Active listing  (no moderationBadge)  → 4 distinct action rows
//     (Edit pencil / Suspend warning-orange / Archive neutral / Delete red)
//   - Non-active listing (moderationBadge present) → single Restore row +
//     reasonCategory chip + "Since YYYY-MM-DD" pill (Phase 5 specifics echo)
//
// Modal+overlay shape mirrored verbatim from the user-domain sibling
// (Pattern S2): outer Pressable overlay + inner Pressable sheet w/ no-op
// onPress to swallow the bubble; useSafeAreaInsets for bottom padding.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pencil,
  Shield,
  Archive,
  Trash2,
  RotateCcw,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export type ListingModerationAction =
  | 'edit'
  | 'suspend'
  | 'archive'
  | 'delete'
  | 'restore';

export interface ListingModerationBottomSheetProps {
  visible: boolean;
  listingTitle: string;
  moderationBadge?: {
    status: 'suspended' | 'archived' | 'deleted';
    reasonCategory?: string;
    moderationReason?: string;
    moderatedBy?: string;
    moderatedAt?: string;
  };
  onSelect: (action: ListingModerationAction) => void;
  onClose: () => void;
  // NL5 — when the admin viewing the sheet is ALSO the listing owner, the
  // backend rejects every moderation action with cannot_moderate_own_listing.
  // Suppress all action rows and show an explanatory note instead.
  isOwner?: boolean;
}

export const ListingModerationBottomSheet: React.FC<ListingModerationBottomSheetProps> = ({
  visible,
  listingTitle,
  moderationBadge,
  onSelect,
  onClose,
  isOwner,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  // Pattern S5 — t carries string[] greeting-variant fields; route via unknown
  // so the index-signature cast still compiles. Runtime behavior unchanged.
  const T = t as unknown as Record<string, string>;

  // Listing is "active" iff no moderationBadge present (Phase 9 D-07 omits
  // the badge for active listings).
  const isActive = !moderationBadge;

  // Format the "since" pill — locale-independent ISO-date slice keeps test
  // parity with the Plan 5 D-15 convention; year substring is the only
  // contractual match (Block C Test 4).
  let moderatedSinceLabel = '';
  if (moderationBadge?.moderatedAt) {
    const d = new Date(moderationBadge.moderatedAt);
    if (!Number.isNaN(d.getTime())) {
      moderatedSinceLabel = `${T.listingModeratedSincePrefix ?? 'Since'} ${d
        .toISOString()
        .slice(0, 10)}`;
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        testID="listing-sheet-overlay"
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + SIZES.spacingSm },
          ]}
          onPress={() => {}}
        >
          <View style={styles.handle} />

          <View
            style={styles.header}
            accessible
            accessibilityLabel={listingTitle}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              {listingTitle}
            </Text>
          </View>

          {isOwner ? (
            <View style={styles.ownerNoteBody}>
              <Text style={styles.ownerNoteText} testID="listing-owner-note">
                {T.listingModerationOwnerNote ??
                  "This is your own listing — you can't moderate it. To change its status, mark it Sold or use the edit button below."}
              </Text>
            </View>
          ) : isActive ? (
            <>
              <ActionRow
                icon={<Pencil size={20} color={COLORS.accent} />}
                label={T.listingActionEdit ?? 'Edit'}
                onPress={() => onSelect('edit')}
                testID="listing-action-edit"
              />
              <ActionRow
                icon={<Shield size={20} color={COLORS.warning} />}
                label={T.listingActionSuspend ?? 'Suspend'}
                onPress={() => onSelect('suspend')}
                testID="listing-action-suspend"
              />
              <ActionRow
                icon={<Archive size={20} color={COLORS.textSecondary} />}
                label={T.listingActionArchive ?? 'Archive'}
                onPress={() => onSelect('archive')}
                testID="listing-action-archive"
              />
              <ActionRow
                icon={<Trash2 size={20} color={COLORS.destructive} />}
                label={T.listingActionDelete ?? 'Delete'}
                onPress={() => onSelect('delete')}
                testID="listing-action-delete"
              />
            </>
          ) : (
            <View style={styles.restoreBody}>
              <View style={styles.reasonChip} testID="listing-reason-chip">
                <Text style={styles.reasonChipText}>
                  {moderationBadge?.reasonCategory ??
                    (T.listingReasonOther ?? 'other')}
                </Text>
              </View>
              {moderatedSinceLabel ? (
                <Text
                  style={styles.moderatedAtPill}
                  testID="listing-moderated-since"
                >
                  {moderatedSinceLabel}
                </Text>
              ) : null}
              <ActionRow
                icon={<RotateCcw size={20} color={COLORS.accent} />}
                label={T.listingActionRestore ?? 'Restore'}
                onPress={() => onSelect('restore')}
                testID="listing-action-restore"
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelRow}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={T.modalCancel ?? 'Cancel'}
            testID="listing-sheet-cancel"
          >
            <Text style={styles.cancelText}>{T.modalCancel ?? 'Cancel'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
}> = ({ icon, label, onPress, testID }) => (
  <TouchableOpacity
    style={styles.actionRow}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
  >
    {icon}
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Mirrors the user-domain sibling sheet's overlay tint — neutral rgba,
    // not a theme token (deliberate to match RN bottom-sheet conventions).
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
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
  headerTitle: { ...TYPOGRAPHY.labelStrong, color: COLORS.textPrimary },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingMd,
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: 14,
    minHeight: 48,
  },
  actionLabel: { ...TYPOGRAPHY.label, color: COLORS.textPrimary },
  restoreBody: {
    paddingHorizontal: SIZES.spacingLg,
    paddingTop: SIZES.spacingMd,
  },
  reasonChip: {
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm / 2,
    borderRadius: SIZES.radiusSm,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.searchBackground,
    marginBottom: SIZES.spacingSm,
  },
  reasonChipText: { ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  ownerNoteBody: {
    paddingHorizontal: SIZES.spacingLg,
    paddingTop: SIZES.spacingMd,
    paddingBottom: SIZES.spacingSm,
  },
  ownerNoteText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  moderatedAtPill: {
    ...TYPOGRAPHY.body,
    color: COLORS.textTertiary,
    alignSelf: 'flex-start',
    marginBottom: SIZES.spacingSm,
  },
  cancelRow: {
    paddingVertical: SIZES.spacingMd,
    alignItems: 'center',
    minHeight: SIZES.minTapTarget,
    justifyContent: 'center',
  },
  cancelText: { ...TYPOGRAPHY.labelStrong, color: COLORS.textSecondary },
});
