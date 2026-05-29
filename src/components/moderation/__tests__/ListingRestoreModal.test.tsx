import React from 'react';
import fs from 'fs';
import path from 'path';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import { ListingRestoreModal } from '../ListingRestoreModal';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_target: unknown, k: string) => String(k) }) }),
}));

function makeProps(
  overrides: Partial<React.ComponentProps<typeof ListingRestoreModal>> = {},
) {
  return {
    visible: true,
    carId: 'car-1',
    submitting: false,
    onSubmit: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

function render(
  props: Partial<React.ComponentProps<typeof ListingRestoreModal>> = {},
) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<ListingRestoreModal {...makeProps(props)} />);
  });
  return tree!;
}

function findConfirmButton(root: TestRenderer.ReactTestInstance) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.testID === 'listing-restore-confirm');
}

function findCancelButton(root: TestRenderer.ReactTestInstance) {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.testID === 'listing-restore-cancel');
}

describe('ListingRestoreModal', () => {
  test('Test 1: header copy renders listingRestoreHeader key', () => {
    const tree = render();
    expect(JSON.stringify(tree.toJSON())).toContain('listingRestoreHeader');
  });

  test('Test 2: note-only — exactly one multiline TextInput, zero reason rows, Confirm always enabled', () => {
    const tree = render();
    const inputs = tree.root.findAllByType(TextInput);
    const multilineInputs = inputs.filter((n) => n.props.multiline === true);
    expect(multilineInputs).toHaveLength(1);

    // No reason category rows anywhere
    const reasonRows = tree.root
      .findAllByType(TouchableOpacity)
      .filter((n) => typeof n.props.testID === 'string'
        && (n.props.testID as string).startsWith('listing-reason-'));
    expect(reasonRows).toHaveLength(0);

    // Confirm enabled at all times (no required field)
    const confirm = findConfirmButton(tree.root);
    expect(confirm?.props.disabled).toBe(false);
  });

  test('Test 3: typing a note + Confirm emits onSubmit({ note })', () => {
    const onSubmit = jest.fn();
    const tree = render({ onSubmit });
    const noteInput = tree.root
      .findAllByType(TextInput)
      .find((n) => n.props.multiline === true);
    act(() => {
      noteInput?.props.onChangeText('approved on appeal');
    });
    const confirm = findConfirmButton(tree.root);
    act(() => {
      confirm?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith({ note: 'approved on appeal' });
  });

  test('Test 4: Confirm with empty note emits onSubmit({}) (no "note" key)', () => {
    const onSubmit = jest.fn();
    const tree = render({ onSubmit });
    const confirm = findConfirmButton(tree.root);
    act(() => {
      confirm?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith({});
    // Be explicit that the 'note' key is omitted, not present-with-undefined
    const callArg = onSubmit.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(callArg, 'note')).toBe(false);
  });

  test('Test 5: textarea maxLength is exactly 2000 (matches restoreListingSchema cap)', () => {
    const tree = render();
    const noteInput = tree.root
      .findAllByType(TextInput)
      .find((n) => n.props.multiline === true);
    expect(noteInput?.props.maxLength).toBe(2000);
  });

  test('Test 6: reset-on-open clears note when visible toggles false → true', () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(
        <ListingRestoreModal {...makeProps({ visible: true })} />,
      );
    });
    const t = tree!;

    const noteInput = t.root
      .findAllByType(TextInput)
      .find((n) => n.props.multiline === true);
    act(() => {
      noteInput?.props.onChangeText('typed something');
    });

    act(() => {
      t.update(<ListingRestoreModal {...makeProps({ visible: false })} />);
    });
    act(() => {
      t.update(<ListingRestoreModal {...makeProps({ visible: true })} />);
    });

    const reopenedNote = t.root
      .findAllByType(TextInput)
      .find((n) => n.props.multiline === true);
    expect(reopenedNote?.props.value).toBe('');
  });

  test('Test 7: Cancel button fires onClose; inner sheet press does NOT bubble', () => {
    const onClose = jest.fn();
    const tree = render({ onClose });

    const cancel = findCancelButton(tree.root);
    act(() => {
      cancel?.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Sibling-discipline + D-06 guards (note-only modal)
    const file = fs.readFileSync(
      path.resolve(__dirname, '../ListingRestoreModal.tsx'),
      'utf8',
    );
    // No reasonCategory anywhere (D-06 + D-C symmetry)
    expect(file).not.toMatch(/reasonCategory/);
    // maxLength={2000} present exactly once
    expect((file.match(/maxLength={2000}/g) ?? []).length).toBe(1);
  });
});
