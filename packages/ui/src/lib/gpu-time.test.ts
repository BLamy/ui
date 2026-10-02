import { afterEach, describe, expect, it } from 'vitest';
import { describeRecurrence, formatOccurrence, parseTime, resetGpuTime, rruleLine, timeTextSegments, toReference } from '@/lib/gpu-time';

/* The pure helpers, and parseTime against the real gpu-time package (it runs on the CPU, so it is deterministic and
   works in Node). The hook is tested with the package mocked in gpu-time.hook.test.tsx. */

afterEach(() => resetGpuTime());

const REF = '2026-09-09T12:00:00+06:00'; // a Wednesday, in Dhaka
const DHAKA = { timeZone: 'Asia/Dhaka', locale: 'en-US' };

describe('toReference', () => {
  it('passes strings through, converts dates and numbers, and defaults to now', () => {
    expect(toReference('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00Z');
    expect(toReference(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
    expect(toReference(Date.UTC(2026, 0, 1))).toBe('2026-01-01T00:00:00.000Z');
    expect(Math.abs(new Date(toReference()).getTime() - Date.now())).toBeLessThan(2000);
  });
  it('throws for an invalid date', () => {
    expect(() => toReference(new Date('nope'))).toThrow(RangeError);
  });
});

describe('parseTime (real gpu-time, CPU)', () => {
  it('resolves occurrences in the given zone', async () => {
    const r = await parseTime('Sat Sun 1pm-8pm Mon 10pm-12am', { reference: REF, timeZone: 'Asia/Dhaka' });
    expect(r.backend).toBe('cpu');
    expect(r.occurrences.map((o) => [o.start, o.end])).toEqual([
      ['2026-09-12T13:00:00+06:00', '2026-09-12T20:00:00+06:00'],
      ['2026-09-13T13:00:00+06:00', '2026-09-13T20:00:00+06:00'],
      ['2026-09-14T22:00:00+06:00', '2026-09-15T00:00:00+06:00'],
    ]);
    expect(r.spans).toHaveLength(1);
    expect(r.spans[0]).toMatchObject({ start: 0, end: 29 });
  });

  it('returns RFC 5545 rules and caps the preview with `limit`', async () => {
    const r = await parseTime('every weekday at 9am', { reference: REF, timeZone: 'Asia/Dhaka', limit: 3 });
    expect(r.occurrences).toHaveLength(3);
    expect(r.truncated).toBe(true);
    expect(r.rrules).toHaveLength(1);
    expect(r.rrules[0]).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR');
  });

  it('takes a Date reference and reads the zone into the result', async () => {
    const r = await parseTime('tomorrow at 3pm', { reference: new Date('2026-09-09T06:00:00Z'), timeZone: 'America/New_York' });
    expect(r.occurrences[0].start).toBe('2026-09-10T15:00:00-04:00');
  });

  it('honours dateOrder', async () => {
    const mdy = await parseTime('dinner on 3/4', { reference: REF, timeZone: 'Asia/Dhaka' });
    const dmy = await parseTime('dinner on 3/4', { reference: REF, timeZone: 'Asia/Dhaka', dateOrder: 'DMY' });
    expect(mdy.occurrences[0].start.slice(0, 10)).toBe('2027-03-04');
    expect(dmy.occurrences[0].start.slice(0, 10)).toBe('2027-04-03');
  });

  it('resolves an empty result (not an error) for text it does not recognise', async () => {
    const r = await parseTime('gibberish xyz', { reference: REF, timeZone: 'Asia/Dhaka' });
    expect(r.occurrences).toEqual([]);
    expect(r.spans).toEqual([]);
  });

  it('rejects for an unknown time zone or a bad reference', async () => {
    await expect(parseTime('tomorrow', { reference: REF, timeZone: 'Nope/Zone' })).rejects.toThrow(/time zone/i);
    await expect(parseTime('tomorrow', { reference: 'garbage', timeZone: 'UTC' })).rejects.toThrow(/reference/i);
  });

  it('rejects when WebGPU is forced where it does not exist', async () => {
    await expect(parseTime('tomorrow', { reference: REF, timeZone: 'UTC', backend: 'webgpu' })).rejects.toThrow(/webgpu/i);
  });
});

describe('formatOccurrence', () => {
  it('shows an all-day date', () => {
    expect(formatOccurrence({ start: '2026-09-10T00:00:00+06:00', allDay: true }, DHAKA)).toBe('Thu, Sep 10, 2026');
  });
  it('shows an all-day range ending the day before its exclusive end', () => {
    expect(formatOccurrence({ start: '2026-09-14T00:00:00+06:00', end: '2026-09-21T00:00:00+06:00', allDay: true }, DHAKA)).toMatch(/^Mon, Sep 14\s*–\s*Sun, Sep 20, 2026$/);
    // a one-day range reads as one day
    expect(formatOccurrence({ start: '2026-09-14T00:00:00+06:00', end: '2026-09-15T00:00:00+06:00', allDay: true }, DHAKA)).toBe('Mon, Sep 14, 2026');
  });
  it('shows a timed point and a timed range', () => {
    expect(formatOccurrence({ start: '2026-09-10T15:00:00+06:00', allDay: false }, DHAKA)).toMatch(/^Thu, Sep 10, 2026,? 3:00\s?PM$/);
    expect(formatOccurrence({ start: '2026-09-12T13:00:00+06:00', end: '2026-09-12T20:00:00+06:00', allDay: false }, DHAKA)).toMatch(/^Sat, Sep 12, 2026,? 1:00\s?–\s?8:00\s?PM$/);
  });
  it('says "From" / "Until" for a one-sided bound', () => {
    expect(formatOccurrence({ start: '2026-09-11T18:00:00+06:00', allDay: false, open: 'end' }, DHAKA)).toMatch(/^From Fri, Sep 11, 2026,? 6:00\s?PM$/);
    expect(formatOccurrence({ start: '2026-09-11T18:00:00+06:00', allDay: false, open: 'start' }, DHAKA)).toMatch(/^Until Fri, Sep 11, 2026,? 6:00\s?PM$/);
  });
  it('shows the times in the zone asked for', () => {
    // 15:00 in Dhaka is 09:00Z
    expect(formatOccurrence({ start: '2026-09-10T15:00:00+06:00', allDay: false }, { timeZone: 'UTC', locale: 'en-US' })).toMatch(/9:00\s?AM$/);
  });
});

describe('timeTextSegments', () => {
  const span = (start: number, end: number, confidence = 1) => ({ start, end, text: '', confidence });

  it('cuts the text along the recognised spans', () => {
    expect(timeTextSegments('meet me thurs 2-3pm ok', [span(8, 19, 0.66)])).toEqual([
      { text: 'meet me ', start: 0, end: 8, matched: false },
      { text: 'thurs 2-3pm', start: 8, end: 19, matched: true, confidence: 0.66 },
      { text: ' ok', start: 19, end: 22, matched: false },
    ]);
  });
  it('is one plain segment when nothing matched, and none for empty text', () => {
    expect(timeTextSegments('hello', [])).toEqual([{ text: 'hello', start: 0, end: 5, matched: false }]);
    expect(timeTextSegments('', [])).toEqual([]);
  });
  it('clamps, sorts and merges overlapping or touching spans, and always joins back to the text', () => {
    const text = 'every day at 8am, and friday';
    const segs = timeTextSegments(text, [span(20, 99, 0.9), span(0, 9, 0.8), span(5, 16, 0.5), span(-4, 0), span(3, 3)]);
    expect(segs.map((s) => [s.start, s.end, s.matched])).toEqual([[0, 16, true], [16, 20, false], [20, 28, true]]);
    expect(segs[0].confidence).toBe(0.5);
    expect(segs.map((s) => s.text).join('')).toBe(text);
  });
});

describe('describeRecurrence', () => {
  const rule = (body: string, dtstart = 'DTSTART;VALUE=DATE:20260915') => `${dtstart}\nRRULE:${body}`;
  const at9 = 'DTSTART;TZID=Asia/Dhaka:20260910T090000';
  const d = (r: string) => describeRecurrence(r, { locale: 'en-US', timeZone: 'Asia/Dhaka' });

  it('says weekday, weekend and single days', () => {
    expect(d(rule('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR', at9))).toMatch(/^Every weekday at 9:00\sAM$/);
    expect(d(rule('FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU'))).toBe('Every weekend');
    expect(d(rule('FREQ=WEEKLY;INTERVAL=1;BYDAY=TU'))).toBe('Every Tuesday');
    expect(d(rule('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH'))).toBe('Every week on Monday and Thursday');
    expect(d(rule('FREQ=WEEKLY;INTERVAL=1;BYDAY=FR,MO,WE'))).toBe('Every week on Monday, Wednesday and Friday');
    expect(d(rule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU'))).toBe('Every 2 weeks on Tuesday');
    expect(d(rule('FREQ=WEEKLY;INTERVAL=1'))).toBe('Every week');
  });
  it('says hourly and daily, with the clock time from DTSTART', () => {
    expect(d(rule('FREQ=HOURLY;INTERVAL=2', 'DTSTART;TZID=Asia/Dhaka:20260909T120000'))).toBe('Every 2 hours');
    expect(d(rule('FREQ=HOURLY;INTERVAL=1'))).toBe('Every hour');
    expect(d(rule('FREQ=DAILY;INTERVAL=1', 'DTSTART;TZID=Asia/Dhaka:20260910T081500'))).toMatch(/^Every day at 8:15\sAM$/);
    expect(d(rule('FREQ=DAILY;INTERVAL=3'))).toBe('Every 3 days');
  });
  it('says monthly rules by day number or by position', () => {
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=3'))).toBe('Every month on the 3rd');
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15'))).toBe('Every month on the 1st and 15th');
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=22'))).toBe('Every month on the 22nd');
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=11'))).toBe('Every month on the 11th');
    expect(d(rule('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1'))).toBe('Every 2 months on the last day');
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1;BYDAY=MO;BYSETPOS=1', 'DTSTART;TZID=Asia/Dhaka:20261005T100000'))).toMatch(/^Every month on the first Monday at 10:00\sAM$/);
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1;BYDAY=FR;BYSETPOS=-1'))).toBe('Every month on the last Friday');
    expect(d(rule('FREQ=MONTHLY;INTERVAL=1'))).toBe('Every month on the 15th');
  });
  it('says yearly rules', () => {
    expect(d(rule('FREQ=YEARLY;INTERVAL=1;BYMONTH=1;BYMONTHDAY=3'))).toBe('Every year on January 3');
    expect(d(rule('FREQ=YEARLY;INTERVAL=1;BYMONTH=12'))).toBe('Every December');
    expect(d(rule('FREQ=YEARLY;INTERVAL=1'))).toBe('Every year on September 15');
  });
  it('appends a count or an until date (read in the rule zone)', () => {
    expect(d(rule('FREQ=DAILY;INTERVAL=3;COUNT=5'))).toBe('Every 3 days, 5 times');
    expect(d(rule('FREQ=DAILY;INTERVAL=1;COUNT=1'))).toBe('Every day, 1 time');
    expect(d(rule('FREQ=DAILY;INTERVAL=1;UNTIL=20261201T175959Z', at9))).toMatch(/^Every day at 9:00\sAM, until Dec 1, 2026$/);
    expect(d(rule('FREQ=DAILY;INTERVAL=1;UNTIL=20261201'))).toBe('Every day, until Dec 1, 2026');
  });
  it('returns null for rules it cannot say in words', () => {
    expect(d(rule('FREQ=DAILY;INTERVAL=1;BYHOUR=9,17'))).toBeNull();
    expect(d(rule('FREQ=SECONDLY;INTERVAL=1'))).toBeNull();
    expect(d(rule('FREQ=WEEKLY;BYDAY=XX'))).toBeNull();
    expect(d(rule('FREQ=WEEKLY;INTERVAL=0'))).toBeNull();
    expect(d(rule('FREQ=MONTHLY;BYMONTH=2'))).toBeNull();
    expect(d('not a rule')).toBeNull();
  });
  it('describes what the real parser returns', async () => {
    const r = await parseTime('every other tuesday', { reference: REF, timeZone: 'Asia/Dhaka', limit: 2 });
    expect(d(r.rrules[0])).toBe('Every 2 weeks on Tuesday');
    const m = await parseTime('every month on the 3rd', { reference: REF, timeZone: 'Asia/Dhaka', limit: 2 });
    expect(d(m.rrules[0])).toBe('Every month on the 3rd');
  });
});

describe('rruleLine', () => {
  it('returns the RRULE line without DTSTART', () => {
    expect(rruleLine('DTSTART;VALUE=DATE:20260915\nRRULE:FREQ=WEEKLY;BYDAY=TU')).toBe('RRULE:FREQ=WEEKLY;BYDAY=TU');
    expect(rruleLine('FREQ=DAILY')).toBe('FREQ=DAILY');
  });
});
