import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SeverityBadge } from '../SeverityBadge';
import { COLORS } from '../../../constants/theme';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      stateFilterActive: 'Active',
      stateFilterFeatureLimited: 'Limited',
      stateFilterBlocked: 'Blocked',
      stateFilterBanned: 'Banned',
    },
  }),
}));

type State =
  | 'active'
  | 'feature_limited'
  | 'blocked_with_review'
  | 'permanently_banned';

function render(state: State) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<SeverityBadge state={state} />);
  });
  return tree!;
}

function findText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (n) =>
      n.type === Text && JSON.stringify(n.props.children).includes(text),
  );
}

describe('SeverityBadge', () => {
  test('renders the active label with moderation.active palette', () => {
    const tree = render('active');
    const labels = findText(tree.root, 'Active');
    expect(labels.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(tree.toJSON());
    expect(serialized).toContain(COLORS.moderation.active.fg);
  });

  test('renders the feature_limited label with moderation.featureLimited palette', () => {
    const tree = render('feature_limited');
    expect(findText(tree.root, 'Limited').length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain(
      COLORS.moderation.featureLimited.fg,
    );
  });

  test('renders the blocked_with_review label with moderation.blockedReview palette', () => {
    const tree = render('blocked_with_review');
    expect(findText(tree.root, 'Blocked').length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain(
      COLORS.moderation.blockedReview.fg,
    );
  });

  test('renders the permanently_banned label with moderation.permaBanned palette', () => {
    const tree = render('permanently_banned');
    expect(findText(tree.root, 'Banned').length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain(
      COLORS.moderation.permaBanned.fg,
    );
  });

  test('exposes accessibilityRole="text" with localized label', () => {
    const tree = render('active');
    const accessible = tree.root.findAll(
      (n) => n.props?.accessibilityRole === 'text',
    );
    expect(accessible.length).toBeGreaterThan(0);
    expect(accessible[0].props.accessibilityLabel).toBe('Active');
  });
});
