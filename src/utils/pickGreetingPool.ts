import { GreetingSlot } from './greetingVariants';
import type { PersonalityTier } from '../context/PersonalityContext';

/** The three time-of-day greeting slots (the fourth slot, 'headline', is independent). */
export type GreetingTimeSlot = Exclude<GreetingSlot, 'headline'>;

/** Map the current wall-clock hour to a greeting slot. <12 = morning, <18 = afternoon, otherwise evening. */
export function currentGreetingSlot(): GreetingTimeSlot {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/**
 * Pick the right tier-scoped greeting pool for the current slot.
 * Slot defaults to currentGreetingSlot() so callers don't need to know the hour.
 */
export function pickGreetingPool(
  t: any,
  tier: PersonalityTier,
  slot: GreetingTimeSlot = currentGreetingSlot(),
): { slot: GreetingTimeSlot; pool: string[] } {
  const pool =
    slot === 'morning'   ? t.greetingVariantsMorning[tier] :
    slot === 'afternoon' ? t.greetingVariantsAfternoon[tier] :
                           t.greetingVariantsEvening[tier];
  return { slot, pool };
}
