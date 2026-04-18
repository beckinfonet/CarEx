import React from 'react';
import { SeverityBadge } from '../SeverityBadge';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: { stateFilterActive: 'Active', stateFilterFeatureLimited: 'Limited', stateFilterBlocked: 'Blocked', stateFilterBanned: 'Banned' } }),
}));

describe('SeverityBadge', () => {
  test.todo('renders the active label with moderation.active palette');
  test.todo('renders the feature_limited label with moderation.featureLimited palette');
  test.todo('renders the blocked_with_review label with moderation.blockedReview palette');
  test.todo('renders the permanently_banned label with moderation.permaBanned palette');
  test.todo('exposes accessibilityRole="text" with localized label');
});
