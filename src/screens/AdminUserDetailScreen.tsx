import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldOff,
  Pencil,
  Trash2,
  ShieldAlert,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SeverityBadge } from '../components/moderation/SeverityBadge';
import { EmptyState } from '../components/moderation/EmptyState';
import { ModerationActionModal, ModerationActionPayload } from '../components/moderation/ModerationActionModal';
import { formatYmdHm } from '../utils/formatYmdHm';
import { MODERATION_ERROR_KEY_MAP } from '../utils/moderationErrorKeyMap';
import {
  ModerationService,
  SearchUserItem,
  ModerationActionRow,
  Severity,
} from '../services/moderation/ModerationService';
import { ModerationError } from '../services/moderation/errors';
import type { RootStackParamList } from '../types/navigation';

const HISTORY_PAGE_SIZE = 25;

type Route = RouteProp<RootStackParamList, 'AdminUserDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'AdminUserDetail'>;

// ---- Helpers ----

const ICON_FOR_ACTION: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  suspend: Shield,
  unsuspend: ShieldCheck,
  revoke_role: ShieldOff,
  restore_role: ShieldCheck,
  edit_profile: Pencil,
  delete_provider_profile: Trash2,
};

const severityToPaletteKey = (s: Severity): keyof typeof COLORS.moderation => {
  if (s === 'feature_limited') return 'featureLimited';
  if (s === 'blocked_with_review') return 'blockedReview';
  if (s === 'permanently_banned') return 'permaBanned';
  return 'active';
};

const labelForAction = (action: string, T: Record<string, string>): string => {
  switch (action) {
    case 'suspend':
      return T.actionSuspend;
    case 'unsuspend':
      return T.actionUnsuspend;
    case 'revoke_role':
      return T.actionRevokeRole;
    case 'restore_role':
      return T.actionUnsuspend; // closest semantic — no dedicated string
    case 'edit_profile':
      return T.actionEditProfile;
    case 'delete_provider_profile':
      return T.actionDeleteProfile;
    default:
      return action;
  }
};

// snake_case → PascalCase for reason-category translation key lookup
// (e.g. `policy_violation` → `PolicyViolation` → `reasonPolicyViolation`)
const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/_(.)/g, (_m, c: string) => c.toUpperCase());

export const AdminUserDetailScreen: React.FC = () => {
  const { t } = useLanguage();
  const T = t as Record<string, string>;
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  // refreshUserForced exists on AuthContext (Plan 04-04) but may not be
  // enumerated on the public AuthContextType; access defensively via cast.
  const auth = useAuth() as unknown as {
    user: { localId?: string; email?: string } | null;
    refreshUserForced?: () => Promise<void>;
  };
  const { targetUid } = route.params;

  const [target, setTarget] = useState<SearchUserItem | null>(null);
  const [history, setHistory] = useState<ModerationActionRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ModerationError) {
        const mapped =
          MODERATION_ERROR_KEY_MAP[err.code as keyof typeof MODERATION_ERROR_KEY_MAP];
        Alert.alert(T.error ?? 'Error', T[mapped ?? 'errGeneric']);
        return;
      }
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (code && MODERATION_ERROR_KEY_MAP[code as keyof typeof MODERATION_ERROR_KEY_MAP]) {
        Alert.alert(
          T.error ?? 'Error',
          T[MODERATION_ERROR_KEY_MAP[code as keyof typeof MODERATION_ERROR_KEY_MAP]],
        );
        return;
      }
      if (!(err as { response?: unknown })?.response) {
        Alert.alert(T.error ?? 'Error', T.errNetwork);
        return;
      }
      Alert.alert(T.error ?? 'Error', T.errGeneric);
    },
    [T],
  );

  const fetchTargetAndHistory = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Fetch target user via searchUsers({ q: targetUid }) — backend matches
      // Firebase UID prefix per 05-CONTEXT D-10.
      const userResult = await ModerationService.searchUsers(
        { q: targetUid, limit: 5 },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const found =
        userResult.users.find((u) => u.localId === targetUid) ?? userResult.users[0];
      if (!found) {
        Alert.alert(T.error ?? 'Error', T.errUserNotFound, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setTarget(found);

      const histResult = await ModerationService.getHistory(
        targetUid,
        { limit: HISTORY_PAGE_SIZE },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setHistory(histResult.rows);
      setNextCursor(histResult.nextCursor);
    } catch (err) {
      if (
        axios.isCancel?.(err) ||
        (err as { name?: string })?.name === 'CanceledError' ||
        (err as { name?: string })?.name === 'AbortError'
      ) {
        return;
      }
      handleError(err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [targetUid, T, navigation, handleError]);

  useEffect(() => {
    fetchTargetAndHistory();
    return () => abortRef.current?.abort();
  }, [fetchTargetAndHistory]);

  const fetchNextHistory = useCallback(async () => {
    if (loadingMore || !nextCursor) return; // pagination guard
    setLoadingMore(true);
    try {
      const result = await ModerationService.getHistory(targetUid, {
        limit: HISTORY_PAGE_SIZE,
        cursor: nextCursor,
      });
      setHistory((curr) => [...curr, ...result.rows]);
      setNextCursor(result.nextCursor);
    } catch {
      // pagination errors silent — pull-to-refresh recovers
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, targetUid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTargetAndHistory();
  }, [fetchTargetAndHistory]);

  // ---- Unsuspend handler (UI-04) ----

  const handleUnsuspendSubmit = async (payload: ModerationActionPayload) => {
    if (!target || payload.action !== 'unsuspend') return;
    setSubmitting(true);

    const prevTarget = target;
    const prevHistory = history;

    // Optimistic — D-15 says history is APPEND-ONLY at the UI; build a
    // synthetic local row with a `local-` prefixed _id so a future refresh
    // reconciles to the real backend _id without key collision.
    const optimisticRow: ModerationActionRow = {
      _id: `local-${Date.now()}`,
      action: 'unsuspend',
      severity: 'none',
      reasonCategory: undefined,
      note: payload.body.note ?? null,
      adminUid: auth.user?.localId ?? '',
      adminEmail: auth.user?.email ?? '',
      targetUid: target.localId,
      createdAt: new Date().toISOString(),
    };

    setTarget({
      ...target,
      moderationStatus: { ...target.moderationStatus, state: 'active' },
    });
    setHistory((curr) => [optimisticRow, ...curr]); // PREPEND — most recent first per D-15

    try {
      await ModerationService.unsuspend(target.localId, payload.body);
      // Self-refresh edge case: admin unsuspends self (unlikely but possible)
      if (auth.user?.localId === target.localId && auth.refreshUserForced) {
        await auth.refreshUserForced();
      }
    } catch (err) {
      // Roll back BOTH state changes
      setTarget(prevTarget);
      setHistory(prevHistory);
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render helpers ----

  const StickySummaryCard = useMemo(() => {
    if (!target) return null;
    const roleBadges: Array<{ key: keyof typeof COLORS.role; labelKey: string }> = [];
    if (target.isAdmin) roleBadges.push({ key: 'admin', labelKey: 'roleFilterAdmin' });
    if (target.brokerStatus === 'APPROVED') roleBadges.push({ key: 'broker', labelKey: 'roleFilterBroker' });
    if (target.sellerStatus === 'APPROVED') roleBadges.push({ key: 'seller', labelKey: 'roleFilterSeller' });
    if (target.logisticsStatus === 'APPROVED') roleBadges.push({ key: 'logistics', labelKey: 'roleFilterLogistics' });

    const showUnsuspend = target.moderationStatus.state !== 'active';

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow1}>
          <Text style={styles.summaryEmail} numberOfLines={1}>
            {target.email}
          </Text>
          <SeverityBadge state={target.moderationStatus.state} />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{T.summaryRolesLabel}</Text>
          <View style={styles.roleBadgeRow}>
            {roleBadges.length === 0 ? (
              <Text style={styles.summaryMuted}>{T.summaryNoRoles}</Text>
            ) : (
              roleBadges.map((rb) => (
                <View
                  key={rb.key}
                  style={[styles.roleBadge, { backgroundColor: COLORS.role[rb.key].bg }]}
                >
                  <Text style={[styles.roleBadgeText, { color: COLORS.role[rb.key].fg }]}>
                    {T[rb.labelKey]}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.historyCountPill}>
            <Text style={styles.historyCountText}>
              {(T.summaryHistoryCount ?? '{count} actions').replace(
                '{count}',
                String(history.length),
              )}
            </Text>
          </View>
          {target.createdAt && (
            <Text style={styles.summaryMuted}>
              {T.summaryMemberSinceLabel} {formatYmdHm(target.createdAt)}
            </Text>
          )}
        </View>

        {showUnsuspend && (
          <TouchableOpacity
            style={[styles.unsuspendButton, submitting && { opacity: 0.5 }]}
            onPress={() => setUnsuspendModalOpen(true)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={T.unsuspendUser}
            accessibilityState={{ busy: submitting }}
          >
            <Text style={styles.unsuspendText}>{T.unsuspendUser}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [target, history.length, submitting, T]);

  const renderHistoryRow = ({ item }: { item: ModerationActionRow }) => {
    const isSeverityAction = item.action === 'suspend';
    const palette =
      isSeverityAction && item.severity && item.severity !== 'none'
        ? COLORS.moderation[severityToPaletteKey(item.severity as Severity)]
        : { border: COLORS.accent };

    const Glyph = ICON_FOR_ACTION[item.action] ?? Shield;

    return (
      <View style={[styles.historyCard, { borderLeftColor: palette.border }]}>
        <View style={styles.historyRow}>
          <Glyph size={14} color={palette.border} />
          <Text style={styles.historyAction}>{labelForAction(item.action, T)}</Text>
          {item.severity && item.severity !== 'none' && (
            <SeverityBadge state={item.severity as Severity} />
          )}
        </View>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historyMeta}>{item.adminEmail}</Text>
          <Text style={styles.historyMeta}>·</Text>
          <Text style={styles.historyMeta}>{formatYmdHm(item.createdAt)}</Text>
        </View>
        {item.reasonCategory && (
          <View style={styles.reasonChip}>
            <Text style={styles.reasonChipText}>
              {T[`reason${capitalize(item.reasonCategory)}`] ?? item.reasonCategory}
            </Text>
          </View>
        )}
        {item.note && <Text style={styles.historyNote}>{item.note}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{T.adminUserDetailTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item._id}
          renderItem={renderHistoryRow}
          ListHeaderComponent={StickySummaryCard}
          stickyHeaderIndices={target ? [0] : []}
          ListEmptyComponent={
            !loading && target ? (
              <EmptyState
                icon={ShieldAlert}
                title={T.emptyHistoryTitle}
                body={T.emptyHistoryBody}
              />
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={COLORS.accent}
                style={{ marginVertical: SIZES.spacingMd }}
              />
            ) : null
          }
          onEndReached={fetchNextHistory}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SIZES.spacingSm + 4 }} />}
        />
      )}

      {target && (
        <ModerationActionModal
          visible={unsuspendModalOpen}
          action="unsuspend"
          target={target}
          submitting={submitting}
          onSubmit={handleUnsuspendSubmit}
          onClose={() => setUnsuspendModalOpen(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingMd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: SIZES.spacingLg },

  summaryCard: {
    backgroundColor: COLORS.cardBackground,
    margin: SIZES.spacingMd,
    padding: SIZES.spacingLg,
    borderRadius: SIZES.radiusMd,
    gap: SIZES.spacingMd,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SIZES.spacingSm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SIZES.spacingSm,
  },
  summaryEmail: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary, flex: 1 },
  summaryLabel: { ...TYPOGRAPHY.bodyStrong, color: COLORS.textSecondary },
  summaryMuted: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  roleBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.spacingXs, flex: 1 },
  roleBadge: {
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusPill,
    height: SIZES.badgeHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: { ...TYPOGRAPHY.bodyStrong, fontSize: 11 },
  historyCountPill: {
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusPill,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  historyCountText: { ...TYPOGRAPHY.body, color: COLORS.textTertiaryStrong },
  unsuspendButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: SIZES.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SIZES.spacingSm,
    minHeight: SIZES.minTapTarget,
  },
  unsuspendText: { ...TYPOGRAPHY.labelStrong, color: '#FFFFFF' },

  historyCard: {
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: SIZES.spacingMd,
    padding: SIZES.spacingMd,
    borderRadius: SIZES.radiusMd,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SIZES.spacingXs,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacingSm },
  historyAction: { ...TYPOGRAPHY.labelStrong, color: COLORS.textPrimary, flex: 1 },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingSm,
    marginTop: SIZES.spacingXs,
  },
  historyMeta: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  reasonChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusPill,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    marginTop: SIZES.spacingXs,
  },
  reasonChipText: { ...TYPOGRAPHY.body, color: COLORS.textTertiaryStrong },
  historyNote: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SIZES.spacingXs,
  },
});
