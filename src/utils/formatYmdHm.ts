/**
 * Format a Date or ISO string as `YYYY-MM-DD HH:mm` in LOCAL time (no timezone
 * suffix). Used by moderation history rows for stable, locale-independent
 * timestamps (UI-SPEC §Component 3, D-15 — explicit format, no toLocaleString).
 *
 * Returns '-' when input cannot be parsed (defensive — backend always sends ISO,
 * but a missing/null value should not crash the row render).
 */
export function formatYmdHm(input: string | Date | null | undefined): string {
  if (input == null || input === '') return '-';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '-';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
