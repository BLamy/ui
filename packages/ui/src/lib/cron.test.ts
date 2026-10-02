import { describe, expect, it } from 'vitest';
import { CRON_FIELDS, cronProblems, describeCron, isValidTimeZone, localTimeZone, nextCronRuns, splitCron, validateCron } from '@/lib/cron';

const iso = (dates: Date[]) => dates.map((d) => d.toISOString().replace('.000Z', 'Z'));
/** Next runs of `expression` after `from` in `timeZone`, as ISO strings. */
const runs = (expression: string, from: string, timeZone: string, count = 5) => iso(nextCronRuns(expression, { from, timeZone, count }));

describe('splitCron', () => {
  it('splits on any whitespace and trims', () => {
    expect(splitCron('  0   9\t* * 1-5 ')).toEqual(['0', '9', '*', '*', '1-5']);
    expect(splitCron('')).toEqual([]);
    expect(splitCron('   ')).toEqual([]);
  });
  it('expands macros', () => {
    expect(splitCron('@daily')).toEqual(['0', '0', '*', '*', '*']);
    expect(splitCron('@WEEKLY')).toEqual(['0', '0', '*', '*', '0']);
    expect(splitCron('@yearly')).toEqual(splitCron('@annually'));
  });
});

describe('validateCron', () => {
  it('accepts lists, ranges, steps, names and macros', () => {
    for (const ok of ['* * * * *', '0 9 * * 1-5', '*/15 0-6/2 1,15 jan-mar mon-fri', '0 0 1 JAN,JUL *', '5,10,15 */6 * * 0,7', '@hourly', '59 23 31 12 7', '0 0 * * sun']) {
      expect(validateCron(ok), ok).toMatchObject({ valid: true, message: null });
    }
  });

  it('reports each wrong field and leaves the others null', () => {
    const v = validateCron('60 24 32 13 8');
    expect(v.valid).toBe(false);
    expect(v.message).toBeNull();
    expect(v.fields.minute).toMatch(/60 is out of range \(0–59\)/);
    expect(v.fields.hour).toMatch(/24 is out of range \(0–23\)/);
    expect(v.fields.dayOfMonth).toMatch(/32 is out of range \(1–31\)/);
    expect(v.fields.month).toMatch(/13 is out of range \(1–12\)/);
    expect(v.fields.dayOfWeek).toMatch(/8 is out of range \(0–7\)/);
  });

  it('flags only the bad field', () => {
    const v = validateCron('0 9 * * funday');
    expect(v.fields).toMatchObject({ minute: null, hour: null, dayOfMonth: null, month: null });
    expect(v.fields.dayOfWeek).toMatch(/weekday name/);
  });

  it('rejects zero and malformed steps, backwards ranges, stray commas and lone steps', () => {
    expect(validateCron('*/0 * * * *').fields.minute).toMatch(/step must be at least 1/);
    expect(validateCron('*/x * * * *').fields.minute).toMatch(/step .* must be a number/);
    expect(validateCron('*/2/3 * * * *').fields.minute).toMatch(/more than one step/);
    expect(validateCron('30-10 * * * *').fields.minute).toMatch(/runs backwards/);
    expect(validateCron('1,,2 * * * *').fields.minute).toMatch(/stray comma/);
    expect(validateCron('1, * * * *').fields.minute).toMatch(/stray comma/);
    expect(validateCron('5/15 * * * *').fields.minute).toMatch(/needs \* or a range/);
    expect(validateCron('1-2-3 * * * *').fields.minute).toMatch(/not a valid range/);
    expect(validateCron('/5 * * * *').fields.minute).toMatch(/missing a value/);
    expect(validateCron('L * * * *').fields.minute).toMatch(/not a number/);
    expect(validateCron('* * 1-40 * *').fields.dayOfMonth).toMatch(/40 is out of range/);
  });

  it('allows month and weekday names only in their own fields', () => {
    expect(validateCron('jan * * * *').fields.minute).toMatch(/not a number/);
    expect(validateCron('* * * mon *').fields.month).toMatch(/not a number or month name/);
    expect(validateCron('* * * jan *').valid).toBe(true);
  });

  it('wants exactly five fields', () => {
    const few = validateCron('0 9 *');
    expect(few.valid).toBe(false);
    expect(few.message).toMatch(/needs 5 fields; 3 given. Missing: month, day of week/);
    expect(few.parts).toEqual(['0', '9', '*']);
    expect(few.fields.minute).toBeNull();

    const many = validateCron('0 0 9 * * 1');
    expect(many.valid).toBe(false);
    expect(many.message).toMatch(/6 given/);

    const none = validateCron('   ');
    expect(none.valid).toBe(false);
    expect(none.message).toMatch(/Enter 5 fields/);
  });

  it('lists the problems with the whole-expression one first', () => {
    expect(cronProblems(validateCron('0 9 *'))).toEqual([{ field: null, message: expect.stringMatching(/needs 5 fields/) }]);
    const problems = cronProblems(validateCron('61 * * 0 *'));
    expect(problems.map((p) => p.field)).toEqual(['minute', 'month']);
    expect(problems[0].message).toMatch(/^Minute: 61 is out of range/);
    expect(cronProblems(validateCron('* * * * *'))).toEqual([]);
  });

  it('describes the five fields in order', () => {
    expect(CRON_FIELDS.map((f) => f.name)).toEqual(['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']);
  });
});

describe('nextCronRuns (UTC)', () => {
  it('steps through minutes, strictly after `from`', () => {
    expect(runs('*/15 * * * *', '2026-10-02T10:30:00Z', 'UTC', 4)).toEqual(['2026-10-02T10:45:00Z', '2026-10-02T11:00:00Z', '2026-10-02T11:15:00Z', '2026-10-02T11:30:00Z']);
  });

  it('ignores the seconds of `from`', () => {
    expect(runs('30 10 * * *', '2026-10-02T10:29:59Z', 'UTC', 1)).toEqual(['2026-10-02T10:30:00Z']);
    expect(runs('30 10 * * *', '2026-10-02T10:30:00Z', 'UTC', 1)).toEqual(['2026-10-03T10:30:00Z']);
    expect(runs('30 10 * * *', '2026-10-02T10:30:01Z', 'UTC', 1)).toEqual(['2026-10-03T10:30:00Z']);
  });

  it('accepts a Date, a number or a string for `from`', () => {
    const when = new Date('2026-10-02T10:00:00Z');
    const expected = ['2026-10-02T10:15:00Z'];
    expect(iso(nextCronRuns('15 * * * *', { from: when, timeZone: 'UTC', count: 1 }))).toEqual(expected);
    expect(iso(nextCronRuns('15 * * * *', { from: when.getTime(), timeZone: 'UTC', count: 1 }))).toEqual(expected);
    expect(iso(nextCronRuns('15 * * * *', { from: when.toISOString(), timeZone: 'UTC', count: 1 }))).toEqual(expected);
  });

  it('returns five runs by default and defaults `from` to now', () => {
    const list = nextCronRuns('* * * * *', { timeZone: 'UTC' });
    expect(list).toHaveLength(5);
    expect(list[0].getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(list[0].getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it('combines hour and minute lists in order', () => {
    expect(runs('0,30 9,17 * * *', '2026-10-02T00:00:00Z', 'UTC', 5)).toEqual([
      '2026-10-02T09:00:00Z', '2026-10-02T09:30:00Z', '2026-10-02T17:00:00Z', '2026-10-02T17:30:00Z', '2026-10-03T09:00:00Z',
    ]);
  });

  it('honours weekday ranges (2026-10-02 is a Friday)', () => {
    expect(runs('0 9 * * 1-5', '2026-10-02T10:00:00Z', 'UTC', 3)).toEqual(['2026-10-05T09:00:00Z', '2026-10-06T09:00:00Z', '2026-10-07T09:00:00Z']);
  });

  it('treats 0 and 7 as Sunday, and reads weekday and month names', () => {
    const sundays = ['2026-10-04T00:00:00Z', '2026-10-11T00:00:00Z'];
    expect(runs('0 0 * * 0', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(sundays);
    expect(runs('0 0 * * 7', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(sundays);
    expect(runs('0 0 * * SUN', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(sundays);
    expect(runs('0 0 * * 0-7', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(['2026-10-03T00:00:00Z', '2026-10-04T00:00:00Z']);
    expect(runs('0 0 1 jan,jul *', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(['2027-01-01T00:00:00Z', '2027-07-01T00:00:00Z']);
  });

  it('wraps weekday ranges ending in 7', () => {
    expect(runs('0 0 * * 5-7', '2026-10-02T12:00:00Z', 'UTC', 4)).toEqual(['2026-10-03T00:00:00Z', '2026-10-04T00:00:00Z', '2026-10-09T00:00:00Z', '2026-10-10T00:00:00Z']);
  });

  it('runs on the 13th OR a Friday when both day fields are restricted (POSIX)', () => {
    expect(runs('0 0 13 * 5', '2026-10-01T00:00:00Z', 'UTC', 5)).toEqual([
      '2026-10-02T00:00:00Z', '2026-10-09T00:00:00Z', '2026-10-13T00:00:00Z', '2026-10-16T00:00:00Z', '2026-10-23T00:00:00Z',
    ]);
  });

  it('uses only the restricted day field when the other is *', () => {
    // day-of-week * → the 13th only; day-of-month * → Fridays only
    expect(runs('0 0 13 * *', '2026-10-01T00:00:00Z', 'UTC', 2)).toEqual(['2026-10-13T00:00:00Z', '2026-11-13T00:00:00Z']);
    expect(runs('0 0 * * 5', '2026-10-01T00:00:00Z', 'UTC', 2)).toEqual(['2026-10-02T00:00:00Z', '2026-10-09T00:00:00Z']);
  });

  it('ANDs the day fields when one starts with *, even with a step (Vixie)', () => {
    // odd days of the month that are Fridays: Oct 9 and 23, then Nov 13 and 27
    expect(runs('0 0 */2 * 5', '2026-10-01T00:00:00Z', 'UTC', 4)).toEqual(['2026-10-09T00:00:00Z', '2026-10-23T00:00:00Z', '2026-11-13T00:00:00Z', '2026-11-27T00:00:00Z']);
  });

  it('applies the month field to either day field', () => {
    expect(runs('0 0 1 6 1', '2026-10-02T00:00:00Z', 'UTC', 3)).toEqual(['2027-06-01T00:00:00Z', '2027-06-07T00:00:00Z', '2027-06-14T00:00:00Z']);
  });

  it('runs on the first of each month and skips months without a 31st', () => {
    expect(runs('0 0 1 * *', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(['2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z']);
    expect(runs('0 0 31 * *', '2026-10-02T00:00:00Z', 'UTC', 4)).toEqual(['2026-10-31T00:00:00Z', '2026-12-31T00:00:00Z', '2027-01-31T00:00:00Z', '2027-03-31T00:00:00Z']);
  });

  it('finds the next leap day, and gives up on a date that never exists', () => {
    expect(runs('0 0 29 2 *', '2026-10-02T00:00:00Z', 'UTC', 2)).toEqual(['2028-02-29T00:00:00Z', '2032-02-29T00:00:00Z']);
    expect(nextCronRuns('0 0 30 2 *', { from: '2026-10-02T00:00:00Z', timeZone: 'UTC' })).toEqual([]);
  });

  it('expands macros', () => {
    expect(runs('@daily', '2026-10-02T12:00:00Z', 'UTC', 2)).toEqual(['2026-10-03T00:00:00Z', '2026-10-04T00:00:00Z']);
    expect(runs('@monthly', '2026-10-02T12:00:00Z', 'UTC', 1)).toEqual(['2026-11-01T00:00:00Z']);
  });

  it('applies ranges with steps', () => {
    expect(runs('10-40/15 8 * * *', '2026-10-02T00:00:00Z', 'UTC', 3)).toEqual(['2026-10-02T08:10:00Z', '2026-10-02T08:25:00Z', '2026-10-02T08:40:00Z']);
  });

  it('returns an empty list for an invalid expression, or a count below 1', () => {
    expect(nextCronRuns('0 9 * *', { timeZone: 'UTC' })).toEqual([]);
    expect(nextCronRuns('99 9 * * *', { timeZone: 'UTC' })).toEqual([]);
    expect(nextCronRuns('* * * * *', { timeZone: 'UTC', count: 0 })).toEqual([]);
  });

  it('returns ascending, unique instants', () => {
    const list = nextCronRuns('*/7 */5 * * *', { from: '2026-10-02T00:00:00Z', timeZone: 'UTC', count: 40 }).map((d) => d.getTime());
    expect(list).toHaveLength(40);
    expect(list).toEqual([...new Set(list)].sort((a, b) => a - b));
  });

  it('throws RangeError for an unknown time zone or an invalid `from`', () => {
    expect(() => nextCronRuns('* * * * *', { timeZone: 'Mars/Olympus' })).toThrow(RangeError);
    expect(() => nextCronRuns('* * * * *', { from: 'garbage', timeZone: 'UTC' })).toThrow(RangeError);
  });
});

describe('nextCronRuns (time zones)', () => {
  it('reads the expression in the given zone', () => {
    // 09:00 in Dhaka (UTC+6, no DST) is 03:00Z.
    expect(runs('0 9 * * *', '2026-10-02T00:00:00Z', 'Asia/Dhaka', 2)).toEqual(['2026-10-02T03:00:00Z', '2026-10-03T03:00:00Z']);
    expect(runs('0 9 * * *', '2026-10-02T04:00:00Z', 'Asia/Dhaka', 1)).toEqual(['2026-10-03T03:00:00Z']);
    // 09:00 in New York in October is EDT (UTC-4).
    expect(runs('0 9 * * *', '2026-10-02T00:00:00Z', 'America/New_York', 1)).toEqual(['2026-10-02T13:00:00Z']);
    // Half-hour zones.
    expect(runs('0 9 * * *', '2026-10-02T00:00:00Z', 'Asia/Kolkata', 1)).toEqual(['2026-10-02T03:30:00Z']);
  });

  it('uses the zone calendar for the day of week and the date', () => {
    // 2026-10-02T20:00Z is already Saturday 2026-10-03 in Auckland (UTC+13 in October).
    expect(runs('0 0 * * 6', '2026-10-02T20:00:00Z', 'Pacific/Auckland', 1)).toEqual(['2026-10-09T11:00:00Z']);
    expect(runs('0 12 * * 6', '2026-10-02T20:00:00Z', 'Pacific/Auckland', 1)).toEqual(['2026-10-02T23:00:00Z']);
  });

  it('defaults to the runtime zone', () => {
    expect(isValidTimeZone(localTimeZone())).toBe(true);
    const implicit = iso(nextCronRuns('0 9 * * *', { from: '2026-10-02T00:00:00Z', count: 2 }));
    expect(implicit).toEqual(runs('0 9 * * *', '2026-10-02T00:00:00Z', localTimeZone(), 2));
  });

  describe('spring forward (America/New_York, 2026-03-08: 02:00 EST becomes 03:00 EDT)', () => {
    it('moves a fixed time inside the gap to just after it', () => {
      expect(runs('30 2 * * *', '2026-03-07T00:00:00Z', 'America/New_York', 3)).toEqual([
        '2026-03-07T07:30:00Z', // 02:30 EST
        '2026-03-08T07:30:00Z', // 02:30 does not exist: 03:30 EDT
        '2026-03-09T06:30:00Z', // 02:30 EDT
      ]);
    });

    it('does not duplicate a run when the shifted time is also listed', () => {
      expect(runs('30 2,3 * * *', '2026-03-08T00:00:00Z', 'America/New_York', 3)).toEqual(['2026-03-08T07:30:00Z', '2026-03-09T06:30:00Z', '2026-03-09T07:30:00Z']);
    });

    it('lets a clock-following job skip the hour that does not exist', () => {
      expect(runs('*/30 1-3 * * *', '2026-03-08T05:00:00Z', 'America/New_York', 4)).toEqual([
        '2026-03-08T06:00:00Z', // 01:00 EST
        '2026-03-08T06:30:00Z', // 01:30 EST
        '2026-03-08T07:00:00Z', // 03:00 EDT (no 02:xx)
        '2026-03-08T07:30:00Z', // 03:30 EDT
      ]);
    });

    it('keeps an hourly job hourly through the change', () => {
      expect(runs('0 * * * *', '2026-03-08T05:30:00Z', 'America/New_York', 4)).toEqual(['2026-03-08T06:00:00Z', '2026-03-08T07:00:00Z', '2026-03-08T08:00:00Z', '2026-03-08T09:00:00Z']);
    });
  });

  describe('fall back (America/New_York, 2026-11-01: 02:00 EDT becomes 01:00 EST)', () => {
    it('runs a fixed time in the repeated hour once, at the first pass', () => {
      expect(runs('30 1 * * *', '2026-11-01T04:00:00Z', 'America/New_York', 2)).toEqual([
        '2026-11-01T05:30:00Z', // 01:30 EDT
        '2026-11-02T06:30:00Z', // 01:30 EST the next day
      ]);
    });

    it('runs a clock-following job on both passes', () => {
      expect(runs('*/30 1 * * *', '2026-11-01T04:00:00Z', 'America/New_York', 4)).toEqual([
        '2026-11-01T05:00:00Z', // 01:00 EDT
        '2026-11-01T05:30:00Z', // 01:30 EDT
        '2026-11-01T06:00:00Z', // 01:00 EST
        '2026-11-01T06:30:00Z', // 01:30 EST
      ]);
    });

    it('keeps an hourly job hourly through the change', () => {
      expect(runs('0 * * * *', '2026-11-01T04:30:00Z', 'America/New_York', 4)).toEqual(['2026-11-01T05:00:00Z', '2026-11-01T06:00:00Z', '2026-11-01T07:00:00Z', '2026-11-01T08:00:00Z']);
    });
  });

  it('handles a half-hour shift (Australia/Lord_Howe, 2026-10-04: 02:00 +10:30 becomes 02:30 +11)', () => {
    // 02:15 does not exist on the 4th; it moves forward by the 30-minute gap, to 02:45 +11 = 15:45Z on the 3rd.
    expect(runs('15 2 * * *', '2026-10-02T00:00:00Z', 'Australia/Lord_Howe', 3)).toEqual([
      '2026-10-02T15:45:00Z', // 02:15 +10:30 on the 3rd
      '2026-10-03T15:45:00Z', // moved to 02:45 +11 on the 4th
      '2026-10-04T15:15:00Z', // 02:15 +11 on the 5th
    ]);
  });

  it('copes with a zone that has no DST and a far-off date', () => {
    expect(runs('0 0 1 1 *', '2026-10-02T00:00:00Z', 'Asia/Tokyo', 2)).toEqual(['2026-12-31T15:00:00Z', '2027-12-31T15:00:00Z']);
  });
});

describe('isValidTimeZone', () => {
  it('knows IANA zones and rejects the rest', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});

describe('describeCron', () => {
  it('describes an expression in English (cronstrue, loaded on demand)', async () => {
    expect(await describeCron('0 9 * * 1-5')).toBe('At 09:00 AM, Monday through Friday');
    expect(await describeCron('*/15 * * * *')).toBe('Every 15 minutes');
  });
  it('can use a 24-hour clock', async () => {
    expect(await describeCron('0 17 * * *', { use24HourTime: true })).toBe('At 17:00');
  });
  it('expands macros', async () => {
    expect(await describeCron('@daily')).toBe('At 12:00 AM');
  });
  it('resolves null for an invalid expression', async () => {
    expect(await describeCron('0 9 *')).toBeNull();
    expect(await describeCron('99 * * * *')).toBeNull();
    expect(await describeCron('')).toBeNull();
  });
});
