import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AlertTriangle, Archive, ArrowLeft, MoreVertical, Search, Users } from 'lucide-react-native';
import axios from 'axios';
import { COLORS, SIZES, TYPOGRAPHY } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SeverityBadge } from '../components/moderation/SeverityBadge';
import type { ModerationState } from '../components/moderation/SeverityBadge';
import { EmptyState } from '../components/moderation/EmptyState';
import { QuickActionSheet, QuickActionSelection } from '../components/moderation/QuickActionSheet';
import { ModerationActionModal, ModerationActionType, ModerationActionPayload } from '../components/moderation/ModerationActionModal';
import { TypedConfirmationModal, DestructiveAction } from '../components/moderation/TypedConfirmationModal';
import { ListingRestoreModal } from '../components/moderation/ListingRestoreModal';
import type { ListingRestoreModalBody } from '../components/moderation/ListingRestoreModal';
import { MODERATION_ERROR_KEY_MAP } from '../utils/moderationErrorKeyMap';
import { buildListingTitle } from '../utils/listingTitle';
import {
  ModerationService,
  SearchUserItem,
  SearchUsersQuery,
  ProviderRole,
  ListingSearchItem,
  SearchListingsQuery,
} from '../services/moderation/ModerationService';
import { ModerationError } from '../services/moderation/errors';
import type { RootStackParamList } from '../types/navigation';

const PAGE_SIZE = 25;

type RoleFilter = 'all' | 'buyer' | 'seller' | 'broker' | 'logistics' | 'admin';
type StateFilter =
  | 'all'
  | 'active'
  | 'feature_limited'
  | 'blocked_with_review'
  | 'permanently_banned';

const ROLE_FILTER_OPTIONS: Array<{ value: RoleFilter; key: string }> = [
  { value: 'all', key: 'roleFilterAll' },
  { value: 'buyer', key: 'roleFilterBuyer' },
  { value: 'seller', key: 'roleFilterSeller' },
  { value: 'broker', key: 'roleFilterBroker' },
  { value: 'logistics', key: 'roleFilterLogistics' },
  { value: 'admin', key: 'roleFilterAdmin' },
];

const STATE_FILTER_OPTIONS: Array<{ value: StateFilter; key: string }> = [
  { value: 'all', key: 'stateFilterAll' },
  { value: 'active', key: 'stateFilterActive' },
  { value: 'feature_limited', key: 'stateFilterFeatureLimited' },
  { value: 'blocked_with_review', key: 'stateFilterBlocked' },
  { value: 'permanently_banned', key: 'stateFilterBanned' },
];

// ---- Plan 10-10 (LUI-04): Listings tab ----
//
// D-09: AdminModerationScreen gains a top-level Users|Listings tab control —
// no new route, no new screen file (widen-existing-surface, mirrors v1.0
// Phase 5 D-03 AdminManagementScreen repurpose). D-12: admin lands on Users
// tab by default. State buckets for the two tabs are deliberately PARALLEL
// (Pitfall 7 — see listingsAbortRef below) so a tab switch never pollutes
// the other tab's request lifecycle.

type ScopeTab = 'users' | 'listings';

type ListingStatusFilter = 'all' | 'active' | 'suspended' | 'archived' | 'deleted';

const LISTING_STATUS_FILTER_OPTIONS: Array<{ value: ListingStatusFilter; key: string }> = [
  { value: 'all', key: 'listingStatusFilterAll' },
  { value: 'active', key: 'listingStatusFilterActive' },
  { value: 'suspended', key: 'listingStatusFilterSuspended' },
  { value: 'archived', key: 'listingStatusFilterArchived' },
  { value: 'deleted', key: 'listingStatusFilterDeleted' },
];

/**
 * Listing status → SeverityBadge ModerationState mapping. The user-domain
 * SeverityBadge accepts a fixed 4-value union; listings have a different
 * 4-value union (active|suspended|archived|deleted). The two share `active`
 * directly and map the listing-specific states to user-severity palettes
 * with equivalent visual semantics:
 *   - 'active' → 'active'                    (green active palette)
 *   - 'suspended' → 'feature_limited'        (amber warning palette)
 *   - 'archived' → 'permanently_banned'      (neutral grey palette)
 *   - 'deleted' → 'blocked_with_review'      (red destructive palette)
 * Documented so the inverse-intuition (deleted→blockedReview, not permaBanned)
 * is grep-discoverable for future reviewers.
 */
function mapListingStatusToSeverityState(
  status: 'active' | 'suspended' | 'archived' | 'deleted',
): ModerationState {
  switch (status) {
    case 'active':
      return 'active';
    case 'suspended':
      return 'feature_limited';
    case 'archived':
      return 'permanently_banned';
    case 'deleted':
      return 'blocked_with_review';
  }
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'AdminModeration'>;

export const AdminModerationScreen: React.FC = () => {
  const { t } = useLanguage();
  // `t` now contains string[] fields (260528-hmt greeting variant pools); the bare
  // `as Record<string, string>` cast no longer overlaps. Route via `unknown` per the
  // TS diagnostic — matches the `useAuth() as unknown as {...}` pattern below.
  const T = t as unknown as Record<string, string>;
  const navigation = useNavigation<Nav>();
  // refreshUserForced exists on AuthContext (added in Plan 04-04) but may not be
  // enumerated on the public AuthContextType; access defensively via cast.
  const auth = useAuth() as unknown as {
    user: { localId?: string } | null;
    refreshUser: () => Promise<void>;
    refreshUserForced?: () => Promise<void>;
  };

  // ---- query state ----
  // `query` is the in-flight TEXT INPUT draft (mutates per keystroke; never
  // triggers a fetch). `submittedQuery` is the LAST USER-SUBMITTED value;
  // it (plus the role/state filter chips) is the source of truth for the
  // search request. Decoupling them is the gap-1 UAT fix — the previous
  // debounced path fired a fetch per keystroke, which surfaced
  // CanceledError as a red LogBox overlay on every superseded request.
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');

  // ---- list state ----
  const [users, setUsers] = useState<SearchUserItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ---- modal state ----
  const [sheetTarget, setSheetTarget] = useState<SearchUserItem | null>(null);
  const [actionTarget, setActionTarget] = useState<SearchUserItem | null>(null);
  const [actionType, setActionType] = useState<ModerationActionType | null>(null);
  const [destructiveTarget, setDestructiveTarget] = useState<SearchUserItem | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);
  const [pendingDestructivePayload, setPendingDestructivePayload] =
    useState<ModerationActionPayload | null>(null);
  // pendingDeleteRole — the explicit role emitted by QuickActionSheet's onSelect for delete_profile.
  // Set when routing delete_profile into TypedConfirmationModal; cleared when the modal closes.
  // RESEARCH §Pitfall 11 requires this to be explicitly passed through — NEVER defaulted to broker.
  const [pendingDeleteRole, setPendingDeleteRole] = useState<ProviderRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- Plan 10-10: Listings-tab parallel state bucket (Pitfall 7) ----
  // DO NOT collapse these into a single shared bucket with the user-tab hooks
  // above. The two tabs run independent search lifecycles (different services,
  // different filter shapes, different pagination cursors) and a shared
  // abortRef would cause cross-tab aborts on rapid tab switching. Plan 10-10
  // Test 10 exercises this invariant.
  const [scopeTab, setScopeTab] = useState<ScopeTab>('users');
  const [listingsQuery, setListingsQuery] = useState('');
  const [listingsSubmittedQuery, setListingsSubmittedQuery] = useState('');
  const [listingsStatusFilter, setListingsStatusFilter] =
    useState<ListingStatusFilter>('all');
  const [listings, setListings] = useState<ListingSearchItem[]>([]);
  const [listingsNextCursor, setListingsNextCursor] = useState<string | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsLoadingMore, setListingsLoadingMore] = useState(false);
  const [listingsRefreshing, setListingsRefreshing] = useState(false);
  const [listingsLoadError, setListingsLoadError] = useState(false);
  // Pitfall 7: DISTINCT AbortController ref — never collapse with abortRef above.
  const listingsAbortRef = useRef<AbortController | null>(null);
  // Recover modal target — set on row-Recover tap, cleared on modal close.
  const [recoverTarget, setRecoverTarget] = useState<ListingSearchItem | null>(null);

  const buildQuery = useCallback(
    (cursor?: string): SearchUsersQuery => ({
      q: submittedQuery || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      state: stateFilter === 'all' ? undefined : stateFilter,
      cursor,
      limit: PAGE_SIZE,
    }),
    [submittedQuery, roleFilter, stateFilter],
  );

  const runSearch = useCallback(
    async (resetList: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (resetList) setLoading(true);
      setLoadError(false);
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
        // Read failures flip the list into an error EmptyState (with Retry)
        // instead of firing a blocking Alert. Action failures (suspend,
        // revoke, delete, edit) still surface via Alert below — those are
        // user-initiated writes where a modal interruption is appropriate.
        setUsers([]);
        setNextCursor(null);
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [buildQuery],
  );

  // Re-run on debounced query / filter change
  useEffect(() => {
    runSearch(true);
    return () => abortRef.current?.abort();
  }, [runSearch]);

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !nextCursor) return; // pagination guard — RESEARCH §Pitfall 9
    setLoadingMore(true);
    try {
      const result = await ModerationService.searchUsers(buildQuery(nextCursor));
      setUsers((curr) => [...curr, ...result.users]);
      setNextCursor(result.nextCursor);
    } catch {
      // Pagination errors are surfaced silently; pull-to-refresh recovers.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, buildQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    runSearch(true);
  }, [runSearch]);

  // ---- search submit ----
  // Fired by the Search button OR by TextInput onSubmitEditing. Commits the
  // draft `query` into `submittedQuery`, which (via buildQuery) drives the
  // next runSearch through the existing useEffect dep chain. No direct
  // searchUsers call here — keeps the data path single-sourced through the
  // effect so abort/refresh/retry all funnel through one runSearch entry.
  const handleSubmitSearch = useCallback(() => {
    setSubmittedQuery(query.trim());
  }, [query]);

  // ---- mutation handlers ----

  const updateRowOptimistic = (
    uid: string,
    updater: (u: SearchUserItem) => SearchUserItem,
  ) => {
    setUsers((curr) => curr.map((u) => (u.localId === uid ? updater(u) : u)));
  };

  const handleError = (err: unknown) => {
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
      // Roll back the row to prior state
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
        // permanently_banned suspend
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
        await ModerationService.revokeRole(target.localId, pendingDestructivePayload.body);
      }
      // delete_profile is handled separately (does not flow through pendingDestructivePayload).
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
      // Optimistically clear the deleted role status on the row.
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

  // ---- Plan 10-10: Listings tab handlers ----

  const buildListingsQuery = useCallback(
    (cursor?: string): SearchListingsQuery => ({
      status:
        listingsStatusFilter === 'all' ? undefined : listingsStatusFilter,
      q: listingsSubmittedQuery || undefined,
      cursor,
      limit: PAGE_SIZE,
    }),
    [listingsStatusFilter, listingsSubmittedQuery],
  );

  const runListingsSearch = useCallback(
    async (resetList: boolean) => {
      listingsAbortRef.current?.abort();
      const controller = new AbortController();
      listingsAbortRef.current = controller;
      if (resetList) setListingsLoading(true);
      setListingsLoadError(false);
      try {
        const result = await ModerationService.searchListings(
          buildListingsQuery(),
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setListings(result.rows);
        setListingsNextCursor(result.nextCursor);
      } catch (err) {
        if (
          axios.isCancel?.(err) ||
          (err as { name?: string })?.name === 'CanceledError' ||
          (err as { name?: string })?.name === 'AbortError'
        ) {
          return;
        }
        setListings([]);
        setListingsNextCursor(null);
        setListingsLoadError(true);
      } finally {
        if (!controller.signal.aborted) {
          setListingsLoading(false);
          setListingsRefreshing(false);
        }
      }
    },
    [buildListingsQuery],
  );

  // Fires on tab switch into Listings + on submitted-query change + on filter change.
  useEffect(() => {
    if (scopeTab !== 'listings') return;
    runListingsSearch(true);
    return () => listingsAbortRef.current?.abort();
  }, [scopeTab, runListingsSearch]);

  const fetchNextListingsPage = useCallback(async () => {
    if (listingsLoadingMore || !listingsNextCursor) return;
    setListingsLoadingMore(true);
    try {
      const result = await ModerationService.searchListings(
        buildListingsQuery(listingsNextCursor),
      );
      setListings((curr) => [...curr, ...result.rows]);
      setListingsNextCursor(result.nextCursor);
    } catch {
      // Pagination errors surface silently; pull-to-refresh recovers.
    } finally {
      setListingsLoadingMore(false);
    }
  }, [listingsLoadingMore, listingsNextCursor, buildListingsQuery]);

  const onRefreshListings = useCallback(() => {
    setListingsRefreshing(true);
    runListingsSearch(true);
  }, [runListingsSearch]);

  const handleSubmitListingsSearch = useCallback(() => {
    setListingsSubmittedQuery(listingsQuery.trim());
  }, [listingsQuery]);

  // Recover row action — optimistic flip, rollback on error.
  // Reuses ModerationService.restoreListing (Phase 8 D-B: single path back to
  // active) — there is NO separate route for the Listings-tab Recover button;
  // it shares the same code path as CarDetails Restore. Plan 10-10 grep guard
  // forbids any future drift introducing a distinct method here.
  const handleRecoverListing = async (
    row: ListingSearchItem,
    body: ListingRestoreModalBody,
  ) => {
    const prev = listings;
    setListings((curr) =>
      curr.map((l) => (l._id === row._id ? { ...l, status: 'active' } : l)),
    );
    setRecoverTarget(null);
    try {
      await ModerationService.restoreListing(row._id, body);
    } catch (err) {
      setListings(prev);
      const code = (err as { code?: string } | null)?.code;
      Alert.alert(T.error ?? 'Error', code ?? T.errGeneric ?? 'Restore failed');
    }
  };

  // Bridge: ModerationActionModal Submit → either fire directly or escalate to TypedConfirmationModal
  const handleActionSubmit = (payload: ModerationActionPayload) => {
    if (!actionTarget) return;
    // Suspend at permanently_banned must escalate to TypedConfirmationModal (D-04)
    if (payload.action === 'suspend' && payload.body.severity === 'permanently_banned') {
      setPendingDestructivePayload(payload);
      setDestructiveTarget(actionTarget);
      setDestructiveAction('permanently_banned');
      setActionTarget(null);
      setActionType(null);
      return;
    }
    // revoke_role escalates to TypedConfirmationModal (D-04)
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

  // Bridge: QuickActionSheet onSelect → open the right modal.
  // QuickActionSelection carries { action, role? }; `role` is REQUIRED when action === 'delete_profile'
  // (emitted by QuickActionSheet — dual-role users see two distinct rows, single-role users get the explicit role).
  const handleQuickActionSelect = (selection: QuickActionSelection) => {
    if (!sheetTarget) return;
    if (selection.action === 'delete_profile') {
      if (!selection.role) {
        // Defensive: QuickActionSheet is contractually required to emit role for delete_profile
        // (per RESEARCH §Pitfall 11). If this branch executes, the component contract is broken.
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

  const ListEmpty = loadError ? (
    <EmptyState
      icon={AlertTriangle}
      title={T.errorLoadTitle}
      body={T.errorLoadBody}
      action={{ label: T.retry, onPress: () => runSearch(true) }}
    />
  ) : (
    <EmptyState
      icon={submittedQuery ? Search : Users}
      title={submittedQuery ? T.emptySearchTitle : T.searchPromptTitle}
      body={submittedQuery ? T.emptySearchBody : T.searchPromptBody}
    />
  );

  const ListHeader = (
    <View>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={T.searchEmailOrUid}
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={T.searchEmailOrUid}
          />
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSubmitSearch}
          accessibilityRole="button"
          accessibilityLabel={T.actionSearch}
        >
          <Text style={styles.searchButtonText}>{T.actionSearch}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {ROLE_FILTER_OPTIONS.map((opt) => (
          <ChipButton
            key={opt.value}
            label={T[opt.key]}
            active={roleFilter === opt.value}
            onPress={() => setRoleFilter(opt.value)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {STATE_FILTER_OPTIONS.map((opt) => (
          <ChipButton
            key={opt.value}
            label={T[opt.key]}
            active={stateFilter === opt.value}
            onPress={() => setStateFilter(opt.value)}
          />
        ))}
      </ScrollView>
    </View>
  );

  // ---- Plan 10-10: Listings tab body ----

  const renderListing = ({ item }: { item: ListingSearchItem }) => {
    const title = buildListingTitle(item);
    const isDeleted = item.status === 'deleted';
    return (
      <TouchableOpacity
        testID={`listing-row-${item._id}`}
        style={styles.listingRow}
        onPress={() => navigation.navigate('CarDetails', { carId: item._id })}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {item.firstPhotoUrl ? (
          <Image source={{ uri: item.firstPhotoUrl }} style={styles.listingThumb} />
        ) : (
          <View style={[styles.listingThumb, styles.listingThumbPlaceholder]} />
        )}
        <View style={styles.listingRowBody}>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {title}
          </Text>
          {item.price != null && (
            <Text style={styles.listingPrice}>${item.price.toLocaleString()}</Text>
          )}
          <SeverityBadge state={mapListingStatusToSeverityState(item.status)} />
        </View>
        {isDeleted && (
          <TouchableOpacity
            testID={`listing-row-recover-${item._id}`}
            style={styles.recoverButton}
            onPress={() => setRecoverTarget(item)}
            accessibilityRole="button"
            accessibilityLabel={T.listingActionRestore ?? 'Recover'}
          >
            <Text style={styles.recoverButtonText}>
              {T.listingActionRestore ?? 'Recover'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const ListingsListEmpty = listingsLoadError ? (
    <EmptyState
      icon={AlertTriangle}
      title={T.errorLoadTitle}
      body={T.errorLoadBody}
      action={{ label: T.retry, onPress: () => runListingsSearch(true) }}
    />
  ) : (
    <EmptyState
      icon={Archive}
      title={T.listingsEmpty ?? T.emptySearchTitle}
      body={T.listingsEmptyBody ?? T.emptySearchBody}
    />
  );

  const ListingsListHeader = (
    <View>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            testID="listings-search-input"
            style={styles.searchInput}
            placeholder={T.listingsSearchPlaceholder ?? T.searchEmailOrUid}
            placeholderTextColor={COLORS.textSecondary}
            value={listingsQuery}
            onChangeText={setListingsQuery}
            onSubmitEditing={handleSubmitListingsSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={T.listingsSearchPlaceholder ?? T.searchEmailOrUid}
          />
        </View>
        <TouchableOpacity
          testID="listings-search-submit"
          style={styles.searchButton}
          onPress={handleSubmitListingsSearch}
          accessibilityRole="button"
          accessibilityLabel={T.actionSearch}
        >
          <Text style={styles.searchButtonText}>{T.actionSearch}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {LISTING_STATUS_FILTER_OPTIONS.map((opt) => (
          <ChipButton
            key={opt.value}
            testID={`listing-filter-${opt.value}`}
            label={T[opt.key] ?? opt.value}
            active={listingsStatusFilter === opt.value}
            onPress={() => setListingsStatusFilter(opt.value)}
          />
        ))}
      </ScrollView>
    </View>
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
        <Text style={styles.headerTitle}>{T.adminModerationTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Plan 10-10: Top-level Users|Listings tab control (D-09, D-12 default Users) */}
      <View style={styles.scopeTabRow}>
        <ChipButton
          testID="tab-users"
          label={T.tabUsers ?? 'Users'}
          active={scopeTab === 'users'}
          onPress={() => setScopeTab('users')}
        />
        <ChipButton
          testID="tab-listings"
          label={T.tabListings ?? 'Listings'}
          active={scopeTab === 'listings'}
          onPress={() => setScopeTab('listings')}
        />
      </View>

      {scopeTab === 'users' ? (
        loading && users.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.localId}
            renderItem={renderUser}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={!loading ? ListEmpty : null}
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
        )
      ) : listingsLoading && listings.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l._id}
          renderItem={renderListing}
          ListHeaderComponent={ListingsListHeader}
          ListEmptyComponent={!listingsLoading ? ListingsListEmpty : null}
          ListFooterComponent={
            listingsLoadingMore ? (
              <ActivityIndicator
                color={COLORS.accent}
                style={{ marginVertical: SIZES.spacingMd }}
              />
            ) : null
          }
          onEndReached={fetchNextListingsPage}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={listingsRefreshing}
              onRefresh={onRefreshListings}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SIZES.spacingSm }} />}
        />
      )}

      {/* Recover modal — reuses Plan 07 ListingRestoreModal + Plan 04 restoreListing */}
      {recoverTarget && (
        <ListingRestoreModal
          visible={true}
          carId={recoverTarget._id}
          onSubmit={(body) => handleRecoverListing(recoverTarget, body)}
          onClose={() => setRecoverTarget(null)}
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
              // Use the role explicitly emitted by QuickActionSheet (pendingDeleteRole) — NEVER defaulted.
              // RESEARCH §Pitfall 11 requires role pass-through end-to-end. The null guard is defensive:
              // handleQuickActionSelect will not route to delete_profile unless `selection.role` is set.
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
  testID?: string;
}> = ({ label, active, onPress, testID }) => (
  <TouchableOpacity
    testID={testID}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingSm,
    paddingTop: SIZES.spacingMd,
    marginBottom: SIZES.spacingSm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 0,
  },
  searchButton: {
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 10,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.accent,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    ...TYPOGRAPHY.labelStrong,
    color: COLORS.background,
  },
  // --- Plan 10-10: Listings tab + tab control ---
  scopeTabRow: {
    flexDirection: 'row',
    gap: SIZES.spacingSm,
    paddingHorizontal: SIZES.spacingMd,
    paddingTop: SIZES.spacingSm,
    paddingBottom: SIZES.spacingSm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SIZES.spacingMd,
    gap: SIZES.spacingSm,
  },
  listingThumb: {
    width: 60,
    height: 60,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.searchBackground,
  },
  listingThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingRowBody: {
    flex: 1,
    gap: SIZES.spacingXs,
  },
  listingTitle: {
    ...TYPOGRAPHY.labelStrong,
    color: COLORS.textPrimary,
  },
  listingPrice: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  recoverButton: {
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.successFg,
    minHeight: SIZES.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoverButtonText: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.background,
  },
});
