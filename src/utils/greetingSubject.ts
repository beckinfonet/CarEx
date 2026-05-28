/**
 * greetingSubject — helpers for composing the V2 home-screen greeting kicker.
 *
 * The greeting is rendered above the headline on HomeScreenV2 and reads, e.g.,
 *   "Доброе утро · Becky · Москва"
 *
 * Two helpers cover the two independent pieces of that subject:
 *
 *  - getCityFromTimezone() maps an IANA timezone string (as returned by
 *    Intl.DateTimeFormat().resolvedOptions().timeZone) to a localized city
 *    name using the translations object. Returns null when the timezone is
 *    unknown, when the translation key is missing, or when anything throws
 *    (so a boot-time read of an undefined `t` cannot crash the screen).
 *
 *  - buildGreetingSubject() combines an optional first name with an optional
 *    city into a single ` · `-joined subject string. Each input is trimmed
 *    and treated as missing when empty. With both inputs missing the result
 *    is an empty string, which signals GreetingBlock to omit the divider.
 *
 * Intentionally lib-free: no Intl polyfill, no geolocation dep, no axios call.
 * The IANA timezone comes from the device's resolved timezone (Hermes/RN 0.83
 * supports Intl.DateTimeFormat().resolvedOptions().timeZone natively).
 */

const TIMEZONE_TO_CITY_KEY: Record<string, string> = {
  'Europe/Moscow': 'cityMoscow',
  'Europe/Saint_Petersburg': 'citySaintPetersburg',
  'Europe/Kaliningrad': 'cityKaliningrad',
  'Europe/Samara': 'citySamara',
  'Asia/Yekaterinburg': 'cityYekaterinburg',
  'Asia/Omsk': 'cityOmsk',
  'Asia/Novosibirsk': 'cityNovosibirsk',
  'Asia/Krasnoyarsk': 'cityKrasnoyarsk',
  'Asia/Irkutsk': 'cityIrkutsk',
  'Asia/Yakutsk': 'cityYakutsk',
  'Asia/Vladivostok': 'cityVladivostok',
  'Asia/Magadan': 'cityMagadan',
  'Asia/Kamchatka': 'cityKamchatka',
};

/**
 * Resolve an IANA timezone string to a localized city name from the
 * translations object. Returns null when the timezone is unknown, the
 * translation key is missing, or anything throws.
 */
export function getCityFromTimezone(timeZone: string, t: any): string | null {
  try {
    if (!timeZone) return null;
    const key = TIMEZONE_TO_CITY_KEY[timeZone];
    if (!key) return null;
    const value = t && t[key];
    if (!value || typeof value !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * Compose a greeting subject from optional firstName + optional city.
 * Both inputs are trimmed; empty strings are treated as missing.
 *
 *  - both present → "firstName · city"
 *  - firstName only → "firstName"
 *  - city only → "city"
 *  - neither → ""
 */
export function buildGreetingSubject(
  { firstName, city }: { firstName?: string | null; city?: string | null }
): string {
  const f = (firstName ?? '').trim();
  const c = (city ?? '').trim();
  if (f && c) return `${f} · ${c}`;
  if (f) return f;
  if (c) return c;
  return '';
}
