/**
 * Phase 12 — NotificationFeedItem rendered-copy contract (CR-01 gap-closure).
 *
 * The backend writes rows carrying bare-event `titleKey`/`bodyKey`
 * (new_match / price_drop / booked / sold / back_available) plus interpolation
 * `params` ({makeModel}/{price}/{oldPrice}/{newPrice}) and NO literal title/body
 * (notificationService.js:200-205). This proves the feed item maps those keys to
 * the mobile `notif_<key>_title/body` strings and interpolates params, instead of
 * collapsing every row to the generic "Notifications" header with an empty body.
 *
 * Uses the REAL translations object (not a Proxy) so the key→string mapping is
 * exercised end-to-end.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { NotificationFeedItem } from '../NotificationFeedItem';
import { TRANSLATIONS } from '../../../constants/translations';

const t = (TRANSLATIONS as any).RU;

function renderRow(notification: any) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <NotificationFeedItem notification={notification} onPress={() => {}} t={t} />,
    );
  });
  const texts = tree.root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .filter((c) => typeof c === 'string') as string[];
  return texts;
}

describe('NotificationFeedItem — CR-01 localized + interpolated copy', () => {
  it('renders a new_match row with makeModel + price interpolated', () => {
    const texts = renderRow({
      _id: 'n1',
      uid: 'u1',
      kind: 'saved_search',
      titleKey: 'new_match',
      bodyKey: 'new_match',
      params: { makeModel: 'BMW X5', price: 1500000 },
      read: false,
      createdAt: '2026-06-06T10:00:00.000Z',
    });
    expect(texts).toContain(t.notif_new_match_title);
    const body = texts.find((s) => s.includes('BMW X5'));
    expect(body).toBeDefined();
    expect(body).toContain('1500000');
    // No unresolved interpolation tokens leak to the UI.
    expect(body).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('renders a price_drop row with oldPrice → newPrice interpolated', () => {
    const texts = renderRow({
      _id: 'n2',
      uid: 'u1',
      kind: 'watch',
      event: 'price_drop',
      titleKey: 'price_drop',
      bodyKey: 'price_drop',
      params: { makeModel: 'Audi Q5', oldPrice: 2000000, newPrice: 1800000 },
      read: false,
      createdAt: '2026-06-06T10:00:00.000Z',
    });
    expect(texts).toContain(t.notif_price_drop_title);
    const body = texts.find((s) => s.includes('Audi Q5'));
    expect(body).toBeDefined();
    expect(body).toContain('1800000');
    expect(body).toContain('2000000');
    expect(body).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('falls back to the generic header (never blank) for an unknown key', () => {
    const texts = renderRow({
      _id: 'n3',
      uid: 'u1',
      kind: 'watch',
      titleKey: 'totally_unknown',
      bodyKey: 'totally_unknown',
      params: {},
      read: false,
      createdAt: '2026-06-06T10:00:00.000Z',
    });
    expect(texts).toContain(t.notifications);
  });
});
