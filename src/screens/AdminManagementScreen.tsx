import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, MoreVertical, Users } from 'lucide-react-native';
import axios from 'axios';
import { COLORS, SIZES, TYPOGRAPHY } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SeverityBadge } from '../components/moderation/SeverityBadge';
import { EmptyState } from '../components/moderation/EmptyState';
import {
  QuickActionSheet,
  QuickActionSelection,
} from '../components/moderation/QuickActionSheet';
import {
  ModerationActionModal,
  ModerationActionType,
  ModerationActionPayload,
} from '../components/moderation/ModerationActionModal';
import {
  TypedConfirmationModal,
  DestructiveAction,
} from '../components/moderation/TypedConfirmationModal';
import { MODERATION_ERROR_KEY_MAP } from '../utils/moderationErrorKeyMap';
import {
  ModerationService,
  SearchUserItem,
  SearchUsersQuery,
  ProviderRole,
} from '../services/moderation/ModerationService';
import { ModerationError } from '../services/moderation/errors';
import type { RootStackParamList } from '../types/navigation';

const PAGE_SIZE = 25;
type RoleFilter = 'all' | 'admin';
type Nav = NativeStackNavigationProp<RootStackParamList, 'AdminManagement'>;

export const AdminManagementScreen: React.FC = () => {
  const { t } = useLanguage();
  const T = t as Record<string, string>;
  const navigation = useNavigation<Nav>();
  // refreshUserForced exists on AuthContext (Plan 04-04) but may not be enumerated
  // on the public AuthContextType; access defensively via cast.
  const auth = useAuth() as unknown as {
    user: { localId?: string } | null;
    refreshUser: () => Promise<void>;
    refreshUserForced?: () => Promise<void>;
  };

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [users, setUsers] = useState<SearchUserItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [sheetTarget, setSheetTarget] = useState<SearchUserItem | null>(null);
  const [actionTarget, setActionTarget] = useState<SearchUserItem | null>(null);
  const [actionType, setActionType] = useState<ModerationActionType | null>(null);
  const [destructiveTarget, setDestructiveTarget] = useState<SearchUserItem | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);
  const [pendingDestructivePayload, setPendingDestructivePayload] =
    useState<ModerationActionPayload | null>(null);
  // pendingDeleteRole — the explicit role emitted by QuickActionSheet for delete_profile.
  // RESEARCH §Pitfall 11 requires explicit role pass-through; NEVER defaulted to broker.
  const [pendingDeleteRole, setPendingDeleteRole] = useState<ProviderRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string): SearchUsersQuery => ({
      role: roleFilter === 'admin' ? 'admin' : undefined,
      cursor,
      limit: PAGE_SIZE,
    }),
    [roleFilter],
  );

  const runFetch = useCallback(
    async (resetList: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (resetList) setLoading(true);
      try {
        const result = await ModerationService.searchUsers(buildQuery(), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setUsers(result.users);
        setNextCursor(result.nextCursor);
      } catch (err) {
        if (
          axios.isCancel?.(err) ||
          (err as { name?: string })?.name === 'CanceledError' ||
          (err as { name?: string })?.name === 'AbortError'
        ) {
          return;
        }
        Alert.alert(T.error ?? 'Error', T.errGeneric);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [buildQuery, T],
  );

  useEffect(() => {
    runFetch(true);
    return () => abortRef.current?.abort();
  }, [runFetch]);

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await ModerationService.searchUsers(buildQuery(nextCursor));
      setUsers((curr) => [...curr, ...result.users]);
      setNextCursor(result.nextCursor);
    } catch {
      // silent — pull-to-refresh recovers
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, buildQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    runFetch(true);
  }, [runFetch]);

  const handleError = (err: unknown) => {
    if (err instanceof ModerationError) {
      const mapped =
        MODERATION_ERROR_KEY_MAP[err.code as keyof typeof MODERATION_ERROR_KEY_MAP];
      Alert.alert(T.error ?? 'Error', T[mapped ?? 'errGeneric']);
      return;
    }
    const code = (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error;
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
  };

  const updateRowOptimistic = (
    uid: string,
    updater: (u: SearchUserItem) => SearchUserItem,
  ) => {
    setUsers((curr) => curr.map((u) => (u.localId === uid ? updater(u) : u)));
  };

  const maybeForceRefreshSelf = async (targetUid: string) => {
    if (auth.user?.localId === targetUid && auth.refreshUserForced) {
      await auth.refreshUserForced();
    }
  };

  const handleSubmit = async (
    target: SearchUserItem,
    payload: ModerationActionPayload,
  ) => {
    setSubmitting(true);
    const prev = users.find((u) => u.localId === target.localId);
    if (!prev) {
      setSubmitting(false);
      return;
    }

    try {
      if (payload.action === 'suspend') {
        updateRowOptimistic(target.localId, (u) => ({
          ...u,
          moderationStatus: { ...u.moderationStatus, state: payload.body.severity },
        }));
        await ModerationService.suspend(target.localId, payload.body);
      } else if (payload.action === 'unsuspend') {
        updateRowOptimistic(target.localId, (u) => ({
          ...u,
          moderationStatus: { ...u.moderationStatus, state: 'active' },
        }));
        await ModerationService.unsuspend(target.localId, payload.body);
      } else if (payload.action === 'revoke_role') {
        const roleField =
          payload.body.role === 'broker'
            ? 'brokerStatus'
            : payload.body.role === 'logistics'
            ? 'logisticsStatus'
            : 'sellerStatus';
        updateRowOptimistic(target.localId, (u) => ({ ...u, [roleField]: 'REVOKED' }));
        await ModerationService.revokeRole(target.localId, payload.body);
      } else if (payload.action === 'edit_profile') {
        await ModerationService.editProviderProfile(target.localId, payload.body);
        await maybeForceRefreshSelf(target.localId);
      }
    } catch (err) {
      updateRowOptimistic(target.localId, () => prev);
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDestructiveConfirm = async (target: SearchUserItem) => {
    if (!pendingDestructivePayload) return;
    setSubmitting(true);
    const prev = users.find((u) => u.localId === target.localId);
    try {
      if (pendingDestructivePayload.action === 'suspend') {
        updateRowOptimistic(target.localId, (u) => ({
          ...u,
          moderationStatus: { ...u.moderationStatus, state: 'permanently_banned' },
        }));
        await ModerationService.suspend(target.localId, pendingDestructivePayload.body);
      } else if (pendingDestructivePayload.action === 'revoke_role') {
        const roleField =
          pendingDestructivePayload.body.role === 'broker'
            ? 'brokerStatus'
            : pendingDestructivePayload.body.role === 'logistics'
            ? 'logisticsStatus'
            : 'sellerStatus';
        updateRowOptimistic(target.localId, (u) => ({ ...u, [roleField]: 'REVOKED' }));
        await ModerationService.revokeRole(
          target.localId,
          pendingDestructivePayload.body,
        );
      }
    } catch (err) {
      if (prev) updateRowOptimistic(target.localId, () => prev);
      handleError(err);
    } finally {
      setSubmitting(false);
      setDestructiveTarget(null);
      setDestructiveAction(null);
      setPendingDestructivePayload(null);
    }
  };

  const handleDeleteProfileConfirm = async (
    target: SearchUserItem,
    role: ProviderRole,
  ) => {
    setSubmitting(true);
    const prev = users.find((u) => u.localId === target.localId);
    try {
      const roleField = role === 'broker' ? 'brokerStatus' : 'logisticsStatus';
      updateRowOptimistic(target.localId, (u) => ({ ...u, [roleField]: 'DELETED' }));
      await ModerationService.deleteProviderProfile(target.localId, { role });
    } catch (err) {
      if (prev) updateRowOptimistic(target.localId, () => prev);
      handleError(err);
    } finally {
      setSubmitting(false);
      setDestructiveTarget(null);
      setDestructiveAction(null);
      setPendingDeleteRole(null);
    }
  };

  const handleActionSubmit = (payload: ModerationActionPayload) => {
    if (!actionTarget) return;
    if (payload.action === 'suspend' && payload.body.severity === 'permanently_banned') {
      setPendingDestructivePayload(payload);
      setDestructiveTarget(actionTarget);
      setDestructiveAction('permanently_banned');
      setActionTarget(null);
      setActionType(null);
      return;
    }
    if (payload.action === 'revoke_role') {
      setPendingDestructivePayload(payload);
      setDestructiveTarget(actionTarget);
      setDestructiveAction('revoke_role');
      setActionTarget(null);
      setActionType(null);
      return;
    }
    const target = actionTarget;
    setActionTarget(null);
    setActionType(null);
    handleSubmit(target, payload);
  };

  const handleQuickActionSelect = (selection: QuickActionSelection) => {
    if (!sheetTarget) return;
    if (selection.action === 'delete_profile') {
      if (!selection.role) {
        // Defensive: QuickActionSheet contractually emits role for delete_profile (RESEARCH §Pitfall 11)
        Alert.alert(T.error ?? 'Error', T.errInvalidRoleForDelete);
        return;
      }
      setPendingDeleteRole(selection.role);
      setDestructiveTarget(sheetTarget);
      setDestructiveAction('delete_profile');
      return;
    }
    setActionTarget(sheetTarget);
    setActionType(selection.action);
  };

  const renderUser = ({ item }: { item: SearchUserItem }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowBody}
        onPress={() =>
          navigation.navigate('AdminUserDetail', { targetUid: item.localId })
        }
        accessibilityRole="button"
        accessibilityLabel={`${item.email}, ${item.moderationStatus.state}`}
      >
        <Text style={styles.rowEmail} numberOfLines={1}>
          {item.email}
        </Text>
        <View style={styles.rowMeta}>
          <SeverityBadge state={item.moderationStatus.state} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.rowAction}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        onPress={() => setSheetTarget(item)}
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${item.email}`}
      >
        <MoreVertical size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const ListHeader = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      <ChipButton
        label={T.filterAllUsers}
        active={roleFilter === 'all'}
        onPress={() => setRoleFilter('all')}
      />
      <ChipButton
        label={T.filterAdminsOnly}
        active={roleFilter === 'admin'}
        onPress={() => setRoleFilter('admin')}
      />
    </ScrollView>
  );

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
        <Text style={styles.headerTitle}>{T.adminUsersTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.localId}
          renderItem={renderUser}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon={Users}
                title={T.emptyUsersTitle}
                body={T.emptyUsersBody}
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
          onEndReached={fetchNextPage}
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
          ItemSeparatorComponent={() => <View style={{ height: SIZES.spacingSm }} />}
        />
      )}

      <QuickActionSheet
        visible={sheetTarget !== null}
        target={sheetTarget}
        onSelect={handleQuickActionSelect}
        onClose={() => setSheetTarget(null)}
      />

      {actionTarget && actionType && (
        <ModerationActionModal
          visible={actionTarget !== null && actionType !== null}
          action={actionType}
          target={actionTarget}
          submitting={submitting}
          onSubmit={handleActionSubmit}
          onClose={() => {
            setActionTarget(null);
            setActionType(null);
          }}
        />
      )}

      {destructiveTarget && destructiveAction && (
        <TypedConfirmationModal
          visible={destructiveTarget !== null && destructiveAction !== null}
          action={destructiveAction}
          targetEmail={destructiveTarget.email}
          submitting={submitting}
          onConfirm={() => {
            if (destructiveAction === 'delete_profile') {
              // Consume the explicit role from QuickActionSheet — NEVER default (RESEARCH §Pitfall 11)
              if (!pendingDeleteRole) {
                Alert.alert(T.error ?? 'Error', T.errInvalidRoleForDelete);
                setDestructiveTarget(null);
                setDestructiveAction(null);
                return;
              }
              handleDeleteProfileConfirm(destructiveTarget, pendingDeleteRole);
            } else {
              handleDestructiveConfirm(destructiveTarget);
            }
          }}
          onClose={() => {
            setDestructiveTarget(null);
            setDestructiveAction(null);
            setPendingDestructivePayload(null);
            setPendingDeleteRole(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const ChipButton: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

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
  listContent: {
    paddingHorizontal: SIZES.spacingMd,
    paddingBottom: SIZES.spacingLg,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SIZES.spacingSm,
    paddingVertical: SIZES.spacingSm,
  },
  chip: {
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.searchBackground,
    minHeight: SIZES.chipHeight,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  chipText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.accent, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SIZES.spacingMd,
    minHeight: 56,
    gap: SIZES.spacingSm,
  },
  rowBody: { flex: 1, gap: SIZES.spacingXs },
  rowEmail: { ...TYPOGRAPHY.labelStrong, color: COLORS.textPrimary },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacingXs },
  rowAction: {
    width: SIZES.minTapTarget,
    height: SIZES.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
