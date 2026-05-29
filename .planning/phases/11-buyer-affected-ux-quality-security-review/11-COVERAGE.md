# Phase 11 LQUAL-02 — Per-requirement coverage manifest

Generated: 2026-05-29T18:19:01Z
Convention: every `describe('LXXX-NN: …')` block tags its covering requirement.

| Requirement | Test file(s) |
|-------------|--------------|
| LADM-01 | ../backend-services/carEx-services/__tests__/listing-moderation/editListing.test.js |
| LADM-02 | ../backend-services/carEx-services/__tests__/listing-moderation/suspendListing.test.js |
| LADM-03 | ../backend-services/carEx-services/__tests__/listing-moderation/archiveListing.test.js |
| LADM-04 | ../backend-services/carEx-services/__tests__/listing-moderation/deleteListing.test.js |
| LADM-05 | ../backend-services/carEx-services/__tests__/listing-moderation/restoreListing.test.js |
| LBUY-01 | src/components/moderation/__tests__/ListingStatusBanner.test.tsx, src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx |
| LBUY-02 | src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx |
| LBUY-03 | __tests__/lbuy03-no-auto-cancel.test.ts |
| LBUY-04 | src/components/moderation/__tests__/ListingStatusBanner.test.tsx, src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx |
| LDATA-01 | ../backend-services/carEx-services/__tests__/listing-moderation/listingCapabilities.test.js, ../backend-services/carEx-services/__tests__/listing-moderation/Car.status-field.test.js |
| LDATA-02 | ../backend-services/carEx-services/__tests__/listing-moderation/Car.status-field.test.js |
| LDATA-03 | ../backend-services/carEx-services/__tests__/listing-moderation/ListingModerationAction.append-only.test.js |
| LDATA-04 | ../backend-services/carEx-services/__tests__/listing-moderation/migrate-listing-moderation.test.js |
| LENF-01 | ../backend-services/carEx-services/__tests__/listing-enforcement/hideOnFind.listingStatus.test.js |
| LENF-02 | ../backend-services/carEx-services/__tests__/listing-enforcement/listingDetailStatusAware.test.js |
| LENF-03 | ../backend-services/carEx-services/__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js, ../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js |
| LMOB-01 | src/services/moderation/__tests__/listingMethods.test.ts |
| LMOB-02 | src/services/http/__tests__/clientListing409.test.ts |
| LQUAL-01 | __tests__/translation-parity.test.ts, __tests__/moderation-literals.test.ts |
| LQUAL-02 | __tests__/coverage-manifest.audit.test.ts |
| LQUAL-03 | __tests__/list-security-review.audit.test.ts |
| LSEC-01 | ../backend-services/carEx-services/__tests__/listing-moderation/requireAdmin.listing.middleware.test.js |
| LSEC-02 | ../backend-services/carEx-services/__tests__/listing-moderation/requireAdmin.listing.middleware.test.js |
| LSEC-03 | ../backend-services/carEx-services/__tests__/listing-moderation/listingModerationRateLimiter.test.js |
| LUI-01 | src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx |
| LUI-02 | src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx |
| LUI-03 | src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx |
| LUI-04 | src/screens/__tests__/AdminModerationScreen.tabs.test.tsx |

## Coverage check

All LIST-* requirements covered.
