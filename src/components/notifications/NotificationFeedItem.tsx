import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Search,
  TrendingDown,
  Lock,
  BadgeCheck,
  CircleCheck,
  RotateCcw,
  Bell,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { NotificationItem } from '../../services/notifications/NotificationService';

/**
 * NotificationFeedItem — a single row in the in-app notification center
 * (UI-SPEC §Iconography + §Color + §Typography, CTX D-15, NCEN-04).
 *
 * Per-category icon (UI-SPEC §Iconography):
 *   - saved_search / new_match → `Search`
 *   - price_drop               → `TrendingDown`
 *   - booked                   → `Lock`
 *   - sold                     → `BadgeCheck`
 *   - back_available / back_in_stock → `RotateCcw`
 *   - (other watch event)      → `CircleCheck` fallback
 *
 * Read vs unread (NCEN-04, UI-SPEC §Color reserved-list item 5):
 *   - unread → thin ACCENT left indicator + 600-weight `textPrimary` title
 *   - read   → no indicator + `textSecondary` title
 *
 * Title/body are rendered from the row's keys via `t` (notification rows store
 * titleKey/bodyKey, not literal text) with a fallback to any literal title/body
 * the server already localized. No raw hex literals — theme tokens only.
 *
 * Whole row is a 44px-minimum tap target (UI-SPEC `minTapTarget`).
 */

interface NotificationFeedItemProps {
  notification: NotificationItem;
  onPress: (notification: NotificationItem) => void;
  /** useLanguage().t — keys resolve to localized strings. */
  t: Record<string, string>;
}

/**
 * Map a notification's kind/event to its lucide icon component (UI-SPEC
 * §Iconography). Saved-search rows key on `kind`; watch rows key on `event`.
 */
const getIconComponent = (notification: NotificationItem) => {
  if (notification.kind === 'saved_search') {
    return Search;
  }
  switch (notification.event) {
    case 'price_drop':
      return TrendingDown;
    case 'booked' as NotificationItem['event']:
      return Lock;
    case 'sold':
      return BadgeCheck;
    case 'back_available' as NotificationItem['event']:
    case 'back_in_stock':
      return RotateCcw;
    default:
      // Any other recognized watch event (e.g. new_photos) — a benign
      // confirmation-style icon. Never crash on an unknown event.
      return notification.kind === 'watch' ? CircleCheck : Bell;
  }
};

export const NotificationFeedItem = ({
  notification,
  onPress,
  t,
}: NotificationFeedItemProps) => {
  const Icon = getIconComponent(notification);
  const unread = !notification.read;

  // Rows may carry localization keys (titleKey/bodyKey) OR server-localized
  // literals (title/body). Prefer key→t resolution; fall back to the literal.
  const titleKey = (notification as any).titleKey as string | undefined;
  const bodyKey = (notification as any).bodyKey as string | undefined;
  const title =
    (titleKey && t[titleKey]) || notification.title || t.notifications || '';
  const body = (bodyKey && t[bodyKey]) || notification.body || '';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(notification)}
      accessibilityRole="button"
      accessibilityState={{ selected: !unread }}
    >
      {/* Unread accent left indicator (UI-SPEC reserved-list item 5). */}
      <View style={[styles.indicator, unread && styles.indicatorUnread]} />

      <View style={styles.iconWrap}>
        <Icon
          size={20}
          color={unread ? COLORS.accent : COLORS.textSecondary}
        />
      </View>

      <View style={styles.textWrap}>
        <Text
          style={[styles.title, unread ? styles.titleUnread : styles.titleRead]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {!!body && (
          <Text style={styles.body} numberOfLines={3}>
            {body}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZES.minTapTarget, // 44px touch target floor
    paddingVertical: SIZES.spacingSm,
    paddingHorizontal: SIZES.spacingMd,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  indicator: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: SIZES.radiusPill,
    backgroundColor: 'transparent',
    marginRight: SIZES.spacingSm,
  },
  indicatorUnread: {
    backgroundColor: COLORS.accent, // accent left indicator for unread
  },
  iconWrap: {
    width: SIZES.spacingXl, // 32px
    height: SIZES.spacingXl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.spacingSm,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.body,
  },
  titleUnread: {
    color: COLORS.textPrimary,
    fontWeight: '600', // 600-weight unread title
  },
  titleRead: {
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  body: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SIZES.spacingXs / 2,
  },
});

export default NotificationFeedItem;
