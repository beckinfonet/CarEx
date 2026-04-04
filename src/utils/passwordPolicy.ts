export const PASSWORD_MIN_LENGTH = 7;

export type PasswordRequirementId = 'length' | 'uppercase' | 'number' | 'symbol';

export interface PasswordRequirementCheck {
  id: PasswordRequirementId;
  met: boolean;
}

export function getPasswordRequirementChecks(password: string): PasswordRequirementCheck[] {
  return [
    { id: 'length', met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'uppercase', met: /[A-Z]/.test(password) },
    { id: 'number', met: /\d/.test(password) },
    { id: 'symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function passwordMeetsPolicy(password: string): boolean {
  return getPasswordRequirementChecks(password).every((c) => c.met);
}
