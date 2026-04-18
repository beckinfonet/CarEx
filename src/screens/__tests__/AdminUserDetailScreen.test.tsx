import React from 'react';
import { AdminUserDetailScreen } from '../AdminUserDetailScreen';

jest.mock('../../services/moderation/ModerationService');
jest.mock('../../services/AuthService');
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { localId: 'admin-1' }, isAdmin: true }),
}));
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, k) => String(k) }) }),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { targetUid: 'user-7' } }),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

describe('AdminUserDetailScreen', () => {
  test.todo('loads target user + first page of history on mount');
  test.todo('renders history rows in most-recent-first order (createdAt descending)');
  test.todo('renders sticky StickySummaryCard with user email + role badges + SeverityBadge');
  test.todo('shows Unsuspend button only when user.moderationStatus.state !== active');
  test.todo('hides Unsuspend button when user.moderationStatus.state === active');
  test.todo('opens ModerationActionModal in unsuspend mode when Unsuspend button is tapped');
  test.todo('appends a new history row optimistically on successful unsuspend');
  test.todo('does NOT mutate prior history rows on unsuspend (D-15 — history is append-only at the UI)');
  test.todo('updates SeverityBadge to active after successful unsuspend');
  test.todo('paginates history via onEndReached using getHistory({ cursor })');
  test.todo('renders EmptyState when history is empty');
  test.todo('formats timestamps via formatYmdHm (YYYY-MM-DD HH:mm)');
});
