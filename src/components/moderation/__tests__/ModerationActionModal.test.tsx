import React from 'react';
import { ModerationActionModal } from '../ModerationActionModal';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, k) => String(k) }) }),
}));

describe('ModerationActionModal', () => {
  test.todo('renders SeverityPicker + ReasonPicker + NoteInput for action="suspend"');
  test.todo('renders ONLY the optional NoteInput for action="unsuspend"');
  test.todo('renders RolePicker + ReasonPicker + NoteInput for action="revoke_role"');
  test.todo('renders RoleTabs + dynamic field form for action="edit_profile"');
  test.todo('Confirm is disabled until severity is picked AND reason is picked (suspend)');
  test.todo('Confirm is disabled until reason is picked (revoke_role)');
  test.todo('Confirm is disabled until at least one field changed (edit_profile)');
  test.todo('Confirm enables for unsuspend with no fields filled');
  test.todo('calls props.onSubmit(payload) with the typed body shape on Confirm tap');
  test.todo('shows ActivityIndicator and disables fields when submitting=true');
});
