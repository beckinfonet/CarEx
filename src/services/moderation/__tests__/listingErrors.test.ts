import * as fs from 'fs';
import * as path from 'path';
import { ListingModerationError, ModerationError } from '../errors';

describe('ListingModerationError', () => {
  it('sets code/name/message and is-a Error for a base listing code', () => {
    const err = new ListingModerationError('listing_not_available');
    expect(err.code).toBe('listing_not_available');
    expect(err.name).toBe('ListingModerationError');
    expect(err.message).toBe('ListingModerationError: listing_not_available');
    expect(err instanceof Error).toBe(true);
  });

  it('accepts each of the 10 explicit code-union members and round-trips them verbatim', () => {
    const explicitCodes = [
      'listing_not_available',
      'listing_not_found',
      'cannot_moderate_own_listing',
      'already_in_state',
      'not_moderated',
      'invalid_field',
      'no_changes',
      'invalid_payload',
      'invalid_make',
      'invalid_model',
    ] as const;

    explicitCodes.forEach((code) => {
      const err = new ListingModerationError(code);
      expect(err.code).toBe(code);
      expect(err.message).toBe(`ListingModerationError: ${code}`);
      expect(err.name).toBe('ListingModerationError');
    });
  });

  it('accepts an unknown code via the | string escape hatch and preserves it verbatim', () => {
    const err = new ListingModerationError('some_future_code');
    expect(err.code).toBe('some_future_code');
    expect(err.message).toBe('ListingModerationError: some_future_code');
  });

  it('preserves all context fields when supplied', () => {
    const banner = { titleKey: 'k', bodyKey: 'b', severity: 'warning' as const };
    const err = new ListingModerationError(
      'listing_not_available',
      'suspended',
      'spam',
      banner,
      're_abc',
      false,
      409,
    );
    expect(err.listingStatus).toBe('suspended');
    expect(err.reasonCategory).toBe('spam');
    expect(err.banner).toEqual(banner);
    expect(err.banner?.severity).toBe('warning');
    expect(err.refundId).toBe('re_abc');
    expect(err.refundFailed).toBe(false);
    expect(err.httpStatus).toBe(409);
  });

  it('defaults all context fields to undefined when only the code is supplied', () => {
    const err = new ListingModerationError('listing_not_available');
    expect(err.listingStatus).toBeUndefined();
    expect(err.reasonCategory).toBeUndefined();
    expect(err.banner).toBeUndefined();
    expect(err.refundId).toBeUndefined();
    expect(err.refundFailed).toBeUndefined();
    expect(err.httpStatus).toBeUndefined();
  });

  it('is a sibling class — not instanceof ModerationError and vice versa (Phase 4 D-07 boundary)', () => {
    const listingErr = new ListingModerationError('listing_not_available');
    const userErr = new ModerationError('account_suspended');

    // Sibling, not subclass — neither direction holds.
    expect(listingErr instanceof ModerationError).toBe(false);
    expect(userErr instanceof ListingModerationError).toBe(false);

    // Both are-a Error so existing top-level catch blocks still work.
    expect(listingErr instanceof Error).toBe(true);
    expect(userErr instanceof Error).toBe(true);
  });

  it('does not widen ModerationError to accept listing codes (sibling discipline guard)', () => {
    // Source-level invariant per RESEARCH §Anti-Pattern Guardrails: any future
    // edit that adds a listing code into the ModerationError union literal
    // (instead of using the sibling ListingModerationError) breaks here.
    // Read errors.ts from disk and extract the ModerationError class block,
    // then assert it contains none of the listing-domain code literals.
    const errorsPath = path.join(__dirname, '..', 'errors.ts');
    const source = fs.readFileSync(errorsPath, 'utf8');
    const match = source.match(/class ModerationError[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const modBlock = match![0];

    const forbiddenListingCodes = [
      'listing_not_available',
      'listing_not_found',
      'cannot_moderate_own_listing',
      'already_in_state',
      'not_moderated',
      'invalid_make',
      'invalid_model',
    ];
    for (const codeLiteral of forbiddenListingCodes) {
      expect(modBlock.includes(`'${codeLiteral}'`)).toBe(false);
    }
  });
});
