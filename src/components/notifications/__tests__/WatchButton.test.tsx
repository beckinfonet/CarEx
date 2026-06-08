/**
 * Phase 12 Plan 12-09 Task 1 — WatchButton contract (NCEN-06 / NSUB-02/03/04 /
 * CTX D-01..D-04). Fills the Wave-0 scaffold (12-02).
 *
 * Three load-bearing contracts are locked here:
 *   D-01  — sibling discipline: a labeled Bell pill, NOT a Heart/favorite
 *           variant (no Heart icon import in the component source).
 *   D-03  — one tap creates a Watch subscription opting into all FOUR events
 *           (price_drop / booked / sold / back_available) at instant cadence.
 *   D-04 / NSUB-04 — the subscription key resolves as
 *           `car._id || car.id || carId` and NEVER bare `car.id`. The
 *           undefined-car._id case is asserted to prove the fallback order.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Bell } from 'lucide-react-native';

import WatchButton, { WATCH_EVENTS } from '../WatchButton';
import { NotificationService } from '../../../services/notifications/NotificationService';

// Mock the language context so the pill renders its labels without a provider.
jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: { watchCta: 'Watch', watchCtaActive: 'Watching' } }),
}));

// Mock the service — createSubscription is the conversion call under test;
// listSubscriptions/deleteSubscription back the mount-hydration dedup contract.
jest.mock('../../../services/notifications/NotificationService', () => ({
  NotificationService: {
    createSubscription: jest.fn().mockResolvedValue({ _id: 'sub_1' }),
    listSubscriptions: jest.fn().mockResolvedValue([]),
    deleteSubscription: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

// Mock the auth context — default to a logged-in user so the mount-hydration
// effect runs. `mockUser` is mutated per-test to cover the logged-out guard.
let mockUser: { localId: string } | null = { localId: 'uid_test' };
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const createSubscriptionMock =
  NotificationService.createSubscription as jest.Mock;
const listSubscriptionsMock =
  NotificationService.listSubscriptions as jest.Mock;

function render(node: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(node);
  });
  return tree;
}

async function press(tree: TestRenderer.ReactTestRenderer) {
  const btn = tree.root.findByProps({ testID: 'watch-button' });
  await act(async () => {
    btn.props.onPress();
  });
}

// Mount async helper — flushes the listSubscriptions hydration effect so the
// active-state assertion sees the resolved subscription.
async function renderAsync(node: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(node);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

beforeEach(() => {
  mockUser = { localId: 'uid_test' };
  createSubscriptionMock.mockClear();
  createSubscriptionMock.mockResolvedValue({ _id: 'sub_1' });
  listSubscriptionsMock.mockClear();
  listSubscriptionsMock.mockResolvedValue([]);
});

describe('WatchButton — D-01 sibling discipline (Bell, not Heart)', () => {
  it('renders a labeled Bell pill (the Watch affordance), not a Heart/favorite variant', () => {
    const tree = render(<WatchButton car={{ _id: 'car_a' }} carId="car_a" />);
    // The Bell icon is present (the Watch icon, distinct from the favorite Heart).
    expect(tree.root.findAllByType(Bell).length).toBeGreaterThanOrEqual(1);
    // It is a LABELED pill — the inactive label text renders.
    const labels = tree.root
      .findAllByType('Text' as any)
      .map((n) => n.props.children);
    expect(labels).toContain('Watch');
  });

  it('the component source imports Bell and never imports Heart (D-01)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'WatchButton.tsx'),
      'utf8',
    );
    expect(src).toMatch(/\bBell\b/);
    // No Heart import from the icon library (sibling discipline — Watch is its
    // own component, not a favorite Heart variant). Comments may mention "Heart"
    // to document the discipline; what matters is the icon is never imported.
    expect(src).not.toMatch(/import\s*\{[^}]*\bHeart\b[^}]*\}\s*from\s*['"]lucide-react-native['"]/);
  });
});

describe('WatchButton — D-03 one tap, all four events, instant', () => {
  it('one tap creates a watch subscription with all 4 events at instant cadence', async () => {
    const tree = render(<WatchButton car={{ _id: 'car_a' }} carId="car_a" />);
    await press(tree);

    expect(createSubscriptionMock).toHaveBeenCalledTimes(1);
    const body = createSubscriptionMock.mock.calls[0][0];
    expect(body.kind).toBe('watch');
    expect(body.cadence).toBe('instant');
    expect(body.events).toHaveLength(4);
    expect(body.events).toEqual(
      expect.arrayContaining(['price_drop', 'booked', 'sold', 'back_available']),
    );
    // The exported constant is the canonical four-event set.
    expect(WATCH_EVENTS).toHaveLength(4);
  });

  it('flips to the active "Watching" state after a successful watch', async () => {
    const tree = render(<WatchButton car={{ _id: 'car_a' }} carId="car_a" />);
    await press(tree);
    const labels = tree.root
      .findAllByType('Text' as any)
      .map((n) => n.props.children);
    expect(labels).toContain('Watching');
  });
});

describe('WatchButton — WR-03 mount hydration (no duplicate POST on remount)', () => {
  it('hydrates the active state from an existing watch subscription and does NOT re-POST on tap', async () => {
    listSubscriptionsMock.mockResolvedValue([
      {
        _id: 'sub_existing',
        kind: 'watch',
        carId: 'car_a',
        active: true,
        cadence: 'instant',
      },
    ]);

    const tree = await renderAsync(
      <WatchButton car={{ _id: 'car_a' }} carId="car_a" />,
    );

    // The mount hydration queried existing subscriptions...
    expect(listSubscriptionsMock).toHaveBeenCalledTimes(1);

    // ...found the active watch for this car → renders the active label.
    const labels = tree.root
      .findAllByType('Text' as any)
      .map((n) => n.props.children);
    expect(labels).toContain('Watching');

    // Tapping an already-watched car must NOT create a duplicate subscription.
    await press(tree);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
  });

  it('skips hydration (no listSubscriptions call) when logged out', async () => {
    mockUser = null;
    await renderAsync(<WatchButton car={{ _id: 'car_a' }} carId="car_a" />);
    // Logged-out: the mount effect early-returns, so the 401-prone
    // listSubscriptions request never fires (no noisy hydrate error).
    expect(listSubscriptionsMock).not.toHaveBeenCalled();
  });
});

describe('WatchButton — D-04 / NSUB-04 watch-key fallback (car._id || car.id || carId)', () => {
  it('uses car._id when present', async () => {
    const tree = render(
      <WatchButton car={{ _id: 'mongo_id', id: 'legacy_id' }} carId="route_id" />,
    );
    await press(tree);
    expect(createSubscriptionMock.mock.calls[0][0].carId).toBe('mongo_id');
  });

  it('falls back to car.id when car._id is undefined', async () => {
    const tree = render(
      <WatchButton car={{ _id: undefined, id: 'legacy_id' }} carId="route_id" />,
    );
    await press(tree);
    expect(createSubscriptionMock.mock.calls[0][0].carId).toBe('legacy_id');
  });

  it('falls back to carId when BOTH car._id and car.id are undefined (never bare car.id)', async () => {
    const tree = render(
      <WatchButton car={{ _id: undefined, id: undefined }} carId="route_id" />,
    );
    await press(tree);
    expect(createSubscriptionMock.mock.calls[0][0].carId).toBe('route_id');
  });

  it('the component source spells the fallback `car._id || car.id || carId` (grep-visible contract)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'WatchButton.tsx'),
      'utf8',
    );
    expect(src).toMatch(/car\?\._id \|\| car\?\.id \|\| carId|car\._id \|\| car\.id \|\| carId/);
  });
});
