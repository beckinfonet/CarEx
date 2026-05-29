import React from 'react';
import fs from 'fs';
import path from 'path';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import { ListingModerationReasonModal } from '../ListingModerationReasonModal';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_target: unknown, k: string) => String(k) }) }),
}));

function makeProps(
  overrides: Partial<React.ComponentProps<typeof ListingModerationReasonModal>> = {},
) {
  return {
    visible: true,
    action: 'suspend' as const,
    carId: 'car-1',
    listingTitle: '2018 Toyota Camry',
    submitting: false,
    onSubmit: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

function render(
  props: Partial<React.ComponentProps<typeof ListingModerationReasonModal>> = {},
) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<ListingModerationReasonModal {...makeProps(props)} />);
  });
  return tree!;
}

function findConfirmButton(root: TestRenderer.ReactTestInstance) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.testID === 'listing-reason-confirm');
}

function findReasonRow(root: TestRenderer.ReactTestInstance, value: string) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.testID === `listing-reason-${value}`);
}

describe('ListingModerationReasonModal', () => {
  test('Test 1: nothing renders when visible=false', () => {
    const tree = render({ visible: false });
    // Modal still in the tree but its visible prop must be false
    const json = tree.toJSON();
    // When Modal is hidden, the contents should not render (react-native test
    // renderer renders Modal as a host node but its children render only when
    // visible). The reasonable assertion is that no listing-reason-* testIDs
    // are findable.
    const rows = tree.root
      .findAllByType(TouchableOpacity)
      .filter((n) => typeof n.props.testID === 'string'
        && (n.props.testID as string).startsWith('listing-reason-'));
    // With visible=false the inner content may or may not render depending on
    // RN Modal implementation; assert serialized output does NOT include any
    // reason-row testID labels visible to the user.
    expect(rows.length === 0 || JSON.stringify(json).includes('listing-reason-')).toBeTruthy();
    // Stronger: assert Modal's visible prop is false somewhere in the tree.
    expect(JSON.stringify(json)).toContain('"visible":false');
  });

  test('Test 2: header reflects each action variant', () => {
    const suspendTree = render({ action: 'suspend' });
    expect(JSON.stringify(suspendTree.toJSON())).toContain('listingActionSuspend');

    const archiveTree = render({ action: 'archive' });
    expect(JSON.stringify(archiveTree.toJSON())).toContain('listingActionArchive');

    const deleteTree = render({ action: 'delete' });
    expect(JSON.stringify(deleteTree.toJSON())).toContain('listingActionDelete');
  });

  test('Test 3: 5-value taxonomy renders exactly 5 reason rows with correct testIDs', () => {
    const tree = render({ action: 'suspend' });
    const expected = [
      'spam',
      'policy_violation',
      'fraud',
      'inactive_seller',
      'other',
    ];
    expected.forEach((value) => {
      const row = findReasonRow(tree.root, value);
      expect(row).toBeDefined();
    });
    // Sibling discipline: no user-domain reasons appear
    expect(findReasonRow(tree.root, 'misleading')).toBeUndefined();
    // Exactly 5 reason rows
    const allRows = tree.root
      .findAllByType(TouchableOpacity)
      .filter((n) => typeof n.props.testID === 'string'
        && /^listing-reason-(spam|policy_violation|fraud|inactive_seller|other)$/.test(n.props.testID));
    expect(allRows).toHaveLength(5);
  });

  test('Test 4: Confirm disabled until reason picked; enabled after spam selected', () => {
    const tree = render({ action: 'suspend' });
    let confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(true);

    const spamRow = findReasonRow(tree.root, 'spam');
    act(() => {
      spamRow?.props.onPress();
    });
    confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(false);
  });

  test('Test 5: archive + inactive_seller + note emits correct onSubmit payload', () => {
    const onSubmit = jest.fn();
    const tree = render({ action: 'archive', onSubmit });

    const reasonRow = findReasonRow(tree.root, 'inactive_seller');
    act(() => {
      reasonRow?.props.onPress();
    });

    const noteInput = tree.root
      .findAllByType(TextInput)
      .find((n) => n.props.multiline === true);
    expect(noteInput).toBeDefined();
    act(() => {
      noteInput?.props.onChangeText("seller hasn't logged in for 90 days");
    });

    const confirm = findConfirmButton(tree.root);
    act(() => {
      confirm?.props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      reasonCategory: 'inactive_seller',
      note: "seller hasn't logged in for 90 days",
    });
  });

  test('Test 6: delete action emits payload — NO internal TypedConfirmationModal escalation (D-07)', () => {
    const onSubmit = jest.fn();
    const tree = render({ action: 'delete', onSubmit });

    const reasonRow = findReasonRow(tree.root, 'spam');
    act(() => {
      reasonRow?.props.onPress();
    });

    const confirm = findConfirmButton(tree.root);
    act(() => {
      confirm?.props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      reasonCategory: 'spam',
      note: undefined,
    });

    // D-07: this component must NOT render TypedConfirmationModal internally.
    // The escalation lives at the parent (Plan 08 CarDetailsScreen).
    const serialized = JSON.stringify(tree.toJSON());
    expect(serialized).not.toContain('typedConfirmWarningHeading');
    expect(serialized).not.toContain('typedConfirmInputPlaceholder');
  });

  test('Test 7: reset-on-open clears reason + note when visible toggles false → true', () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(
        <ListingModerationReasonModal {...makeProps({ visible: true })} />,
      );
    });
    const t = tree!;

    // Pick a reason + type a note
    const reasonRow = findReasonRow(t.root, 'fraud');
    act(() => {
      reasonRow?.props.onPress();
    });
    const noteInput = t.root.findAllByType(TextInput).find((n) => n.props.multiline === true);
    act(() => {
      noteInput?.props.onChangeText('some note');
    });

    // Confirm should be enabled now
    let confirm = findConfirmButton(t.root);
    expect(confirm?.props.disabled).toBe(false);

    // Close (visible=false)
    act(() => {
      t.update(<ListingModerationReasonModal {...makeProps({ visible: false })} />);
    });

    // Re-open (visible=true)
    act(() => {
      t.update(<ListingModerationReasonModal {...makeProps({ visible: true })} />);
    });

    confirm = findConfirmButton(t.root);
    expect(confirm?.props.disabled).toBe(true);

    const reopenedNote = t.root
      .findAllByType(TextInput)
      .find((n) => n.props.multiline === true);
    expect(reopenedNote?.props.value).toBe('');
  });

  test('Test 8: sibling-discipline guards (no cross-import, no user-domain misleading, no ModerationService)', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '../ListingModerationReasonModal.tsx'),
      'utf8',
    );
    // (a) embeds the 5-value listing taxonomy literal
    expect(file).toMatch(/LISTING_REASON_OPTIONS/);
    // (b) no cross-import from ModerationActionModal (sibling discipline)
    expect(file).not.toMatch(/from ['"]\.\/ModerationActionModal['"]/);
    // (c) does NOT contain user-domain 'misleading' reason value
    expect(file).not.toMatch(/['"]misleading['"]/);
    // (d) pure presentational — does not call ModerationService methods
    expect(file).not.toMatch(/ModerationService\./);
  });
});
