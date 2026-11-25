/**
 * "Today" and "next midnight" in a named timezone (the AI allowance resets at midnight in
 * AI_USAGE_TIMEZONE). JavaScript Dates are instants in UTC; Intl gives the wall-clock date and
 * time of an instant in a timezone, and that's all we need.
 */

function wallClock(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far the timezone's wall clock is ahead of UTC at this instant (ms; DST-aware). */
function offsetMs(at: Date, timeZone: string): number {
  const w = wallClock(at, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-11-25": the calendar date in that timezone (used in Redis keys). */
export function dayKey(at: Date, timeZone: string): string {
  const { year, month, day } = wallClock(at, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The instant of the next 00:00 in that timezone (the allowance's reset time). */
export function nextMidnight(at: Date, timeZone: string): Date {
  const { year, month, day } = wallClock(at, timeZone);
  // Tomorrow 00:00 as if the zone were UTC, then shift by the zone's offset at that moment
  // (checked twice: the offset can differ across a DST change).
  const guess = Date.UTC(year, month - 1, day + 1);
  let result = guess - offsetMs(new Date(guess), timeZone);
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}
