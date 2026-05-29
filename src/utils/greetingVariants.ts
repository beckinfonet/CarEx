/**
 * greetingVariants — pick a random element from a pool while guaranteeing
 * it isn't the same one we showed last time for that slot.
 *
 * Used by HomeScreenV2 to rotate the greeting kicker (morning/afternoon/evening)
 * and the headline independently. The "last index per slot" registry is
 * module-scope so any component using the same slot key shares anti-repeat
 * memory for the lifetime of the JS context.
 */

export type GreetingSlot = 'morning' | 'afternoon' | 'evening' | 'headline';

const lastIndexBySlot: Record<GreetingSlot, number | null> = {
  morning: null,
  afternoon: null,
  evening: null,
  headline: null,
};

export function pickIndex(poolSize: number, lastIndex: number | null): number {
  if (poolSize <= 1) return 0;
  // Pick uniformly from [0, poolSize - 1) and shift past lastIndex to skip it.
  // This guarantees uniform distribution over the (poolSize - 1) allowed slots.
  if (lastIndex == null || lastIndex < 0 || lastIndex >= poolSize) {
    return Math.floor(Math.random() * poolSize);
  }
  const offset = Math.floor(Math.random() * (poolSize - 1));
  return offset < lastIndex ? offset : offset + 1;
}

export function rotateVariant<T>(slot: GreetingSlot, pool: T[]): T {
  if (!Array.isArray(pool) || pool.length === 0) {
    // Defensive — pools should never be empty in practice; the editorial
    // copy in translations.ts always ships exactly 10 entries per slot.
    console.warn(`[greetingVariants] empty pool for slot "${slot}"`);
    return undefined as unknown as T;
  }
  const idx = pickIndex(pool.length, lastIndexBySlot[slot]);
  lastIndexBySlot[slot] = idx;
  return pool[idx];
}

export function __resetVariantRegistry(): void {
  lastIndexBySlot.morning = null;
  lastIndexBySlot.afternoon = null;
  lastIndexBySlot.evening = null;
  lastIndexBySlot.headline = null;
}
