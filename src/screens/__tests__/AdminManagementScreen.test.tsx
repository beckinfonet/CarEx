import React from 'react';
import { AdminManagementScreen } from '../AdminManagementScreen';

jest.mock('../../services/moderation/ModerationService');
jest.mock('../../services/AuthService');
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { localId: 'admin-1', email: 'admin@x.com' }, isAdmin: true, refreshUser: jest.fn(), refreshUserForced: jest.fn() }),
}));
jest.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, k) => String(k) }) }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

describe('AdminManagementScreen — moderation surface', () => {
  test.todo('fetches users via ModerationService.searchUsers on mount');
  test.todo('switches data source between "All users" and "Admins only" when chip is tapped');
  test.todo('renders SeverityBadge per user row');
  test.todo('opens QuickActionSheet when MoreVertical icon is tapped');
  test.todo('navigates to AdminUserDetail with targetUid when row body is tapped');
  test.todo('optimistically flips row badge on suspend Confirm BEFORE the API call resolves');
  test.todo('rolls back row badge to prior state on ModerationError, shows Alert with mapped translation key');
  test.todo('calls refreshUserForced after successfully editing the admin\'s OWN row');
  test.todo('passes correct SuspendBody { severity, reasonCategory, note? } to ModerationService.suspend');
  test.todo('passes the explicit role from QuickActionSheet to ModerationService.deleteProviderProfile (no silent broker default)');
});
