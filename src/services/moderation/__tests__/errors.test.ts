import { ModerationError } from '../errors';

describe('ModerationError', () => {
  it('sets all five fields as public instance properties', () => {
    const err = new ModerationError(
      'account_suspended',
      'blocked_with_review',
      'spam',
      'user note',
      403,
    );
    expect(err.code).toBe('account_suspended');
    expect(err.status).toBe('blocked_with_review');
    expect(err.reasonCategory).toBe('spam');
    expect(err.note).toBe('user note');
    expect(err.httpStatus).toBe(403);
  });

  it('is instanceof ModerationError (preserves prototype chain)', () => {
    const err = new ModerationError('account_suspended');
    expect(err instanceof ModerationError).toBe(true);
  });

  it('is instanceof Error (is-a Error for existing catch blocks)', () => {
    const err = new ModerationError('account_suspended');
    expect(err instanceof Error).toBe(true);
  });

  it('has name === "ModerationError" (survives transpile)', () => {
    const err = new ModerationError('account_suspended');
    expect(err.name).toBe('ModerationError');
  });

  it('has message === "ModerationError: <code>" (super() called with code)', () => {
    const err = new ModerationError('account_suspended');
    expect(err.message).toBe('ModerationError: account_suspended');
  });
});
