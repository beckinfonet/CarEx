// Pure helper module — no UI framework imports, no HTTP client, no I/O.
// Mirrors src/utils/passwordPolicy.ts shape.
//
// Phase 10 RESEARCH Pitfall 6: different render sites must NOT inline-concat
// `${year} ${makeName} ${modelName}` independently. The bottom-sheet header
// (Plan 06) and the TypedConfirmationModal sentinel target (Plan 08) both
// import buildListingTitle so the typed string is matched against the SAME
// string the admin just read — making the mismatch-forever regression
// structurally impossible.
//
// Decision references (Phase 10 RESEARCH.md):
//   D-08  — Canonical concat is `${year} ${makeName} ${modelName}` (Phase 9 D-05 backend format)
//   D-08a — Case-insensitive + whitespace-trimmed match between typed input and canonical title
//   D-08b — Fall back to makeId / modelId literal strings when name fields are missing.
//           Helper stays a pure synchronous function — no catalog round-trip
//           from inside the helper.

export interface ListingTitleSource {
  year?: number;
  makeName?: string;
  modelName?: string;
  makeId?: string;
  modelId?: string;
}

export function buildListingTitle(car: ListingTitleSource): string {
  const year = car.year != null ? String(car.year) : '';
  const make = (car.makeName ?? car.makeId ?? '').trim();
  const model = (car.modelName ?? car.modelId ?? '').trim();
  return [year, make, model].filter(Boolean).join(' ');
}

export function matchesListingTitleSentinel(
  input: string,
  car: ListingTitleSource,
): boolean {
  const canonical = buildListingTitle(car).trim().toLowerCase();
  const typed = String(input ?? '').trim().toLowerCase();
  return typed.length > 0 && typed === canonical;
}
