# Phase 5: Admin Moderation UI (Mobile) - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 18 (3 NEW screens, 5 NEW components, 2 NEW utils, 1 NEW hook, 4 MODIFIED, 2 NEW backend routes, 1 inferred test)
**Analogs found:** 18 / 18 (every file has a concrete in-repo cousin or a copy-paste source from RESEARCH.md)

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/screens/AdminManagementScreen.tsx` | MODIFIED | screen (list + filter chips + per-row quick-action) | request-response + event-driven | self (existing screen) + `AdminDashboardScreen.tsx:245-261` (tab/chip filter) | self-reference + role-match |
| `src/screens/AdminModerationScreen.tsx` | NEW | screen (search + filter + infinite list) | request-response (paginated) | `AdminManagementScreen.tsx:30-200` (list+modal pattern) + `AdminDashboardScreen.tsx:245-275` (tab+FlatList) | role-match (same family; pagination is new) |
| `src/screens/AdminUserDetailScreen.tsx` | NEW | screen (sticky header + history list + CTA) | request-response (paginated read) | `AdminDashboardScreen.tsx:160-220` (card list w/ meta + actions) + `AdminManagementScreen.tsx:142-198` (header+FlatList) | role-match |
| `src/screens/AdminDashboardScreen.tsx` | MODIFIED | screen (entry point — add nav cards) | request-response | self (existing screen) | self-reference |
| `src/components/moderation/QuickActionSheet.tsx` | NEW | presentational component (bottom-sheet menu) | event (open/close + select) | `FilterModal.tsx:121-153` (Modal+overlay+stop-prop) + `AdminManagementScreen.tsx:164-197` (Modal w/ overlay) | role-match |
| `src/components/moderation/ModerationActionModal.tsx` | NEW | stateful presentational component (bottom-sheet form) | event + transform (collect input → emit payload) | `FilterModal.tsx` (overlay+content+footer) + `ServiceApplicationScreen.tsx:1-26` (KeyboardAvoidingView + Modal + TextInput) | role-match (composite) |
| `src/components/moderation/SeverityBadge.tsx` | NEW | pure presentational pill | none (props-only render) | `AdminDashboardScreen.tsx:163-175` (typeBadge + phoneBadge) | role-match |
| `src/components/moderation/EmptyState.tsx` | NEW | pure presentational primitive | none | `AdminDashboardScreen.tsx:268-273` (inline ListEmptyComponent) | role-match (extracted from inline) |
| `src/components/moderation/TypedConfirmationModal.tsx` | NEW | stateful presentational component (typed sentinel gate) | event + validation | `FilterModal.tsx:121-153` (Modal pattern) + `AdminManagementScreen.tsx:164-197` (Modal with TextInput + disabled state via `adding`) | role-match |
| `src/services/moderation/ModerationService.ts` | MODIFIED | service (add `getHistory` real impl + `searchUsers`) | request-response | self — existing methods at `ModerationService.ts:84-165` | self-reference |
| `src/hooks/useDebouncedValue.ts` | NEW | pure utility hook | transform (value → debounced value) | `useNetwork.ts:1-19` (subscribe-on-mount hook shape) — closest cousin | partial (no debounce hook exists; copy from RESEARCH §Code Examples) |
| `src/utils/formatYmdHm.ts` | NEW | pure utility (date formatter) | transform | `AdminDashboardScreen.tsx:155-158` (`formatDate` inline using `toLocaleDateString`) | partial (extracted/extended from inline) |
| `src/utils/moderationErrorKeyMap.ts` | NEW | pure utility (constant map + type) | transform | `src/utils/passwordPolicy.ts` (exported constants + helper pattern) | partial-role |
| `src/types/navigation.ts` | MODIFIED | TypeScript type (add 2 routes) | none | self — `RootStackParamList` at line 1-23 | self-reference |
| `src/constants/translations.ts` | MODIFIED | constants (add ~70 RU+EN keys) | none | self — existing keys at `translations.ts:114-138` (admin block) + `:510-540` (admin block EN) | self-reference |
| `src/constants/theme.ts` | MODIFIED | constants (extend COLORS, SIZES; add TYPOGRAPHY) | none | self — `COLORS`/`SIZES` at lines 1-17 | self-reference |
| `App.tsx` | MODIFIED | entry (register 2 new routes) | none | self — Stack.Screen registrations at `App.tsx:91-111` | self-reference |
| `backend-services/carEx-services` GET `/api/admin/moderation/history/:uid` | NEW (companion repo) | backend route | request-response | Phase 2 moderation routes (existing in companion repo) — see RESEARCH.md §Architectural Responsibility Map | role-match (cross-repo; planner reads companion repo) |
| `backend-services/carEx-services` GET `/api/admin/moderation/users/search` | NEW (companion repo) | backend route | request-response | Phase 2 admin routes + existing `/api/admin/users` (consumed via `AuthService.getAdminUsers`) | role-match (cross-repo) |
| `__tests__/...` (planner picks paths) | NEW | test | request-response / event | `src/context/__tests__/AuthContext.test.tsx` (existing jest mock pattern w/ `AuthService` mocks + `getBackendUser` returning `moderationStatus`) | role-match |

---

## Pattern Assignments

### `src/screens/AdminManagementScreen.tsx` (MODIFIED — screen, list + filter + quick-action)

**Analog:** itself (lines 30-200) — extend rather than rewrite.

**Existing list screen shape to KEEP** (`AdminManagementScreen.tsx:30-62`):
```typescript
export const AdminManagementScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdmins = useCallback(async () => {
    if (!user?.localId) return;
    try {
      const data = await AuthService.getAdminUsers(user.localId);
      setAdmins(data);
    } catch {
      Alert.alert(t.error, 'Failed to load admins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);
  const onRefresh = () => { setRefreshing(true); fetchAdmins(); };
```

**What to keep:** the `useState` + `useCallback` + `useEffect` + `RefreshControl` trio; the `SafeAreaView` + `StatusBar` + header layout; the inline-`StyleSheet.create()` at file bottom; the `Alert.alert(t.error, ...)` failure pattern.

**What to change:**
1. Data source widens — fetch ALL approved users via `ModerationService.searchUsers({ ... })` rather than `AuthService.getAdminUsers`. Filter chip controls toggle the `role` filter. Default chip "Все пользователи" passes no role filter; "Только админы" passes `role: 'admin'`.
2. Replace the trailing `Trash2` button (lines 121-125) with a trailing `MoreVertical` icon that opens `<QuickActionSheet />` for the row.
3. Make the entire row tappable to `navigation.navigate('AdminUserDetail', { targetUid: item.localId })` — keep the trailing icon as a **sibling** Touchable with `hitSlop`, NOT nested (per RESEARCH §Pitfall 4).
4. Drop the `Plus` Add-Admin button + `Modal` block (lines 151-153, 164-197) — admins are added via the existing approval flow on `AdminDashboardScreen`.
5. Insert a horizontal `ScrollView` chip row between header and `FlatList`. Chip pattern below.

**Filter chip pattern to adopt** (from `FilterBar.tsx:30-69`):
```typescript
<TouchableOpacity
  style={[styles.filterButton, isActive && styles.activeFilterButton]}
  onPress={() => onFilterPress(filter)}>
  <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
    {getFilterLabel(filter)}
  </Text>
</TouchableOpacity>
// styles:
filterButton: {
  backgroundColor: COLORS.searchBackground,
  paddingHorizontal: 16, paddingVertical: 8,
  borderRadius: 8, marginRight: 8,
  borderWidth: 1, borderColor: COLORS.border,
},
activeFilterButton: { borderColor: COLORS.accent, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
activeFilterText: { color: COLORS.accent, fontWeight: 'bold' },
```
This is the UI-SPEC-locked treatment (subtle accent border + tinted bg) — NOT the `FilterModal.tsx:216-225` solid `backgroundColor: COLORS.accent` pill. UI-SPEC §Color explicitly reserves solid accent for primary CTAs only.

**Optimistic update + rollback handler** (RESEARCH §Code Examples, lines 638-674) — copy verbatim into row handler:
```typescript
const handleSuspend = async (targetUser, body: SuspendBody) => {
  const prev = users.find(u => u.localId === targetUser.localId);
  if (!prev) return;
  setUsers(curr => curr.map(u =>
    u.localId === targetUser.localId
      ? { ...u, moderationStatus: { ...u.moderationStatus, state: body.severity } }
      : u,
  ));
  try {
    await ModerationService.suspend(targetUser.localId, body);
  } catch (err) {
    setUsers(curr => curr.map(u => u.localId === targetUser.localId ? prev : u));
    if (err instanceof ModerationError) {
      const msgKey = MODERATION_ERROR_KEY_MAP[err.code] ?? 'errGeneric';
      Alert.alert(t.error, t[msgKey]);
    } else {
      const code = (err as any)?.response?.data?.error;
      if (code) Alert.alert(t.error, t[MODERATION_ERROR_KEY_MAP[code] ?? 'errGeneric']);
      else if (!(err as any)?.response) Alert.alert(t.error, t.errNetwork);
      else Alert.alert(t.error, t.errGeneric);
    }
  }
};
```

---

### `src/screens/AdminModerationScreen.tsx` (NEW — screen, search + filter + infinite scroll)

**Analog:** `AdminManagementScreen.tsx` (overall shape) + `AdminDashboardScreen.tsx:245-275` (tab/chip + FlatList) — combine the two.

**Header + SafeAreaView + StatusBar pattern** (`AdminManagementScreen.tsx:142-154`) — copy verbatim, just swap title to `t.adminModerationTitle`.

**SearchBar reuse** (`src/components/SearchBar.tsx:6-21`):
```typescript
<SearchBar
  value={query}
  onChangeText={setQuery}
  placeholder={t.searchEmailOrUid}
/>
```
The `SearchBar` component already wraps a `TextInput` with the `Search` icon and applies `COLORS.searchBackground` styling. Pass UI-SPEC-locked placeholder strings.

**Debounce + cancel-token wiring** (consume `useDebouncedValue` from new hook):
```typescript
const debouncedQuery = useDebouncedValue(query, 300);
const cancelRef = useRef<AbortController | null>(null);

useEffect(() => {
  // Reset to first page on query/filter change
  cancelRef.current?.abort();
  cancelRef.current = new AbortController();
  setUsers([]); setNextCursor(null); setLoading(true);
  ModerationService
    .searchUsers({ q: debouncedQuery, role: roleFilter, state: stateFilter, limit: 25 })
    .then(({ users, nextCursor }) => { setUsers(users); setNextCursor(nextCursor); })
    .catch((err) => { if (!axios.isCancel(err)) Alert.alert(t.error, t.errGeneric); })
    .finally(() => setLoading(false));
  return () => cancelRef.current?.abort();
}, [debouncedQuery, roleFilter, stateFilter]);
```
**A2** in RESEARCH calls out `AbortController` as forward-compat with axios 1.x; planner picks `AbortController` over `CancelToken`.

**Infinite-scroll pattern** (NEW for codebase — guard required per RESEARCH §Pitfall 9):
```typescript
const fetchNextPage = useCallback(async () => {
  if (loadingMore || !nextCursor) return; // guard
  setLoadingMore(true);
  try {
    const res = await ModerationService.searchUsers({
      q: debouncedQuery, role: roleFilter, state: stateFilter,
      cursor: nextCursor, limit: 25,
    });
    setUsers(curr => [...curr, ...res.users]);
    setNextCursor(res.nextCursor);
  } finally {
    setLoadingMore(false);
  }
}, [loadingMore, nextCursor, debouncedQuery, roleFilter, stateFilter]);

<FlatList
  data={users}
  renderItem={renderUser}
  keyExtractor={u => u.localId}
  onEndReached={fetchNextPage}
  onEndReachedThreshold={0.5}
  ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.accent} /> : null}
  ListEmptyComponent={
    !debouncedQuery && users.length === 0
      ? <EmptyState icon={Search} title={t.searchPromptTitle} body={t.searchPromptBody} />
      : <EmptyState icon={Search} title={t.emptySearchTitle} body={t.emptySearchBody} />
  }
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
/>
```

**Two filter chip rows** (Role + State) — repeat the chip-row pattern from `AdminManagementScreen` modification above, twice. Each row is a `horizontal ScrollView` with chips per UI-SPEC §Component 2.

---

### `src/screens/AdminUserDetailScreen.tsx` (NEW — screen, sticky header + paginated history)

**Analog:** Combine `AdminManagementScreen.tsx` (header+FlatList) + `AdminDashboardScreen.tsx:160-220` (rich card with meta rows + actions).

**Route param wiring** (`src/types/navigation.ts:13-17` precedent — typed `RouteProp`):
```typescript
type Route = RouteProp<RootStackParamList, 'AdminUserDetail'>;
const route = useRoute<Route>();
const { targetUid } = route.params;
```

**Sticky header inside FlatList — UI-SPEC-LOCKED pattern** (no analog in repo; first in codebase):
```typescript
<FlatList
  data={history}
  renderItem={({ item }) => <HistoryCard action={item} />}
  keyExtractor={a => a._id}
  ListHeaderComponent={
    <StickySummaryCard
      user={user}
      historyCount={history.length}
      onUnsuspend={() => openModal('unsuspend')}
    />
  }
  stickyHeaderIndices={[0]}
  onEndReached={fetchNextHistoryPage}
  ListEmptyComponent={
    <EmptyState icon={ShieldAlert} title={t.emptyHistoryTitle} body={t.emptyHistoryBody} />
  }
  ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.accent} /> : null}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
/>
```

**HistoryCard inline render** (mirrors `AdminDashboardScreen.tsx:163-219` rich card):
- Use `borderLeftWidth: 4` + `borderLeftColor: COLORS.moderation[severityKey].border` for the accent stripe (UI-SPEC §Component 3).
- Inner rows mirror `cardDetail` style at `AdminDashboardScreen.tsx:397-405` (flex-row, gap 8, marginBottom 4) — re-use that exact spacing convention.
- Timestamp via `formatYmdHm(item.createdAt)` from new util.
- Reason chip — small filled neutral pill (see UI-SPEC §Color "Reason-category chip colors").

**Sticky summary "Unsuspend" CTA** (visible only when `user.moderationStatus.state !== 'active'`):
```typescript
{user.moderationStatus.state !== 'active' && (
  <TouchableOpacity style={styles.unsuspendButton} onPress={() => openModal('unsuspend')}>
    <Text style={styles.unsuspendText}>{t.unsuspendUser}</Text>
  </TouchableOpacity>
)}
// styles — accent button per UI-SPEC §Component 3:
unsuspendButton: {
  backgroundColor: COLORS.accent,
  paddingVertical: 14,
  borderRadius: SIZES.radiusSm,
  alignItems: 'center',
  marginTop: SIZES.spacingLg,
},
unsuspendText: { color: '#FFF', ...TYPOGRAPHY.labelStrong },
```

---

### `src/screens/AdminDashboardScreen.tsx` (MODIFIED — add nav entry to Moderation)

**Analog:** itself. The current screen has a header (lines 237-243) and tabBar (lines 245-261) and a `FlatList`. UI-SPEC and RESEARCH §Open Question 2 prescribe adding nav cards near the top.

**Pattern to mirror:** look at `ProfileScreen.tsx` menuItems-array-as-card-list (RESEARCH cites lines 28-80). The minimal change is two `TouchableOpacity` cards above `tabBar` linking to `AdminModeration` and `AdminManagement`.

```typescript
<View style={styles.navCardsRow}>
  <TouchableOpacity
    style={styles.navCard}
    onPress={() => navigation.navigate('AdminManagement')}>
    <Users size={24} color={COLORS.accent} />
    <Text style={styles.navCardText}>{t.adminUsersTitle}</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.navCard}
    onPress={() => navigation.navigate('AdminModeration')}>
    <Shield size={24} color={COLORS.accent} />
    <Text style={styles.navCardText}>{t.adminModerationTitle}</Text>
  </TouchableOpacity>
</View>
```

Style mirrors the existing `card` block (`AdminDashboardScreen.tsx:358-365`).

---

### `src/components/moderation/QuickActionSheet.tsx` (NEW — bottom-sheet menu)

**Analog:** `FilterModal.tsx:121-153` (Modal + overlay + stop-propagation) and `AdminManagementScreen.tsx:164-197` (Modal w/ overlay).

**Modal pattern with overlay close + content stop-prop** (FilterModal.tsx:121-153):
```typescript
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <TouchableWithoutFeedback onPress={onClose}>
    <View style={styles.overlay}>
      <TouchableWithoutFeedback>
        <View style={styles.sheet}>
          {/* handle, header, action rows, cancel */}
        </View>
      </TouchableWithoutFeedback>
    </View>
  </TouchableWithoutFeedback>
</Modal>
```
Change `animationType="fade"` → `"slide"` (UI-SPEC bottom-sheet semantics) and pin `overlay` to `flex-end` instead of `center`:
```typescript
overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
sheet: {
  backgroundColor: COLORS.cardBackground,
  borderTopLeftRadius: 20, borderTopRightRadius: 20,
  paddingBottom: insets.bottom + SIZES.spacingSm,
},
```

**ActionRow with disabled-state semantics** — RESEARCH §Pitfalls 11/12 require disabled rows when action is impossible. Use `disabled` prop on `TouchableOpacity` and reduce opacity:
```typescript
<TouchableOpacity
  style={styles.actionRow}
  disabled={!canSuspend}
  onPress={() => onSelect('suspend')}>
  <Shield size={20} color={canSuspend ? COLORS.accent : COLORS.textTertiary} />
  <Text style={[styles.actionLabel, !canSuspend && { opacity: 0.4 }]}>{t.actionSuspend}</Text>
</TouchableOpacity>
```

**Capability gates (RESEARCH §Pitfall 11/12 — derive from target user):**
- `canUnsuspend = user.moderationStatus.state !== 'active'`
- `canRevokeRole = user.brokerStatus === 'APPROVED' || user.logisticsStatus === 'APPROVED' || user.sellerStatus === 'APPROVED'`
- `canEditProfile = user.brokerStatus === 'APPROVED' || user.logisticsStatus === 'APPROVED'`
- `canDeleteProfile = same as canEditProfile`
- `canSuspend = user.moderationStatus.state === 'active'`

If user has BOTH broker + logistics, `Delete profile` opens a sub-choice (two action rows) before the TypedConfirmationModal — RESEARCH §Pitfall 11.

---

### `src/components/moderation/ModerationActionModal.tsx` (NEW — generic action modal)

**Analog:** `FilterModal.tsx` (overall Modal+overlay+content+footer shape) + `ServiceApplicationScreen.tsx:1-26` (KeyboardAvoidingView + Modal + TextInput when keyboard is needed).

**KeyboardAvoidingView + Pressable overlay (UI-SPEC §Component 4 layout):**
```typescript
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={{ flex: 1 }}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{titleForAction(action, t)}</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.body}>
          {/* TargetUserSummary */}
          {renderFieldsForAction(action)}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>{t.modalCancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, !isValid && { opacity: 0.5 }]}
            disabled={!isValid || submitting}
            onPress={handleConfirm}>
            {submitting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.confirmText}>{confirmLabelForAction(action, t)}</Text>}
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </KeyboardAvoidingView>
</Modal>
```

**Submit flow (D-08 — optimistic):** ModerationActionModal does NOT call `ModerationService` directly. It calls `props.onSubmit(payload)`; the parent (row handler / detail screen) does the optimistic flip + ModerationService call + rollback. Modal closes on Confirm via `onClose()`.

**Severity radio cards (UI-SPEC §Component 4 SeverityPicker):** stack 3 vertically; selected → `borderColor: COLORS.accent` + tinted bg `rgba(59,130,246,0.08)`. The card title + capability preview live in the radio card, sourced from `t.severityFeatureLimited` etc.

**Reason picker pill row** (mirrors `FilterModal.tsx:201-225` `optionsContainer` structure but with the softer "border accent + tinted bg" treatment from `FilterBar.tsx:63-69` — UI-SPEC accent reservation rule).

**Note multiline TextInput** (mirrors `ServiceProfileScreen.tsx` description-field pattern; planner can grep that file for the exact `multiline + textAlignVertical: 'top' + maxLength` config). Counter "N/500" rendered below the input.

---

### `src/components/moderation/SeverityBadge.tsx` (NEW — pure presentational pill)

**Analog:** `AdminDashboardScreen.tsx:163-175` — the inline `typeBadge` + `phoneBadge` render the exact pill shape this badge needs.

**Inline analog source:**
```typescript
<View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.requestType) + '20' }]}>
  <Text style={[styles.typeBadgeText, { color: getTypeColor(item.requestType) }]}>
    {getTypeLabel(item.requestType)}
  </Text>
</View>
// styles:
typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
typeBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
```

**Mirror as a typed component** consuming `COLORS.moderation[stateKey]`:
```typescript
type State = 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
const KEY: Record<State, keyof typeof COLORS.moderation> = {
  active: 'active',
  feature_limited: 'featureLimited',
  blocked_with_review: 'blockedReview',
  permanently_banned: 'permaBanned',
};

export const SeverityBadge: React.FC<{ state: State }> = ({ state }) => {
  const { t } = useLanguage();
  const k = KEY[state];
  const palette = COLORS.moderation[k];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.text, { color: palette.fg }]} accessibilityRole="text">
        {t[`stateFilter${k.charAt(0).toUpperCase() + k.slice(1)}` as keyof typeof t]}
      </Text>
    </View>
  );
};
```

UI-SPEC §Color locks the palette in `COLORS.moderation.{active,featureLimited,blockedReview,permaBanned}`.

---

### `src/components/moderation/EmptyState.tsx` (NEW — pure primitive)

**Analog:** `AdminDashboardScreen.tsx:268-273` (inline `ListEmptyComponent`) — extract to a reusable component.

**Inline source:**
```typescript
<View style={styles.emptyState}>
  <CheckCircle size={48} color={COLORS.textSecondary} />
  <Text style={styles.emptyTitle}>{t.noPendingRequests}</Text>
</View>
// styles (AdminDashboardScreen.tsx:445-456):
emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, gap: 12 },
emptyTitle: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '500' },
```

**Generalize to** (props per UI-SPEC §Loading/Empty matrix):
```typescript
import { LucideIcon } from 'lucide-react-native';
export const EmptyState: React.FC<{
  icon: LucideIcon; title: string; body: string;
}> = ({ icon: Icon, title, body }) => (
  <View style={styles.container}>
    <Icon size={40} color={COLORS.textTertiary} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{body}</Text>
  </View>
);
// styles:
container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SIZES.spacing2xl, paddingHorizontal: SIZES.spacingLg },
title: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary, marginTop: SIZES.spacingMd, textAlign: 'center' },
body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SIZES.spacingSm, textAlign: 'center', maxWidth: 280 },
```

---

### `src/components/moderation/TypedConfirmationModal.tsx` (NEW — destructive sentinel gate)

**Analog:** `FilterModal.tsx:121-153` (overlay+content) + `AdminManagementScreen.tsx:164-197` (Modal w/ TextInput + disabled save button via `adding` flag).

**Pattern to copy from `AdminManagementScreen.tsx:174-194`** (TextInput + disabled Confirm):
```typescript
<TextInput
  style={styles.modalInput}
  placeholder="email@example.com"
  placeholderTextColor={COLORS.textSecondary}
  keyboardType="email-address"
  autoCapitalize="none"
  value={typed}
  onChangeText={setTyped}
/>
<TouchableOpacity
  style={[styles.confirmButton, !matches && { opacity: 0.5 }]}
  disabled={!matches || submitting}
  onPress={handleConfirm}>
  {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text>{t.modalConfirm}</Text>}
</TouchableOpacity>
```

**Sentinel matching logic (UI-SPEC §5):**
```typescript
const matches = typed.trim().toLowerCase() === target.email.trim().toLowerCase();
const dirty = typed.length > 0;
// border color cue:
borderColor: matches ? COLORS.successFg : (dirty ? COLORS.destructive : COLORS.border),
```

**Warning banner + per-action body** — UI-SPEC §Component 5 layout. Body picks one of:
- `t.typedConfirmWarningBodyDelete` for `delete_profile`
- `t.typedConfirmWarningBodyRevoke` for `revoke_role`
- `t.typedConfirmWarningBodyPermaBan` for `suspend` at `permanently_banned`

**`{email}` interpolation** — translations contain literal `{email}` which the renderer replaces inline (`t.typedConfirmHint.replace('{email}', target.email)`).

---

### `src/services/moderation/ModerationService.ts` (MODIFIED — add `getHistory` real impl + `searchUsers`)

**Analog:** itself, lines 84-165 (each existing method = the per-method shape to mirror).

**Existing method shape** (`ModerationService.ts:84-95`):
```typescript
suspend: async (targetUid: string, body: SuspendBody) => {
  try {
    const response = await apiClient.post(
      `/api/admin/moderation/${targetUid}/suspend`, body,
    );
    return response.data;
  } catch (error) {
    console.error('Failed to suspend user', error);
    throw error;
  }
},
```

**Replace stub at `ModerationService.ts:176-178`** (RESEARCH §Code Examples lines 770-786):
```typescript
export interface ModerationActionRow {
  _id: string;
  action: 'suspend' | 'unsuspend' | 'revoke_role' | 'restore_role' | 'edit_profile' | 'delete_provider_profile';
  severity: 'feature_limited' | 'blocked_with_review' | 'permanently_banned' | 'none';
  roleAffected?: 'seller' | 'broker' | 'logistics';
  reasonCategory?: 'spam' | 'policy_violation' | 'fraud' | 'other';
  note?: string | null;
  adminUid: string;
  adminEmail: string;
  targetUid: string;
  fieldDiff?: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
}

export interface GetHistoryQuery { limit?: number; cursor?: string; }
export interface GetHistoryResult { rows: ModerationActionRow[]; nextCursor: string | null; }

getHistory: async (
  targetUid: string,
  query: GetHistoryQuery = {},
): Promise<GetHistoryResult> => {
  try {
    const response = await apiClient.get(
      `/api/admin/moderation/${targetUid}/history`,
      { params: query },
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch moderation history', error);
    throw error;
  }
},
```

**Add `searchUsers` method** (RESEARCH §Code Examples lines 700-742):
```typescript
export interface SearchUsersQuery {
  q?: string;
  role?: 'buyer' | 'seller' | 'broker' | 'logistics' | 'admin';
  state?: 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
  cursor?: string;
  limit?: number;
}

export interface SearchUsersResult {
  users: Array<{
    localId: string; email: string;
    firstName?: string; lastName?: string; photoURL?: string;
    createdAt?: string;
    sellerStatus?: string; brokerStatus?: string; logisticsStatus?: string;
    isAdmin?: boolean;
    moderationStatus: { state: 'active'|'feature_limited'|'blocked_with_review'|'permanently_banned'; severity?: string; reasonCategory?: string; note?: string | null; setAt?: string };
  }>;
  nextCursor: string | null;
}

searchUsers: async (query: SearchUsersQuery): Promise<SearchUsersResult> => {
  try {
    const response = await apiClient.get('/api/admin/users/search', { params: query });
    return response.data;
  } catch (error) {
    console.error('Failed to search users', error);
    throw error;
  }
},
```

**What to keep:** the `try/catch + console.error + throw` shape that all 6 existing methods follow. The `apiClient` instance (NOT raw `axios`). The MOB-01 guardrail — these methods stay in `ModerationService`, never migrate to `AuthService`.

**AbortController support (planner decides):** Add an optional `signal?: AbortSignal` to `searchUsers` so callers can cancel in-flight requests; pass via `{ params: query, signal }`. Forward-compat with axios 1.x per RESEARCH §A2.

---

### `src/hooks/useDebouncedValue.ts` (NEW — pure utility hook)

**Analog:** `src/hooks/useNetwork.ts:1-19` — closest hook shape (single-purpose, returns single value, useEffect-based). RESEARCH confirms NO debounce hook exists in the codebase.

**Source pattern from `useNetwork.ts:1-18`** (mount/unmount lifecycle inside useEffect):
```typescript
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export const useNetwork = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(!!state.isConnected);
    });
    return () => { unsubscribe(); };
  }, []);
  return isConnected;
};
```

**Copy verbatim from RESEARCH §Code Examples lines 622-633** (already handed to us):
```typescript
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

What to keep from analog: the `useState` initial-value-from-prop pattern, the cleanup-in-return-fn convention, the named export.

---

### `src/utils/formatYmdHm.ts` (NEW — date formatter)

**Analog:** `AdminDashboardScreen.tsx:155-158` — inline `formatDate` using `Date.toLocaleDateString()`. The pattern is "no date lib, use native Date".

**Inline analog source:**
```typescript
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
};
```

**Extend to YYYY-MM-DD HH:mm format** (RESEARCH §Code Examples lines 608-617):
```typescript
export function formatYmdHm(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
```

**Keep from analog:** native `Date` API only (no `moment`/`date-fns`); single-export utility module pattern.
**Change:** explicit format (UI-SPEC locks `YYYY-MM-DD HH:mm`) rather than locale-default.

---

### `src/utils/moderationErrorKeyMap.ts` (NEW — error code → translation key)

**Analog:** `src/utils/passwordPolicy.ts` — exported constant + helper utility from `src/utils/`.

**Copy from RESEARCH §Code Examples lines 681-695:**
```typescript
export const MODERATION_ERROR_KEY_MAP = {
  cannot_moderate_self:    'errCannotModerateSelf',
  last_admin_protected:    'errLastAdmin',
  role_not_assigned:       'errRoleNotAssigned',
  invalid_field:           'errInvalidField',
  no_changes:              'errNoChanges',
  invalid_role_for_delete: 'errInvalidRoleForDelete',
  user_not_found:          'errUserNotFound',
  rate_limited:            'errRateLimited',
  already_at_severity:     'errAlreadyAtSeverity',
  not_suspended:           'errNotSuspended',
  account_suspended:       'errAccountSuspended',
} as const;

export type ModerationErrorCode = keyof typeof MODERATION_ERROR_KEY_MAP;
```

Used by every screen catching `ModerationError` to map `err.code` → `t[mappedKey]`.

---

### `src/types/navigation.ts` (MODIFIED — add 2 routes)

**Analog:** itself, lines 1-23. Existing param shapes (`CarDetails: { carId: string; carData?: any }`) are the precedent for typed param objects.

**Add at the end of `RootStackParamList`:**
```typescript
  AdminModeration: undefined;
  AdminUserDetail: { targetUid: string };
```

**What to keep:** sorted by domain grouping already used; trailing semicolon convention; `undefined` for param-less screens.

---

### `src/constants/translations.ts` (MODIFIED — add ~70 RU+EN keys)

**Analog:** itself. Lines 114-138 hold the existing admin block in RU; lines 510-540 the EN parity. The convention is **flat camelCase** — no nesting.

**Existing block sample (translations.ts:114-117):**
```typescript
adminPanel: 'Панель администратора',
manageAdmins: 'Управление админами',
pendingRequests: 'Заявки на рассмотрение',
adminUsers: 'Администраторы',
```

**RESEARCH §Pitfall 8 NOTE:** preserve `adminUsers` (still means "Administrators" in Profile menu); add `adminUsersTitle: 'Пользователи'` / `'Users'` for the repurposed screen header. Do not reuse the existing key.

**Add (~70 keys):** every key prescribed in UI-SPEC §Copywriting Contract — screen titles, filter chips, severity names + descriptions, reason categories, action names, form field labels, primary CTAs, typed-confirmation copy, empty states, error states, success toasts, sticky-summary copy, capability preview copy. See UI-SPEC tables for exact RU+EN strings.

**Pattern conventions:**
- Group new keys with a `// Phase 5 — Admin Moderation UI` comment block.
- Keep RU and EN block ordering identical (helps grep parity audits).
- Use `{email}` / `{count}` / `{list}` interpolation tokens; render with `string.replace('{token}', value)`.

---

### `src/constants/theme.ts` (MODIFIED — extend COLORS, SIZES; add TYPOGRAPHY)

**Analog:** itself, lines 1-17. Tiny file — append new tokens following the same exported-const pattern.

**Existing source:**
```typescript
export const COLORS = {
  background: '#0F1115', cardBackground: '#181B21',
  textPrimary: '#FFFFFF', textSecondary: '#9CA3AF', textTertiary: '#6B7280',
  accent: '#3B82F6', border: '#2A2F3A', searchBackground: '#232730',
  success: '#22C55E',
};
export const SIZES = { padding: 16, borderRadius: 12, iconSize: 24 };
```

**Apply UI-SPEC §Token Additions Summary as a single atomic patch** (UI-SPEC lines 691-746). Key additions:
- `COLORS.moderation.{active,featureLimited,blockedReview,permaBanned}` (each with `bg`, `fg`, `border`)
- `COLORS.role.{admin,broker,seller,logistics}` (each with `bg`, `fg`)
- `COLORS.destructive`, `COLORS.warning`, `COLORS.successFg`, `COLORS.textTertiaryStrong`
- `SIZES.spacing{Xs,Sm,Md,Lg,Xl,2xl}`, `SIZES.radius{Sm,Md,Pill}`, `SIZES.minTapTarget`, `SIZES.badgeHeight`, `SIZES.chipHeight`, `SIZES.bottomSheetHandle{Width,Height}`
- New `export const TYPOGRAPHY = { body, bodyStrong, label, labelStrong, heading, display }` object

**Back-compat preserved:** keep existing `success`, `padding`, `borderRadius`, `iconSize` keys unchanged (existing call sites reference them).

---

### `App.tsx` (MODIFIED — register 2 new Stack.Screen entries)

**Analog:** `App.tsx:91-111` — existing Stack.Screen registrations.

**Existing pattern:**
```typescript
<Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
<Stack.Screen name="AdminManagement" component={AdminManagementScreen} />
```

**Add:**
```typescript
import { AdminModerationScreen } from './src/screens/AdminModerationScreen';
import { AdminUserDetailScreen } from './src/screens/AdminUserDetailScreen';
// ...
<Stack.Screen name="AdminModeration" component={AdminModerationScreen} />
<Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
```

**Do NOT** add deep-link entries to the `linking` config (RESEARCH §Runtime State Inventory — admin nav is in-app only).

---

### Backend routes (companion repo `backend-services/carEx-services`)

**Status:** Cross-repo. The companion repo is NOT in this carEx repo (verified via `Glob` — no `backend-services/` directory locally). Planner must:
1. Open the companion repo for the actual analog reads.
2. Mirror Phase 2 moderation route patterns (cited in CONTEXT.md §canonical_refs as `02-CONTEXT.md` + `02-*-SUMMARY.md`).
3. Reuse `requireAdmin` middleware + Phase 2 rate-limiter.
4. Use the same error envelope (`{ error: code, ... }`) so the mobile interceptor + `MODERATION_ERROR_KEY_MAP` continue to work.

**Endpoint contracts (from UI-SPEC + RESEARCH consumption):**

| Method | Path | Query Params | Response Shape |
|--------|------|--------------|----------------|
| GET | `/api/admin/moderation/:targetUid/history` | `limit`, `cursor` | `{ rows: ModerationActionRow[], nextCursor: string \| null }` |
| GET | `/api/admin/users/search` | `q`, `role`, `state`, `cursor` (or `page`), `limit` | `{ users: User[], nextCursor: string \| null }` |

**Cursor vs offset:** RESEARCH §Open Question 1 leaves this to the planner; recommendation is cursor for forward-stability. Backend + mobile must agree in the same wave.

---

### Test files (NEW — paths at planner discretion)

**Analog:** `src/context/__tests__/AuthContext.test.tsx` — the established jest mock pattern.

**Mock conventions to mirror:**
```typescript
jest.mock('../services/AuthService');
(AuthService.getBackendUser as jest.Mock).mockResolvedValue({
  moderationStatus: { state: 'active' },
});
```

**Suggested test targets:**
1. `src/services/moderation/__tests__/ModerationService.searchUsers.test.ts` — assert path + query params + cursor pagination shape
2. `src/services/moderation/__tests__/ModerationService.getHistory.test.ts` — same
3. `src/hooks/__tests__/useDebouncedValue.test.ts` — fire fast value changes, assert only final value emitted after delay
4. `src/components/moderation/__tests__/SeverityBadge.test.tsx` — snapshot per state
5. `src/components/moderation/__tests__/TypedConfirmationModal.test.tsx` — assert Confirm enabled only when typed === target.email
6. `src/screens/__tests__/AdminModerationScreen.test.tsx` — debounced search fires correct request; pagination guard prevents loop on empty list

---

## Shared Patterns

### Object-Module Service Export
**Source:** `src/services/moderation/ModerationService.ts:81` (and AuthService precedent).
**Apply to:** All new methods on `ModerationService` (`getHistory`, `searchUsers`).
**Pattern:** add to existing object literal; do NOT class-ify, do NOT split into per-method files.

### Per-Method `try/catch + console.error + throw`
**Source:** `ModerationService.ts:84-95` (every method).
**Apply to:** `getHistory`, `searchUsers`. Re-throw lets the response interceptor surface `ModerationError` for 403 account_suspended; everything else stays as raw axios error for the screen's catch block.

### `useState` + `useCallback` + `useEffect` + `RefreshControl` + `FlatList` screen shape
**Source:** `AdminManagementScreen.tsx:30-62, 156-162`.
**Apply to:** All 3 Phase 5 screens (Management modifications, ModerationScreen, UserDetailScreen).
**Includes:** `setRefreshing(true) → fetch → setRefreshing(false)` for pull-to-refresh; `tintColor={COLORS.accent}` on `RefreshControl`.

### Loading-state full-screen `ActivityIndicator`
**Source:** `AdminManagementScreen.tsx:131-140`.
**Apply to:** All 3 Phase 5 screens for initial load (UI-SPEC §Loading/Empty matrix). Use `size="large" color={COLORS.accent}` inside a `centered` View.

### Modal with overlay close + content stop-propagation
**Source:** `FilterModal.tsx:121-153`.
**Apply to:** `QuickActionSheet`, `ModerationActionModal`, `TypedConfirmationModal`. Change `animationType` to `slide` for bottom sheets and `fade` for the centered destructive modal (per UI-SPEC §Interaction & Animation Contracts).

### Filter chip — softer "accent border + tinted bg" treatment
**Source:** `FilterBar.tsx:63-69` (`activeFilterButton` / `activeFilterText`).
**Apply to:** All chip rows on `AdminManagementScreen` (Admins-only filter), `AdminModerationScreen` (Role + State chip rows), Reason picker, Severity picker selected card border.
**Why this and not FilterModal's solid accent:** UI-SPEC §Color reserves solid `COLORS.accent` for primary CTAs only.

### Disabled action / button state
**Source:** `AdminManagementScreen.tsx:187-193` — `disabled` prop on `TouchableOpacity` + ActivityIndicator swap.
**Apply to:** `QuickActionSheet` action rows (per-action capability gates), `TypedConfirmationModal` Confirm (until sentinel matches), `ModerationActionModal` Confirm (until required fields filled + while submitting).

### `Alert.alert(t.error, ...)` for failure surfaces
**Source:** `AdminManagementScreen.tsx:46-47, 76-77, 96-97`.
**Apply to:** All Phase 5 catch blocks. For `ModerationError` instances, prefer the mapped `t[MODERATION_ERROR_KEY_MAP[code]]` string. For raw axios errors, fall back to `t.errGeneric` or `t.errNetwork` (no `err.response`).

### i18n hook + flat camelCase keys
**Source:** `LanguageContext` + `translations.ts`. Conventions documented in CLAUDE.md §i18n.
**Apply to:** every user-facing string in Phase 5. RU first, EN parity. UI-SPEC prescribes ~70 keys.

### Inline `StyleSheet.create()` at file bottom
**Source:** Every component / screen in repo (e.g. `AdminManagementScreen.tsx:202-336`).
**Apply to:** All new Phase 5 components and screens. Reference `COLORS` / `SIZES` / `TYPOGRAPHY` tokens — never hardcode hex values (other than neutrals like `#FFF`/`#000`/`#FFFFFF`).

### Context+Hook gate (`useAuth` admin gating)
**Source:** `AuthContext.tsx:152-158` (the standard `useContext` + throw pattern).
**Apply to:** All Phase 5 screens — `const { user, isAdmin, adminRole, refreshUser } = useAuth();` to gate access (UI-only; backend enforces too).

### Module-level `_skipModerationInterceptor` reservation
**Source:** `client.ts:31-35` (declaration) + `AuthContext.tsx` refresh call site.
**Apply to:** Phase 5 must NOT add a 3rd occurrence (Phase 4 specifics line 238 lock — exactly 2 non-test sites). Phase 5 calls go through the normal interceptor path.

### Optimistic update + rollback handler
**Source:** RESEARCH §Code Examples lines 638-674 (concrete pattern), no in-repo analog yet.
**Apply to:** All 5 actions (suspend/unsuspend/revokeRole/deleteProviderProfile/editProviderProfile) on the row handler in `AdminManagementScreen` and the detail-screen handlers in `AdminUserDetailScreen`.

### Wrapper-component pattern for context-consuming effects
**Source:** `App.tsx:58-62` (`AppStateRefreshEffect`) + `OfflineNotice.tsx:10-24`.
**Apply to:** Only if Phase 5 needs a context-consuming side-effect outside a screen. Most logic lives in screens; this pattern likely not needed for Phase 5 but documented for consistency.

---

## No Analog Found

Files where the in-repo analog is partial — fall back to RESEARCH.md / UI-SPEC code blocks (which are concrete, not abstract):

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `src/hooks/useDebouncedValue.ts` | hook | transform | No debounce hook in codebase | RESEARCH §Code Examples lines 622-633 (15-line ready-to-paste). Hook shape mirrors `useNetwork.ts`. |
| Infinite-scroll FlatList wiring (in `AdminModerationScreen` + `AdminUserDetailScreen`) | screen behavior | request-response | No `onEndReached` pagination exists in codebase (HomeScreen fetches all-at-once) | RESEARCH §Pitfall 9 (guard) + UI-SPEC §Component 2 (pagination contract). |
| Sticky FlatList header pattern (`AdminUserDetailScreen`) | screen layout | none | No sticky-header `FlatList` exists in codebase | UI-SPEC §Component 3 LOCKS the pattern: single `FlatList` + `ListHeaderComponent={StickySummaryCard}` + `stickyHeaderIndices={[0]}`. RESEARCH §Pitfall 10 calls out platform parity. |
| `TypedConfirmationModal` sentinel-typed gate | component | event + validation | No typed-confirm pattern exists in codebase | UI-SPEC §Component 5 LOCKS the pattern. Reuses `Modal` + `TextInput` + `disabled` from `AdminManagementScreen.tsx:174-194`. |
| Backend cursor-pagination route shape | backend | request-response | Cross-repo; not in this carEx repo | Companion repo Phase 2 routes — planner reads them in `backend-services/carEx-services` repo. |

---

## Cross-Cutting Reminders for Planner

From CONTEXT.md, RESEARCH.md, UI-SPEC.md, and 04-PATTERNS.md:

1. **MOB-01 guardrail** — Phase 5 must keep `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` at **0**. All new HTTP lives in `ModerationService`.
2. **`_skipModerationInterceptor` lock** — exactly **2** non-test occurrences. Phase 5 adds zero. Refreshes go through `AuthContext.refreshUser()` / `refreshUserForced()`.
3. **Refresh self after own-edit** — when admin moderates their own row (edge case for `edit_profile`), call `refreshUserForced()` (not `refreshUser`, since the 30s cooldown would otherwise eat it). The forced variant is exposed by AuthContext per Phase 4 plan 04-04.
4. **Optimistic-flip race vs AppState refresh is a non-issue** for arbitrary targets (refreshUser only touches the current admin's own user object, not the list). Self-edit is the only collision case — see point 3.
5. **Severity palette is single-source-of-truth** — define once in `COLORS.moderation.*`; Phase 6 `UserStatusBanner` will import the same palette verbatim.
6. **No new HTTP libs, no bottom-sheet libs, no debounce libs, no date libs** — CLAUDE.md tech-stack discipline. Use stock RN + the 15-line debounce hook + `Date.prototype` formatting + the pre-installed `apiClient`.
7. **Backend + mobile waves coupling** — RESEARCH §Pitfall 7 + §Wave order: Wave 0 ships backend routes; Wave 1 wires `ModerationService.getHistory`/`searchUsers`; Wave 2 ships shared components; Wave 3 ships screens.
8. **Row tap vs trailing-icon tap** — sibling `TouchableOpacity` (NOT nested) per RESEARCH §Pitfall 4. Row-tap navigates to detail; trailing icon opens QuickActionSheet.
9. **Disabled-state semantics on QuickActionSheet** — render disabled rows (do not hide) for impossible actions (RESEARCH Open Q5; CONTEXT specifics).
10. **`adminUsers` translation key — preserve, do NOT rename** (RESEARCH §Pitfall 8 + Open Q6). New header uses `adminUsersTitle`.
11. **Deep links — admin screens are in-app only.** Do NOT add `linking.config.screens` entries for the 2 new routes (RESEARCH §Runtime State Inventory).

---

## Metadata

**Analog search scope:** `src/screens/`, `src/components/`, `src/services/moderation/`, `src/services/http/`, `src/hooks/`, `src/context/`, `src/constants/`, `src/utils/`, `src/types/`, `App.tsx`
**Files scanned:** 18 primary + supporting analogs (AuthContext, http/client, OfflineNotice, AuthService.getAdminUsers, translations head)
**Cross-repo NOT scanned:** `backend-services/carEx-services` (lives outside this repo per CLAUDE.md `## Project` line)
**Pattern extraction date:** 2026-04-18
**Phase:** 05-admin-moderation-ui-mobile
