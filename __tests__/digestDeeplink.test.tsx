/**
 * @format
 *
 * Plan 14-05 (NDIG-03 / D-03): the daily-digest push sets data.deeplink to
 * carex://notifications (Plan 03 backend). This unit test proves the MOBILE
 * consumer — App.tsx routeDeeplink — routes that deeplink to the in-app
 * Notification Center, while leaving the two pre-existing whitelist routes
 * (listing/:carId, search?...) unchanged and still dropping unknown paths
 * (T-14-05-01 whitelist-closed invariant).
 *
 * The test imports the exported routeDeeplink + navigationRef from App.tsx and
 * stubs navigationRef.isReady()/navigate() — no real device or navigation tree.
 * All native modules (incl. @react-native-firebase/messaging) are stubbed
 * globally in jest.setup.js.
 */

import { routeDeeplink, navigationRef } from '../App';

describe('routeDeeplink — digest notifications route (NDIG-03 / D-03)', () => {
  let navigateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    navigateSpy = jest
      .spyOn(navigationRef, 'navigate')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes carex://notifications to the Notifications screen (no params)', () => {
    routeDeeplink('carex://notifications');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('Notifications');
  });

  it('routes the https form (/notifications) to the Notifications screen', () => {
    routeDeeplink('https://www.carexmarket.com/notifications');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('Notifications');
  });

  it('routes a trailing-slash notifications path defensively', () => {
    routeDeeplink('carex://notifications/');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('Notifications');
  });

  it('still routes carex://listing/abc to CarDetails (unchanged)', () => {
    routeDeeplink('carex://listing/abc');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('CarDetails', { carId: 'abc' });
  });

  it('still routes carex://search?make filters to SearchResults (unchanged)', () => {
    routeDeeplink('carex://search?makeId=BMW&priceMax=20000');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('SearchResults', {
      initialQuery: '',
      initialFilters: { makeId: 'BMW', priceMax: 20000 },
    });
  });

  it('still ignores an unknown path (whitelist stays closed — T-14-05-01)', () => {
    routeDeeplink('carex://unknownroute');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
