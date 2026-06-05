import { formatMembers } from '../formatMembers';

describe('formatMembers', () => {
  it('groups EN with commas', () => {
    expect(formatMembers(2418367, 'EN')).toBe('2,418,367');
    expect(formatMembers(1000, 'EN')).toBe('1,000');
    expect(formatMembers(999, 'EN')).toBe('999');
  });

  it('groups RU with NON-BREAKING spaces so the number never wraps', () => {
    const ru = formatMembers(2418367, 'RU');
    expect(ru).toBe('2 418 367');
    // must be the non-breaking space ( ), not a regular space
    expect(ru).not.toContain(' '); // regular ASCII space
    expect(ru.split(' ')).toHaveLength(3);
  });

  it('handles small and edge values', () => {
    expect(formatMembers(0, 'EN')).toBe('0');
    expect(formatMembers(-5, 'RU')).toBe('0');
    expect(formatMembers(1234.9, 'EN')).toBe('1,234');
  });
});
