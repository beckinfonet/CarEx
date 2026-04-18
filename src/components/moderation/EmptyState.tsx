import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * Reusable centered empty/error/prompt state. Consumers pass any Lucide icon
 * + localized title + localized body. Used in 5 places in Phase 5:
 *  - AdminManagementScreen (no users matching filter)
 *  - AdminModerationScreen — initial blank (Search icon, "Start searching")
 *  - AdminModerationScreen — no matches (Search icon, "No matches")
 *  - AdminUserDetailScreen (no history yet)
 *  - Generic error fallback (Alert pattern still primary; this is for inline list errors)
 *
 * Layout per UI-SPEC §Loading/Empty State Matrix.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, body }) => {
  return (
    <View style={styles.container}>
      <Icon size={40} color={COLORS.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.spacing2xl,
    paddingHorizontal: SIZES.spacingLg,
  },
  title: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    marginTop: SIZES.spacingMd,
    textAlign: 'center',
  },
  body: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SIZES.spacingSm,
    textAlign: 'center',
    maxWidth: 280,
  },
});
