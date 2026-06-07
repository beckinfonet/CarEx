import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import {
  NotificationBadge,
  formatBadgeCount,
} from '../NotificationBadge';

/**
 * Phase 12 Plan 12-08 Task 1 — NotificationBadge contract (NCEN-01 / CTX D-07).
 *
 * Locks the two load-bearing behaviors:
 *   1. The count bubble caps at "9+" for counts >= 10 (exact number for 1-9).
 *   2. Both modes render NOTHING at unreadCount === 0 (no stray dot/bubble in
 *      the BottomBar / MoreMenu chrome).
 */

function render(node: React.ReactElement) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(node);
  });
  // @ts-ignore — assigned in act
  return tree;
}

describe('formatBadgeCount', () => {
  it('shows the exact number for 1-9', () => {
    expect(formatBadgeCount(1)).toBe('1');
    expect(formatBadgeCount(9)).toBe('9');
  });

  it('caps at "9+" for 10 or more', () => {
    expect(formatBadgeCount(10)).toBe('9+');
    expect(formatBadgeCount(42)).toBe('9+');
    expect(formatBadgeCount(999)).toBe('9+');
  });
});

describe('NotificationBadge — count mode', () => {
  it('renders the exact number for 1-9', () => {
    const tree = render(<NotificationBadge count={3} mode="count" />);
    const texts = tree.root.findAllByType(Text);
    expect(texts.map((t) => t.props.children)).toContain('3');
  });

  it('caps the displayed count at "9+" for counts >= 10', () => {
    const tree = render(<NotificationBadge count={25} mode="count" />);
    const texts = tree.root.findAllByType(Text);
    expect(texts.map((t) => t.props.children)).toContain('9+');
    expect(texts.map((t) => t.props.children)).not.toContain('25');
  });

  it('renders nothing when count === 0', () => {
    const tree = render(<NotificationBadge count={0} mode="count" />);
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('NotificationBadge — dot mode', () => {
  it('renders a dot view when count > 0', () => {
    const tree = render(<NotificationBadge count={1} mode="dot" />);
    // A single View (the dot) with no text content.
    expect(tree.root.findAllByType(View).length).toBeGreaterThanOrEqual(1);
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders nothing (dot hidden) when count === 0', () => {
    const tree = render(<NotificationBadge count={0} mode="dot" />);
    expect(tree.toJSON()).toBeNull();
  });
});
