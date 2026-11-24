import {describe, expect, it} from 'vite-plus/test';
import {findSlots} from '#src/bookings/lessonSlots.ts';

const MONDAY = {weekday: 1, startsAt: '09:00:00', endsAt: '11:00:00'};
const starts = (query: Partial<Parameters<typeof findSlots>[0]>) =>
  findSlots({
    windows: [MONDAY],
    lessonMinutes: 60,
    // Sunday to Tuesday, in Eastern Daylight Time (UTC-4).
    from: new Date('2026-06-07T12:00:00Z'),
    until: new Date('2026-06-09T12:00:00Z'),
    busy: [],
    ...query,
  }).map(({startsAt}) => startsAt.toISOString().slice(0, 16));

describe('findSlots', () => {
  it('offers half-hour starts that finish within the hours', () => {
    expect(starts({})).toEqual(['2026-06-08T13:00', '2026-06-08T13:30', '2026-06-08T14:00']);
    expect(starts({lessonMinutes: 120})).toEqual(['2026-06-08T13:00']);
    expect(starts({lessonMinutes: 180})).toEqual([]);
  });

  it('keeps wall-clock hours when daylight saving ends', () => {
    // Clocks change on Sunday 1 November 2026; Monday is in Eastern Standard Time (UTC-5).
    const slots = starts({from: new Date('2026-10-25T12:00:00Z'), until: new Date('2026-11-03T12:00:00Z')});

    expect(slots).toContain('2026-10-26T13:00');
    expect(slots).toContain('2026-11-02T14:00');
    expect(slots).not.toContain('2026-11-02T13:30');
  });

  it('leaves out clashes, but not lessons that only touch', () => {
    const busy = [{startsAt: new Date('2026-06-08T14:00:00Z'), endsAt: new Date('2026-06-08T15:00:00Z')}];

    expect(starts({busy})).toEqual(['2026-06-08T13:00']);
  });

  it('leaves out every start a booked lesson overlaps, before and after it', () => {
    const windows = [{...MONDAY, endsAt: '12:00:00'}];
    const busy = [{startsAt: new Date('2026-06-08T14:00:00Z'), endsAt: new Date('2026-06-08T14:45:00Z')}];

    // 13:30 would run into the booked lesson, and 14:30 would start during it.
    expect(starts({windows, lessonMinutes: 45, busy})).toEqual(['2026-06-08T13:00', '2026-06-08T15:00']);
  });

  it('leaves out times that have passed or are too far ahead', () => {
    expect(starts({from: new Date('2026-06-08T13:30:00Z')})).toEqual(['2026-06-08T14:00']);
    expect(starts({until: new Date('2026-06-08T13:00:00Z')})).toEqual(['2026-06-08T13:00']);
  });
});
