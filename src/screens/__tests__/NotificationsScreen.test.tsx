import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { BellOff } from 'lucide-react-native';

/**
 * Phase 12 Plan 12-08 Task 2 — NotificationsScreen behavior contract
 * (NCEN-02/03/04/05, NPRF-07, Success Criterion #1).
 *
 * Proves the tap→markRead→deeplink-routing resolver for BOTH families:
 *   - WATCH   (carex://listing/:carId)   → markRead THEN navigate('CarDetails')
 *   - NEW_MATCH (carex://search?<crit>)  → markRead THEN navigate('SearchResults',
 *                                          { initialFilters: parsed })  ← lands on
 *                                          FILTERED RESULTS, not a single car.
 * Plus: markRead is called BEFORE navigate; an empty feed renders the BellOff
 * onboarding empty state.
 */

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockRefresh = jest.fn();
const mockLoadMore = jest.fn();

let mockFeed: any[] = [];
let mockUnreadCount = 0;
jest.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    feed: mockFeed,
    loading: false,
    unreadCount: mockUnreadCount,
    refresh: mockRefresh,
    loadMore: mockLoadMore,
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
  }),
}));

import NotificationsScreen from '../NotificationsScreen';
import { NotificationFeedItem } from '../../components/notifications/NotificationFeedItem';

const WATCH_ROW = {
  _id: 'n-watch-1',
  uid: 'u-1',
  kind: 'watch' as const,
  event: 'price_drop' as const,
  read: false,
  data: { deeplink: 'carex://listing/abc123' },
  createdAt: '2026-06-06T10:00:00.000Z',
};

const NEW_MATCH_ROW = {
  _id: 'n-match-1',
  uid: 'u-1',
  kind: 'saved_search' as const,
  read: false,
  data: { deeplink: 'carex://search?makeId=AAA&modelId=BBB&priceMax=15000' },
  createdAt: '2026-06-06T11:00:00.000Z',
};

function render() {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NotificationsScreen />);
  });
  // @ts-ignore — assigned in act
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFeed = [];
  mockUnreadCount = 0;
});

describe('NotificationsScreen — tap routing', () => {
  it('a WATCH tap marks read THEN navigates to CarDetails with the carId', () => {
    mockFeed = [WATCH_ROW];
    mockUnreadCount = 1;
    const tree = render();

    const item = tree.root.findByType(NotificationFeedItem);
    act(() => {
      item.props.onPress(WATCH_ROW);
    });

    expect(mockMarkRead).toHaveBeenCalledWith('n-watch-1');
    expect(mockNavigate).toHaveBeenCalledWith('CarDetails', { carId: 'abc123' });
  });

  it('a NEW_MATCH tap marks read THEN navigates to SearchResults with parsed filters', () => {
    mockFeed = [NEW_MATCH_ROW];
    mockUnreadCount = 1;
    const tree = render();

    const item = tree.root.findByType(NotificationFeedItem);
    act(() => {
      item.props.onPress(NEW_MATCH_ROW);
    });

    expect(mockMarkRead).toHaveBeenCalledWith('n-match-1');
    expect(mockNavigate).toHaveBeenCalledWith('SearchResults', {
      initialQuery: '',
      initialFilters: { makeId: 'AAA', modelId: 'BBB', priceMax: 15000 },
    });
    // Lands on filtered results, NOT a single car (Success Criterion #1).
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'CarDetails',
      expect.anything(),
    );
  });

  it('calls markRead BEFORE navigate on tap (NCEN-04)', () => {
    mockFeed = [WATCH_ROW];
    mockUnreadCount = 1;
    const callOrder: string[] = [];
    mockMarkRead.mockImplementation(() => callOrder.push('markRead'));
    mockNavigate.mockImplementation(() => callOrder.push('navigate'));

    const tree = render();
    const item = tree.root.findByType(NotificationFeedItem);
    act(() => {
      item.props.onPress(WATCH_ROW);
    });

    expect(callOrder).toEqual(['markRead', 'navigate']);
  });
});

describe('NotificationsScreen — empty state', () => {
  it('renders the BellOff onboarding empty state when the feed is empty (NCEN-05)', () => {
    mockFeed = [];
    const tree = render();

    expect(tree.root.findAllByType(BellOff).length).toBeGreaterThanOrEqual(1);
    expect(tree.root.findAllByType(NotificationFeedItem)).toHaveLength(0);
  });
});
