/**
 * Vehicle make logo URLs.
 * Uses avto-dev/vehicle-logotypes CDN (vl.imgix.net) when logo not in DB.
 * @see https://github.com/avto-dev/vehicle-logotypes
 */

const LOGO_CDN_BASE = 'https://vl.imgix.net/img';

/** Override slugs that don't match CDN (e.g. seed typo "Mazerati" -> "maserati") */
const SLUG_OVERRIDES: Record<string, string> = {
  mazerati: 'maserati',
  'kg-mobility': 'ssangyong',      // KG Mobility rebranded from SsangYong
  samsung: 'renault-samsung-motors', // Samsung Motors (Renault Samsung)
};

/** Logos with light/yellow colors that need dark background for visibility */
export const DARK_BG_SLUGS = new Set(['jeep']);

function toSlug(name: string): string {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export interface VehicleMakeWithLogo {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
}

/**
 * Returns the logo URL for a vehicle make.
 * Uses DB logo if set, otherwise falls back to CDN by slug.
 */
export function getMakeLogoUrl(make: VehicleMakeWithLogo): string | null {
  if (make.logo) return make.logo;
  let slug = make.slug || toSlug(make.name);
  slug = SLUG_OVERRIDES[slug] || slug;
  if (!slug) return null;
  return `${LOGO_CDN_BASE}/${slug}-logo.png`;
}

/** Returns true if this make's logo needs a dark background for visibility */
export function needsDarkLogoBg(make: VehicleMakeWithLogo): boolean {
  let slug = make.slug || toSlug(make.name);
  slug = SLUG_OVERRIDES[slug] || slug;
  return slug ? DARK_BG_SLUGS.has(slug) : false;
}
