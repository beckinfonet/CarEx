import { formatYmdHm } from '../formatYmdHm';

describe('formatYmdHm', () => {
  test.todo('formats a known ISO string to YYYY-MM-DD HH:mm');
  test.todo('accepts a Date instance and formats it identically');
  test.todo('zero-pads single-digit month, day, hour, minute');
  test.todo('uses local time (not UTC) — assertion via Date.prototype.getHours');
  test.todo('format does NOT depend on device locale (no toLocaleString)');
});
