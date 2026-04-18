import React from 'react';
import { AdminModerationScreen } from '../AdminModerationScreen';

jest.mock('../../services/moderation/ModerationService');
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { localId: 'admin-1' }, isAdmin: true }),
}));
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, k) => String(k) }) }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

jest.useFakeTimers();

describe('AdminModerationScreen', () => {
  test.todo('debounces rapid typing — searchUsers fires exactly once 300ms after last keystroke');
  test.todo('cancels in-flight search request when query changes (AbortController.abort called)');
  test.todo('re-queries when role filter chip changes');
  test.todo('re-queries when state filter chip changes');
  test.todo('passes nextCursor to searchUsers when onEndReached fires');
  test.todo('does NOT fire onEndReached fetch when nextCursor is null (pagination guard)');
  test.todo('does NOT fire onEndReached fetch while a previous next-page request is in flight');
  test.todo('renders EmptyState with searchPromptTitle when query is empty and no results');
  test.todo('renders EmptyState with emptySearchTitle when query is non-empty and zero results');
  test.todo('navigates to AdminUserDetail with targetUid when a row is tapped');
  test.todo('passes the explicit role from QuickActionSheet to ModerationService.deleteProviderProfile (no silent broker default)');
});
