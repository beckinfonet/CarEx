---
quick_id: 260530-bdq
type: execute
wave: 1
autonomous: true
files_modified:
  - src/context/PersonalityContext.tsx
  - src/context/__tests__/PersonalityContext.test.tsx
  - src/constants/translations.ts
  - src/components/home/v2/UnhingedSnackbar.tsx
  - src/components/home/v2/UnhingedConsentModal.tsx
  - src/screens/HomeScreenV2.tsx
requirements:
  - QUICK-260530-bdq-consent-gate
must_haves:
  truths:
    - "First tap selecting UNHINGED in the picker opens the consent modal (tier does NOT change)."
    - "First cycle-tap that lands on UNHINGED via TierChip opens the consent modal (tier does NOT change)."
    - "Pressing modal Accept persists the accepted flag, switches the tier to UNHINGED, and shows the snackbar."
    - "Pressing modal Cancel (or backdrop) closes the modal and leaves the tier unchanged."
    - "After acceptance, subsequent UNHINGED entries (picker or cycle) switch immediately and show the snackbar (no modal)."
    - "On app relaunch with the persisted accepted flag, entering UNHINGED never shows the modal again."
    - "Switching to WHOLESOME or SARCASTIC is never gated and never triggers the snackbar."
    - "All consent strings have RU + EN parity and contain no emoji."
  artifacts:
    - path: src/context/PersonalityContext.tsx
      provides: "unhingedAccepted state, acceptUnhinged(), requestTier(), gated cycleTier()"
      contains: "@carex.personality.unhinged.accepted.v1"
    - path: src/components/home/v2/UnhingedSnackbar.tsx
      provides: "Cross-platform animated snackbar (no ToastAndroid)"
      contains: "unhinged-snackbar"
    - path: src/components/home/v2/UnhingedConsentModal.tsx
      provides: "Transparent fade Modal with title/body/accept/cancel"
      contains: "unhinged-consent-modal"
    - path: src/constants/translations.ts
      provides: "5 new keys × 2 locales: unhingedConsentTitle/Body/Accept/Cancel, unhingedActiveToast"
      contains: "unhingedConsentTitle"
  key_links:
    - from: "src/screens/HomeScreenV2.tsx"
      to: "src/context/PersonalityContext.tsx#requestTier"
      via: "TierPickerSheet onSelect + TierChip onCycle return-value branching"
      pattern: "requestTier|cycleTier"
    - from: "src/screens/HomeScreenV2.tsx"
      to: "src/components/home/v2/UnhingedConsentModal.tsx"
      via: "consentVisible state + acceptUnhinged() handler"
      pattern: "UnhingedConsentModal"
    - from: "src/screens/HomeScreenV2.tsx"
      to: "src/components/home/v2/UnhingedSnackbar.tsx"
      via: "snackbarVisible state + onHide callback"
      pattern: "UnhingedSnackbar"
---

<objective>
Add a first-time consent gate for the UNHINGED personality tier on HomeScreenV2. First entry (via TierPickerSheet OR TierChip cycle-tap) opens a modal that the user must explicitly accept; subsequent entries show a brief auto-dismissing snackbar reminder. Persist the accepted flag locally so the modal is shown at most once per device.

Purpose: Give users informed-consent before exposing them to the deliberately blunt UNHINGED copy, without nagging on every switch. Single source of truth lives in PersonalityContext so both entry paths (picker and chip) are gated identically.

Output: Extended `PersonalityContext` with `unhingedAccepted` + `acceptUnhinged()` + `requestTier()`, gated `cycleTier()`, two new presentational components (`UnhingedConsentModal`, `UnhingedSnackbar`), five new RU/EN translation keys, and HomeScreenV2 wiring that consumes the new API.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/context/PersonalityContext.tsx
@src/context/__tests__/PersonalityContext.test.tsx
@src/components/home/v2/TierPickerSheet.tsx
@src/components/home/v2/TierChip.tsx
@src/components/home/v2/theme.ts

<interfaces>
Existing PersonalityContext public API (src/context/PersonalityContext.tsx):
- `export type PersonalityTier = 'wholesome' | 'sarcastic' | 'unhinged';`
- `export const ALL_TIERS: PersonalityTier[];`
- `interface PersonalityContextType { tier; setTier(t); cycleTier(); }` — `cycleTier()` currently returns `void`.
- Storage keys already in use: `@carex.personality.tier.v1`.
- Hydration pattern: single `useEffect` reads AsyncStorage on mount with `cancelled` guard; persistence uses a `persistMountRef` guard to skip the first render.

Existing TierPickerSheet props (signature unchanged in this plan):
- `{ visible, currentTier, previews, labels: { title, close, wholesome, sarcastic, unhinged }, onSelect(tier), onDismiss() }`

Existing TierChip props (signature unchanged in this plan):
- `{ tier, label, onCycle(), onOpenPicker(), a11yLabel, a11yHint }` — `onCycle` is fire-and-forget; HomeScreenV2 chooses what to do based on PersonalityContext return values, not the chip.

V2 theme tokens available (src/components/home/v2/theme.ts):
- `V2.bg`, `V2.surface`, `V2.surfaceHi`, `V2.border`, `V2.borderHi`, `V2.text`, `V2.textMuted`, `V2.radius.{hero,big,small,shelf,pill}`.

Existing personality translation keys (already in src/constants/translations.ts, RU @ ~line 817, EN @ ~line 1639):
- `personalityTitle`, `personalityClose`, `personalityWholesome`, `personalitySarcastic`, `personalityUnhinged`, `personalityA11yHint`.
Add the five new keys directly under the existing block in BOTH locales.

HomeScreenV2 current tier wiring (src/screens/HomeScreenV2.tsx):
- Line ~51: `const { tier, setTier, cycleTier } = usePersonality();`
- Line ~52: `const [pickerVisible, setPickerVisible] = useState(false);`
- Line ~197-204: `<TierChip ... onCycle={cycleTier} onOpenPicker={() => setPickerVisible(true)} ... />`
- Line ~283-299: `<TierPickerSheet ... onSelect={(next) => { setTier(next); setTimeout(() => setPickerVisible(false), 150); }} ... />`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend PersonalityContext with consent state, add 5 translation keys, expand tests</name>
  <files>src/context/PersonalityContext.tsx, src/context/__tests__/PersonalityContext.test.tsx, src/constants/translations.ts</files>
  <behavior>
    PersonalityContext tests (extend existing `describe('PersonalityContext', ...)` block — keep all current tests passing):
    - `requestTier('unhinged')` returns the string `'needs-consent'` when AsyncStorage is empty; `hookResult.tier` stays `'wholesome'`.
    - After `acceptUnhinged()` resolves, `requestTier('unhinged')` returns `'switched'` and `hookResult.tier` becomes `'unhinged'`.
    - `acceptUnhinged()` calls `AsyncStorage.setItem` with the key `'@carex.personality.unhinged.accepted.v1'` and value `'true'`.
    - Hydration test: when `AsyncStorage.getItem` resolves `'true'` for the accepted key (use a per-key mock implementation), `requestTier('unhinged')` returns `'switched'` on the first call (no modal needed). The existing `getItem` mock returns `null` for the tier key, so default tier remains `'wholesome'` pre-call.
    - `cycleTier()` called from initial `'wholesome'` -> advances to `'sarcastic'` and returns `'switched'`. Called again -> next-in-cycle is `'unhinged'`; tier stays `'sarcastic'` and the call returns `'needs-consent'`.
    - `requestTier('wholesome')` and `requestTier('sarcastic')` always return `'switched'` regardless of `unhingedAccepted`, and update tier accordingly.
    - Existing tests for default/hydration/persistence/setTier/two-rapid-cycle/quota-reject must continue to pass without modification (the rapid-cycle test currently goes wholesome -> sarcastic -> unhinged in a single act; since unhinged is now gated, update ONLY this single test's assertion to `expect(hookResult.tier).toBe('sarcastic')` and add a comment explaining that the second cycle is now gated by consent — do not change cycleTier semantics to please the old assertion).
  </behavior>
  <action>
    1. In `src/context/PersonalityContext.tsx`:
       - Add constant `const UNHINGED_ACCEPTED_KEY = '@carex.personality.unhinged.accepted.v1';` near the existing `STORAGE_KEY`.
       - Add state `const [unhingedAccepted, setUnhingedAccepted] = useState<boolean>(false);`.
       - In the existing hydration `useEffect`, after reading the tier, also read `AsyncStorage.getItem(UNHINGED_ACCEPTED_KEY)` and call `setUnhingedAccepted(stored === 'true')` if not cancelled. Reuse the same try/catch and `cancelled` guard.
       - Add `const acceptUnhinged = () => { setUnhingedAccepted(true); AsyncStorage.setItem(UNHINGED_ACCEPTED_KEY, 'true').catch((e) => console.error('[PersonalityContext] persist unhinged-accepted failed', e)); };` — mirrors the existing tier-persist error handling style.
       - Add `const requestTier = (next: PersonalityTier): 'needs-consent' | 'switched' => { if (next === 'unhinged' && !unhingedAccepted) return 'needs-consent'; setTierState(next); return 'switched'; };`.
       - Change `cycleTier` return type to `'needs-consent' | 'switched'`. Compute the next tier from the current `tier` state (`const nextIdx = (CYCLE_ORDER.indexOf(tier) + 1) % CYCLE_ORDER.length; const next = CYCLE_ORDER[nextIdx];`). If `next === 'unhinged' && !unhingedAccepted` return `'needs-consent'` without state change. Otherwise call `setTierState(next)` and return `'switched'`. Note: this changes the prior functional-updater form to a value-based read; the existing "two rapid cycleTier calls" test will need its assertion adjusted (see <behavior>) because the second call is now gated by consent. This is intentional and aligns with the consent gate contract.
       - Update `PersonalityContextType` to:
         ```
         tier; setTier(t); cycleTier(): 'needs-consent' | 'switched';
         requestTier(t): 'needs-consent' | 'switched';
         unhingedAccepted: boolean; acceptUnhinged(): void;
         ```
         (Show all six fields as TS members; preserve existing prop names.)
       - Add all new fields to the Provider value object.
    2. In `src/context/__tests__/PersonalityContext.test.tsx`:
       - Replace the single-mock `getItem: jest.fn()` style with per-call `mockResolvedValue` chains where needed for the hydration test, OR switch to `mockedAsync.getItem.mockImplementation((key) => Promise.resolve(key === '@carex.personality.unhinged.accepted.v1' ? 'true' : null))` for that one test. Use the latter — it's clearer.
       - Add the six new tests described in <behavior> at the bottom of the existing `describe` block. Use the same `act`/`flush` helpers and `mockedAsync` pattern. Do not duplicate the file — extend it.
       - Adjust the existing `'two rapid cycleTier calls in one act each advance one step'` test: keep both `hookResult.cycleTier()` calls, change the final assertion from `'unhinged'` to `'sarcastic'`, and update the test's leading comment / title-comment to reflect that the unhinged step is consent-gated. Do NOT change the test title text itself (keeps git diff small).
    3. In `src/constants/translations.ts`, add five keys to BOTH the RU block (after line 822 `personalityA11yHint`) and the EN block (after line 1644 `personalityA11yHint`). Use the exact RU/EN copy from the locked design decisions (key 5) verbatim. No emoji. Keys: `unhingedConsentTitle`, `unhingedConsentBody`, `unhingedConsentAccept`, `unhingedConsentCancel`, `unhingedActiveToast`. Maintain trailing commas matching the surrounding style.
  </action>
  <verify>
    <automated>npx jest src/context/__tests__/PersonalityContext.test.tsx --no-coverage</automated>
  </verify>
  <done>All existing PersonalityContext tests pass; six new tests pass; five new translation keys exist in both RU and EN blocks (verify with `grep -c "unhingedConsent\|unhingedActiveToast" src/constants/translations.ts | grep -v '^#'` returning 10).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create UnhingedSnackbar and UnhingedConsentModal presentational components</name>
  <files>src/components/home/v2/UnhingedSnackbar.tsx, src/components/home/v2/UnhingedConsentModal.tsx</files>
  <action>
    1. Create `src/components/home/v2/UnhingedSnackbar.tsx`:
       - Export `interface UnhingedSnackbarProps { visible: boolean; message: string; onHide: () => void; }`.
       - Export `const UnhingedSnackbar: React.FC<UnhingedSnackbarProps>`.
       - Use a single `useRef(new Animated.Value(0))` for opacity.
       - In a `useEffect` keyed on `visible`: when `visible` becomes `true`, run `Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.delay(2000), Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })]).start(({ finished }) => { if (finished) onHide(); });` — store the running animation in a ref and call `.stop()` in the cleanup so a re-show cancels the previous fade-out cleanly.
       - When `visible === false`, set opacity ref to `0` (no animation) and return early without rendering (or render with `pointerEvents='none'` to keep mount stable — prefer not rendering at all when not visible to avoid intercepting touches above BottomBar).
       - Layout: position absolute, `bottom: 96` (above BottomBar), `left: 18`, `right: 18`, `padding: 12`, `borderRadius: V2.radius.small`, `backgroundColor: V2.surfaceHi`, `borderWidth: 1`, `borderColor: V2.borderHi`. Inner `Text` color `V2.text`, `fontSize: 13`, `fontWeight: '600'`.
       - testIDs: `testID='unhinged-snackbar'` on the `Animated.View`, `testID='unhinged-snackbar-text'` on the `Text`.
       - Pure RN primitives only (`View`, `Text`, `Animated`). No `ToastAndroid`. No emoji.
    2. Create `src/components/home/v2/UnhingedConsentModal.tsx`:
       - Export `interface UnhingedConsentModalProps { visible: boolean; labels: { title: string; body: string; accept: string; cancel: string; }; onAccept: () => void; onCancel: () => void; }`.
       - Export `const UnhingedConsentModal: React.FC<UnhingedConsentModalProps>`.
       - Structure: `<Modal visible={visible} transparent animationType='fade' onRequestClose={onCancel}>` -> `<Pressable testID='unhinged-consent-backdrop' style={styles.backdrop} onPress={onCancel} />` -> centered `<View testID='unhinged-consent-modal' accessibilityViewIsModal role='dialog' accessibilityLabel={labels.title} style={styles.card}>` with title `<Text style={styles.title}>{labels.title}</Text>`, body `<Text style={styles.body}>{labels.body}</Text>`, and a row of two `TouchableOpacity` buttons: cancel (testID `unhinged-consent-cancel`) and accept (testID `unhinged-consent-accept`).
       - Style language to match `TierPickerSheet`: backdrop `rgba(0,0,0,0.55)` absolute fill; card centered (use a wrapper `<View style={styles.center}>` with `flex:1, justifyContent:'center', alignItems:'center', padding:24` around the card so the backdrop Pressable sits BEHIND it — order: backdrop Pressable first, then absolutely-positioned center View on top with `pointerEvents='box-none'` so taps outside the card still hit the backdrop). Card background `#0f1827` (same as picker sheet for visual consistency), borderRadius 20, borderWidth 1, borderColor `V2.border`, padding 20, maxWidth 360, alignSelf center.
       - Accept button: filled `backgroundColor: '#ffba66'`, text color `#0f1827`, fontWeight `'800'`. Cancel button: transparent with `borderWidth: 1, borderColor: V2.borderHi`, text color `V2.text`.
       - Accessibility: each button has `accessibilityRole='button'` and `accessibilityLabel` set to its label text.
       - No emoji. Use only `V2.*` tokens and the dark navy `#0f1827` (matches `TierPickerSheet.styles.sheet` — already an established neutral in this directory).
  </action>
  <verify>
    <automated>npx tsc --noEmit --pretty false 2>&1 | grep -E "src/components/home/v2/(UnhingedSnackbar|UnhingedConsentModal)" | grep -v '^#' | wc -l | tr -d ' '</automated>
  </verify>
  <done>Both files exist and compile with zero TS errors (verify command returns `0`); each exports a single named `React.FC` with the prop interface above; testIDs match the locked spec exactly.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire consent gate into HomeScreenV2 (picker + cycle paths)</name>
  <files>src/screens/HomeScreenV2.tsx</files>
  <action>
    1. Update the destructure at line ~51 to: `const { tier, setTier, cycleTier, requestTier, acceptUnhinged } = usePersonality();` (do not destructure `unhingedAccepted` — the gate decision lives inside the context).
    2. Add two new state hooks next to the existing `pickerVisible`:
       - `const [consentVisible, setConsentVisible] = useState(false);`
       - `const [snackbarVisible, setSnackbarVisible] = useState(false);`
    3. Import the two new components near the existing v2 imports (lines ~19-32):
       - `import { UnhingedConsentModal } from '../components/home/v2/UnhingedConsentModal';`
       - `import { UnhingedSnackbar } from '../components/home/v2/UnhingedSnackbar';`
    4. Replace the `TierChip onCycle={cycleTier}` prop with a handler that branches on the return value:
       ```
       onCycle={() => {
         const result = cycleTier();
         if (result === 'needs-consent') setConsentVisible(true);
         else if (tier !== 'unhinged' /* stale: pre-update tier */) {
           // Compute post-cycle tier inline to detect 'switched-into-unhinged'.
           // Use CYCLE_ORDER from PersonalityContext if needed, OR rely on a useEffect on `tier` (see step 6).
         }
       }}
       ```
       Implementation choice: prefer the useEffect approach in step 6 over inline computation — simpler and stays in sync with whatever cycle order the context defines.
    5. Replace the `TierPickerSheet onSelect` handler with:
       ```
       onSelect={(next) => {
         const result = requestTier(next);
         if (result === 'needs-consent') {
           setPickerVisible(false);
           setConsentVisible(true);
         } else {
           setTimeout(() => setPickerVisible(false), 150);
         }
       }}
       ```
       (Snackbar emission for the already-accepted re-entry case is handled by the useEffect in step 6 — `requestTier` updates `tier`, the effect fires.)
    6. Add a `useEffect` that emits the snackbar whenever `tier` transitions to `'unhinged'`:
       ```
       const prevTierRef = useRef(tier);
       useEffect(() => {
         if (prevTierRef.current !== 'unhinged' && tier === 'unhinged') {
           setSnackbarVisible(true);
         }
         prevTierRef.current = tier;
       }, [tier]);
       ```
       Place this near the other refs/effects at the top of the component body. Add `useRef` to the existing `react` import if not already present (it is — line 1).
    7. Add the modal accept/cancel handlers (place near other inline handlers above the JSX return):
       ```
       const handleConsentAccept = () => {
         acceptUnhinged();
         setTier('unhinged');
         setConsentVisible(false);
         // snackbar fires via the tier-transition useEffect
       };
       const handleConsentCancel = () => setConsentVisible(false);
       ```
    8. Render the two new components AFTER `<TierPickerSheet>` and BEFORE the closing `</SafeAreaView>` (around line 300):
       ```
       <UnhingedConsentModal
         visible={consentVisible}
         labels={{
           title: t.unhingedConsentTitle,
           body: t.unhingedConsentBody,
           accept: t.unhingedConsentAccept,
           cancel: t.unhingedConsentCancel,
         }}
         onAccept={handleConsentAccept}
         onCancel={handleConsentCancel}
       />
       <UnhingedSnackbar
         visible={snackbarVisible}
         message={t.unhingedActiveToast}
         onHide={() => setSnackbarVisible(false)}
       />
       ```
    9. Do NOT modify TierChip or TierPickerSheet component files — their existing prop signatures are sufficient. The orchestration lives entirely in HomeScreenV2.
    10. Sanity: the existing `ToastAndroid` import on line 2 is unrelated to this work (it's used elsewhere in the screen). Do not remove it.
  </action>
  <verify>
    <automated>npx tsc --noEmit --pretty false 2>&1 | grep -E "src/screens/HomeScreenV2|src/context/PersonalityContext|src/components/home/v2/Unhinged" | grep -v '^#' | wc -l | tr -d ' '</automated>
  </verify>
  <done>TS check returns `0` (no errors across the three modified screens + new components); manual smoke (not part of automated gate): launching HomeScreenV2, tapping TierChip from WHOLESOME -> SARCASTIC, tapping again -> consent modal opens; pressing Accept -> snackbar shows and tier is UNHINGED; relaunching the app and tapping into UNHINGED again -> no modal, just snackbar; backing out via Cancel leaves tier unchanged.</done>
</task>

</tasks>

<verification>
- `npx jest src/context/__tests__/PersonalityContext.test.tsx --no-coverage` — all green
- `npx jest --no-coverage` — full suite still green (no regressions in TierPickerSheet.test or TierChip.test)
- `npx tsc --noEmit` — clean
- `npm run lint -- src/context/PersonalityContext.tsx src/components/home/v2/UnhingedSnackbar.tsx src/components/home/v2/UnhingedConsentModal.tsx src/screens/HomeScreenV2.tsx` — clean
- Translation parity: `grep -c "unhingedConsent\|unhingedActiveToast" src/constants/translations.ts` returns exactly 10 (5 keys × 2 locales)
</verification>

<success_criteria>
- All `must_haves.truths` observable in a smoke run.
- All `must_haves.artifacts` exist at the listed paths and contain the listed markers.
- All `must_haves.key_links` are present via grep on the listed pattern.
- No emoji in any new translation value or component string.
- No new external dependencies added to `package.json`.
- No changes to backend, auth, cart, payments, or any file outside `files_modified`.
</success_criteria>

<output>
After completion, create `.planning/quick/260530-bdq-add-a-first-time-consent-gate-when-user-/260530-bdq-SUMMARY.md` following the standard summary template.
</output>
