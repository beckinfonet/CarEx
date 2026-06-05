// Group a member count into a thousands-separated string for the home
// MemberCountStrip. Hermes' Intl locale support is unreliable, so we group
// manually rather than via toLocaleString(locale):
//   EN -> comma:                 2,418,367
//   RU -> NON-BREAKING space:    2 418 367  ( )
// The RU separator MUST be a non-breaking space so the number can never wrap
// across two lines next to the long noun "пользователей" on narrow screens.
export function formatMembers(count: number, language: 'RU' | 'EN'): string {
  const sep = language === 'RU' ? ' ' : ',';
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
