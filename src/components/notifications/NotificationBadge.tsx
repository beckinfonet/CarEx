import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

/**
 * NotificationBadge — the two unread-count surfaces for Phase 12 (NCEN-01 /
 * CTX D-07). Both modes derive their value from a `count` prop that callers
 * read from `useNotifications().unreadCount`.
 *
 * Modes (UI-SPEC §Color):
 *   - "dot"   → a small RED dot (`COLORS.destructive` #EF4444) shown on the
 *               BottomBar More button when unread > 0. Renders NOTHING at 0 so
 *               the More chrome stays clean (deliberate alert-signal red, NOT
 *               accent-blue — UI-SPEC reserved-list item 2).
 *   - "count" → a small "9+"-capped count bubble (`COLORS.accent` #3B82F6,
 *               radiusPill, ~18-22px) overlaid on the MoreMenu Notifications
 *               grid item. Counts >= 10 collapse to "9+"; 1-9 show the number.
 *               Renders nothing at 0.
 *
 * No raw hex literals — theme tokens only.
 */

export type NotificationBadgeMode = 'dot' | 'count';

interface NotificationBadgeProps {
  count: number;
  mode: NotificationBadgeMode;
  /** Optional absolute-position override for overlaying on a parent surface. */
  style?: object;
}

/** Cap the displayed count at "9+" for 10 or more (UI-SPEC D-07). */
export const formatBadgeCount = (count: number): string =>
  count >= 10 ? '9+' : String(count);

export const NotificationBadge = ({
  count,
  mode,
  style,
}: NotificationBadgeProps) => {
  // Both modes are alert signals: nothing to show when there is nothing unread.
  if (!count || count <= 0) {
    return null;
  }

  if (mode === 'dot') {
    return <View style={[styles.dot, style]} accessibilityLabel="unread" />;
  }

  return (
    <View style={[styles.countBubble, style]} accessibilityLabel="unread-count">
      <Text style={styles.countText}>{formatBadgeCount(count)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    width: SIZES.spacingSm + 2, // ~10px
    height: SIZES.spacingSm + 2,
    borderRadius: SIZES.radiusPill,
    backgroundColor: COLORS.destructive, // alert-signal red (#EF4444)
  },
  countBubble: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: SIZES.spacingXs / 2, // 2px inner padding for "9+"
    borderRadius: SIZES.radiusPill,
    backgroundColor: COLORS.accent, // accent blue (#3B82F6)
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
});

export default NotificationBadge;
