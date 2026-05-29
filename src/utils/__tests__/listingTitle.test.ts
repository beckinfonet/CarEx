import { buildListingTitle, matchesListingTitleSentinel } from '../listingTitle';

// Minimal structural type used in tests — decouples from full Car type. Mirrors
// the ListingTitleSource shape from src/utils/listingTitle.ts so that admin
// docs (with denormalized makeName/modelName) AND Phase 9 D-05 thin-payload
// shapes (with makeId/modelId fallbacks) both type-check against the helper.
type TitleSource = {
  year?: number;
  makeName?: string;
  modelName?: string;
  makeId?: string;
  modelId?: string;
};

describe('listingTitle', () => {
  describe('buildListingTitle', () => {
    test('canonical happy path: returns "${year} ${makeName} ${modelName}"', () => {
      const car: TitleSource = { year: 2018, makeName: 'Toyota', modelName: 'Camry' };
      expect(buildListingTitle(car)).toBe('2018 Toyota Camry');
    });

    test('whitespace trim: collapses padded make/model fields without double spaces', () => {
      const car: TitleSource = {
        year: 2018,
        makeName: '  Toyota  ',
        modelName: ' Camry ',
      };
      expect(buildListingTitle(car)).toBe('2018 Toyota Camry');
    });

    test('D-08b fallback: falls back to makeId / modelId when name fields missing', () => {
      const car: TitleSource = { year: 2018, makeId: 'mk_001', modelId: 'md_023' };
      expect(buildListingTitle(car)).toBe('2018 mk_001 md_023');
    });

    test('partial fallback: per-field fallback (makeName present, modelId substitutes)', () => {
      const car: TitleSource = { year: 2018, makeName: 'Toyota', modelId: 'md_023' };
      expect(buildListingTitle(car)).toBe('2018 Toyota md_023');
    });

    test('year missing: no leading "undefined" token, no empty leading whitespace', () => {
      const car: TitleSource = { makeName: 'Toyota', modelName: 'Camry' };
      expect(buildListingTitle(car)).toBe('Toyota Camry');
    });

    test('everything missing: returns empty string (NOT a crash)', () => {
      expect(buildListingTitle({})).toBe('');
    });
  });

  describe('matchesListingTitleSentinel', () => {
    const sameCar: TitleSource = { year: 2018, makeName: 'Toyota', modelName: 'Camry' };

    test('exact match returns true', () => {
      expect(matchesListingTitleSentinel('2018 Toyota Camry', sameCar)).toBe(true);
    });

    test('D-08a case-insensitive match returns true', () => {
      expect(matchesListingTitleSentinel('2018 toyota CAMRY', sameCar)).toBe(true);
    });

    test('D-08a whitespace-trimmed match returns true', () => {
      expect(matchesListingTitleSentinel('  2018 Toyota Camry  ', sameCar)).toBe(true);
    });

    test('mismatch (different year) returns false', () => {
      expect(matchesListingTitleSentinel('2019 Toyota Camry', sameCar)).toBe(false);
    });

    test('empty input returns false (defensive — never match on empty)', () => {
      expect(matchesListingTitleSentinel('', sameCar)).toBe(false);
    });
  });
});
