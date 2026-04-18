import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}

/**
 * Reusable centered empty/error/prompt state. Consumers pass any Lucide icon
 * + localized title + localized body. Optional `action` renders a primary
 * button beneath the body — used for the error variant ("Retry") added for
 * the Phase 5 UAT-filed error-state gap.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, body, action }) => {
  return (
    <View style={styles.container}>
      <Icon size={40} color={COLORS.textTertiary} />
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
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
  actionButton: {
    marginTop: SIZES.spacingLg,
    minHeight: SIZES.minTapTarget,
    paddingHorizontal: SIZES.spacingLg,
    paddingVertical: SIZES.spacingSm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.accent,
  },
});
