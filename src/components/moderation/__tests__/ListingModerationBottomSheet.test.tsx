// Phase 10 Plan 06 — Wave 0 RED tests for ListingModerationBottomSheet.
//
// Sibling (NOT generalization) of QuickActionSheet per D-04/S7. This file
// contracts the visual + interaction shape of the new component before it
// exists, so the component must satisfy ALL five blocks (A-E) below to pass.
//
// Block A — active branch: 4 action rows (LUI-01/02)
// Block B — visual distinction: each row's icon glyph + color (LUI-02)
// Block C — restore branch: single Restore row + reason chip + "moderated at"
//           pill (LUI-03)
// Block D — close behavior: overlay tap closes, inner sheet tap does not
// Block E — sibling-discipline guard: source file does NOT import
//           ModerationService / useAuth and does NOT inline-concat car parts

import React from 'react';
import fs from 'fs';
import path from 'path';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { Pencil, Shield, Archive, Trash2 } from 'lucide-react-native';
import { COLORS } from '../../../constants/theme';
import {
  ListingModerationBottomSheet,
  ListingModerationAction,
} from '../ListingModerationBottomSheet';

// Stable Proxy mock — when a key is not explicitly declared we return the key
// name itself, so `t.listingActionSuspend` resolves to the string
// 'listingActionSuspend'. Phase 11 LQUAL-01 audits real RU/EN parity later.
// Proxy returns ANY string member; runtime substring matchers cope.
jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: new Proxy({}, { get: (_target: unknown, k: string) => String(k) }),
  }),
}));

type Props = React.ComponentProps<typeof ListingModerationBottomSheet>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    visible: true,
    listingTitle: '2018 Toyota Camry',
    moderationBadge: undefined,
    onSelect: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

function render(propOverrides: Partial<Props> = {}) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(
      <ListingModerationBottomSheet {...makeProps(propOverrides)} />,
    );
  });
  return tree!;
}

function findRow(
  root: TestRenderer.ReactTestInstance,
  testID: string,
): TestRenderer.ReactTestInstance | undefined {
  return root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.testID === testID);
}

describe('ListingModerationBottomSheet', () => {
  // -------------------------------------------------------------------------
  // BLOCK A — active branch (no moderationBadge): 4 action rows render
  // -------------------------------------------------------------------------
  describe('Block A — active branch (LUI-01 / LUI-02)', () => {
    test('renders all 4 action rows when moderationBadge is undefined', () => {
      const tree = render({ moderationBadge: undefined });
      expect(findRow(tree.root, 'listing-action-edit')).toBeDefined();
      expect(findRow(tree.root, 'listing-action-suspend')).toBeDefined();
      expect(findRow(tree.root, 'listing-action-archive')).toBeDefined();
      expect(findRow(tree.root, 'listing-action-delete')).toBeDefined();
    });

    test('does NOT render listing-action-restore row in the active branch', () => {
      const tree = render({ moderationBadge: undefined });
      expect(findRow(tree.root, 'listing-action-restore')).toBeUndefined();
    });

    test('does NOT render the reason-category chip in the active branch', () => {
      const tree = render({ moderationBadge: undefined });
      // Reason chip carries testID 'listing-reason-chip' when present (Block C).
      const chip = tree.root
        .findAll((n) => n.props?.testID === 'listing-reason-chip');
      expect(chip).toHaveLength(0);
    });

    test('tapping listing-action-suspend fires onSelect("suspend") exactly once', () => {
      const onSelect = jest.fn();
      const tree = render({ onSelect });
      act(() => {
        findRow(tree.root, 'listing-action-suspend')?.props.onPress();
      });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('suspend');
    });

    test('tapping listing-action-edit fires onSelect("edit") exactly once', () => {
      const onSelect = jest.fn();
      const tree = render({ onSelect });
      act(() => {
        findRow(tree.root, 'listing-action-edit')?.props.onPress();
      });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('edit');
    });

    test('renders the listingTitle prop verbatim in the header', () => {
      const tree = render({ listingTitle: '2018 Toyota Camry' });
      expect(JSON.stringify(tree.toJSON())).toContain('2018 Toyota Camry');
    });
  });

  // -------------------------------------------------------------------------
  // BLOCK B — visual distinction (LUI-02): icon glyph + color per row
  // -------------------------------------------------------------------------
  describe('Block B — visual distinction (LUI-02)', () => {
    test('Edit row uses Pencil glyph in COLORS.accent', () => {
      const tree = render({ moderationBadge: undefined });
      const row = findRow(tree.root, 'listing-action-edit');
      const icons = row?.findAllByType(Pencil) ?? [];
      expect(icons).toHaveLength(1);
      expect(icons[0]!.props.color).toBe(COLORS.accent);
    });

    test('Suspend row uses Shield glyph in COLORS.warning', () => {
      const tree = render({ moderationBadge: undefined });
      const row = findRow(tree.root, 'listing-action-suspend');
      const icons = row?.findAllByType(Shield) ?? [];
      expect(icons).toHaveLength(1);
      expect(icons[0]!.props.color).toBe(COLORS.warning);
    });

    test('Archive row uses Archive glyph in COLORS.textSecondary', () => {
      const tree = render({ moderationBadge: undefined });
      const row = findRow(tree.root, 'listing-action-archive');
      const icons = row?.findAllByType(Archive) ?? [];
      expect(icons).toHaveLength(1);
      expect(icons[0]!.props.color).toBe(COLORS.textSecondary);
    });

    test('Delete row uses Trash2 glyph in COLORS.destructive', () => {
      const tree = render({ moderationBadge: undefined });
      const row = findRow(tree.root, 'listing-action-delete');
      const icons = row?.findAllByType(Trash2) ?? [];
      expect(icons).toHaveLength(1);
      expect(icons[0]!.props.color).toBe(COLORS.destructive);
    });
  });

  // -------------------------------------------------------------------------
  // BLOCK C — restore branch (LUI-03): single Restore + chip + "since" pill
  // -------------------------------------------------------------------------
  describe('Block C — restore branch (LUI-03)', () => {
    const suspendedBadge = {
      status: 'suspended' as const,
      reasonCategory: 'spam',
      moderatedAt: '2026-05-29T12:00:00.000Z',
    };

    test('renders listing-action-restore row when moderationBadge is present', () => {
      const tree = render({ moderationBadge: suspendedBadge });
      expect(findRow(tree.root, 'listing-action-restore')).toBeDefined();
    });

    test('does NOT render any of the 4 active-branch action rows', () => {
      const tree = render({ moderationBadge: suspendedBadge });
      expect(findRow(tree.root, 'listing-action-edit')).toBeUndefined();
      expect(findRow(tree.root, 'listing-action-suspend')).toBeUndefined();
      expect(findRow(tree.root, 'listing-action-archive')).toBeUndefined();
      expect(findRow(tree.root, 'listing-action-delete')).toBeUndefined();
    });

    test('renders a reason-category chip containing the reasonCategory text', () => {
      const tree = render({ moderationBadge: suspendedBadge });
      expect(JSON.stringify(tree.toJSON())).toContain('spam');
    });

    test('renders a "moderated at" pill derived from moderationBadge.moderatedAt', () => {
      const tree = render({ moderationBadge: suspendedBadge });
      // Substring match — exact format ('Since 2026-05-29' is Claude's
      // Discretion, but year MUST appear in the rendered pill).
      expect(JSON.stringify(tree.toJSON())).toContain('2026');
    });

    test('tapping listing-action-restore fires onSelect("restore") exactly once', () => {
      const onSelect = jest.fn();
      const tree = render({
        onSelect,
        moderationBadge: suspendedBadge,
      });
      act(() => {
        findRow(tree.root, 'listing-action-restore')?.props.onPress();
      });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('restore');
    });
  });

  // -------------------------------------------------------------------------
  // BLOCK D — close behavior (Pattern S2)
  // -------------------------------------------------------------------------
  describe('Block D — close behavior', () => {
    test('tapping the overlay fires onClose exactly once', () => {
      const onClose = jest.fn();
      const tree = render({ onClose });
      // RN Pressable may not register as the canonical Pressable type in the
      // react-test-renderer tree (varies by RN preset). Find by testID on
      // any node — the overlay carries testID="listing-sheet-overlay".
      const overlay = tree.root.findAll(
        (n) => n.props?.testID === 'listing-sheet-overlay',
      )[0];
      expect(overlay).toBeDefined();
      act(() => {
        overlay?.props.onPress?.();
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('inner sheet wraps content with a no-op onPress to stop overlay bubbling (Pattern S2)', () => {
      // Pattern S2 source-grep: the component's body must contain a no-op
      // `onPress={() => {}}` callback on the inner Pressable so taps inside
      // the sheet do NOT propagate up to the overlay's onClose. This is the
      // canonical RN bubble-stop idiom shipped by QuickActionSheet:63.
      const sourcePath = path.resolve(
        __dirname,
        '..',
        'ListingModerationBottomSheet.tsx',
      );
      const src = fs.readFileSync(sourcePath, 'utf8');
      expect(src).toMatch(/onPress=\{\(\)\s*=>\s*\{\}\}/);
    });

    test('exported ListingModerationAction union shape exists and edit is assignable', () => {
      // Compile-time-only check — bare cast confirms the export resolves.
      const action: ListingModerationAction = 'edit';
      expect(action).toBe('edit');
    });
  });

  // -------------------------------------------------------------------------
  // BLOCK E — sibling-discipline guard (grep the source file)
  // -------------------------------------------------------------------------
  describe('Block E — sibling-discipline guard', () => {
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'ListingModerationBottomSheet.tsx',
    );

    test('source file does NOT import or reference ModerationService', () => {
      const src = fs.readFileSync(sourcePath, 'utf8');
      expect(src).not.toContain('ModerationService');
    });

    test('source file does NOT reference useAuth (parent gates visibility)', () => {
      const src = fs.readFileSync(sourcePath, 'utf8');
      expect(src).not.toContain('useAuth');
    });

    test('source file does NOT inline-concat `${car.year} ${car.makeName} ${car.modelName}` (Pitfall 6)', () => {
      const src = fs.readFileSync(sourcePath, 'utf8');
      // Strict substring match for the canonical Pitfall 6 anti-pattern;
      // parent (Plan 08) calls buildListingTitle and passes the result down
      // as the listingTitle prop.
      expect(src).not.toContain('${car.year}');
      expect(src).not.toContain('car.makeName');
      expect(src).not.toContain('car.modelName');
    });

    test('source file does NOT import or extend QuickActionSheet', () => {
      const src = fs.readFileSync(sourcePath, 'utf8');
      expect(src).not.toContain('QuickActionSheet');
    });
  });
});
