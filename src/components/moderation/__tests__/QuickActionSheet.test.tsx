import React from 'react';
import { QuickActionSheet } from '../QuickActionSheet';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: {
    actionSuspend: 'Suspend', actionUnsuspend: 'Unsuspend', actionRevokeRole: 'Revoke role',
    actionEditProfile: 'Edit profile', actionDeleteProfile: 'Delete profile',
    deleteBrokerProfile: 'Delete broker profile', deleteLogisticsProfile: 'Delete logistics profile',
    cancel: 'Cancel',
  } }),
}));

describe('QuickActionSheet', () => {
  test.todo('renders all 5 action rows when target user is active and has a single provider role');
  test.todo('disables Unsuspend when target.moderationStatus.state === active');
  test.todo('disables Suspend when target is already suspended (state !== active)');
  test.todo('disables Edit profile + Delete profile when target has NO broker/logistics role');
  test.todo('enables Revoke role when target has any of seller/broker/logistics APPROVED');
  test.todo('renders exactly 2 delete rows (broker + logistics) when target has BOTH brokerStatus===APPROVED AND logisticsStatus===APPROVED');
  test.todo('renders exactly 1 delete row when target has only brokerStatus===APPROVED, emitting onSelect with action=delete_profile and role=broker');
  test.todo('renders exactly 1 delete row when target has only logisticsStatus===APPROVED, emitting onSelect with action=delete_profile and role=logistics');
  test.todo('fires onSelect("suspend") when Suspend row is tapped');
  test.todo('fires onClose when overlay is tapped');
  test.todo('fires onClose when Cancel is tapped');
});
