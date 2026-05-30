import { pickGreetingPool, currentGreetingSlot } from '../pickGreetingPool';

const T = {
  greetingVariantsMorning:   { wholesome: ['MW'], sarcastic: ['MS'], unhinged: ['MU'] },
  greetingVariantsAfternoon: { wholesome: ['AW'], sarcastic: ['AS'], unhinged: ['AU'] },
  greetingVariantsEvening:   { wholesome: ['EW'], sarcastic: ['ES'], unhinged: ['EU'] },
};

describe('pickGreetingPool', () => {
  test('returns the wholesome morning pool when (morning, wholesome)', () => {
    expect(pickGreetingPool(T, 'wholesome', 'morning')).toEqual({ slot: 'morning', pool: ['MW'] });
  });

  test('returns the sarcastic afternoon pool when (afternoon, sarcastic)', () => {
    expect(pickGreetingPool(T, 'sarcastic', 'afternoon')).toEqual({ slot: 'afternoon', pool: ['AS'] });
  });

  test('returns the unhinged evening pool when (evening, unhinged)', () => {
    expect(pickGreetingPool(T, 'unhinged', 'evening')).toEqual({ slot: 'evening', pool: ['EU'] });
  });

  test('covers all 9 (slot, tier) combinations', () => {
    const expected: Record<string, string> = {
      'morning|wholesome': 'MW', 'morning|sarcastic': 'MS', 'morning|unhinged': 'MU',
      'afternoon|wholesome': 'AW', 'afternoon|sarcastic': 'AS', 'afternoon|unhinged': 'AU',
      'evening|wholesome': 'EW', 'evening|sarcastic': 'ES', 'evening|unhinged': 'EU',
    };
    (['morning', 'afternoon', 'evening'] as const).forEach((slot) => {
      (['wholesome', 'sarcastic', 'unhinged'] as const).forEach((tier) => {
        const { pool } = pickGreetingPool(T, tier, slot);
        expect(pool[0]).toBe(expected[`${slot}|${tier}`]);
      });
    });
  });

  test('omitting slot defaults to currentGreetingSlot()', () => {
    const expected = pickGreetingPool(T, 'wholesome', currentGreetingSlot());
    const actual = pickGreetingPool(T, 'wholesome');
    expect(actual).toEqual(expected);
  });
});

describe('currentGreetingSlot', () => {
  test('returns one of morning/afternoon/evening for the real wall clock', () => {
    expect(['morning', 'afternoon', 'evening']).toContain(currentGreetingSlot());
  });
});
