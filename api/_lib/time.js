// Time-zone helpers. Lessons are stored as UTC instants; students see Beijing
// time, mentors see California time (America/Los_Angeles, which observes DST,
// so the gap is 15 hours in summer and 16 in winter).
export const BJ = 'Asia/Shanghai';
export const CA = 'America/Los_Angeles';

// { y, mo, d, dow, h, mi } of an instant in a zone.
export function parts(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), h: +o.hour, mi: +o.minute };
}

// The UTC instant of a wall-clock time in a zone (handles DST by correcting once).
export function zoned(y, mo, d, h, mi, tz) {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const p = parts(guess, tz);
    const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += Date.UTC(y, mo - 1, d, h, mi) - asUtc;
  }
  return guess;
}

// Is the instant inside a mentor's weekly availability grid? Grid keys are
// "<dow>-<hour>" in California time (the availability page's own zone).
export function inGrid(ms, grid) {
  const p = parts(ms, CA);
  return !!(grid && grid[p.dow + '-' + p.h]);
}
