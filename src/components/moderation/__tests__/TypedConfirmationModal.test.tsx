import React from 'react';
import { TypedConfirmationModal } from '../TypedConfirmationModal';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, k) => String(k) }) }),
}));

describe('TypedConfirmationModal', () => {
  test.todo('Confirm is disabled when input is empty');
  test.todo('Confirm is disabled when input does not match target.email exactly');
  test.todo('Confirm enables when input.trim().toLowerCase() === target.email.trim().toLowerCase()');
  test.todo('shows the t.typedConfirmMismatch hint after dirty input that does not match');
  test.todo('warning body switches by action (delete vs revoke vs permaban)');
  test.todo('fires onConfirm() exactly once per Confirm tap when valid');
  test.todo('fires onClose() when Cancel is tapped');
  test.todo('Confirm button uses COLORS.destructive background');
});
