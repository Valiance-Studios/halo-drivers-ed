import {describe, expect, it} from 'vite-plus/test';
import {DEMO_SLOTS} from '@hde/shared';
import {AVAILABILITY} from '#src/db/availabilityData.ts';
import {VEHICLES} from '#src/db/catalogData.ts';
import {DEMO_INSTRUCTOR, DEMO_LESSONS, findHistoryTimes, historyPeriod} from '#src/demo/demoHistory.ts';

const HOUR_MS = 60 * 60 * 1000;
const windows = AVAILABILITY.filter(({instructorSlug}) => instructorSlug === DEMO_INSTRUCTOR);
const lessonMinutes = DEMO_LESSONS.map(
  ({vehicleSlug}) => VEHICLES.find(({slug}) => slug === vehicleSlug)!.lessonMinutes,
);
// Every hour of the week when daylight saving ends, and of an ordinary one.
const times = ['2026-11-01T00:00:00Z', '2026-06-07T00:00:00Z'].flatMap((start) =>
  Array.from({length: 7 * 24}, (_, hour) => new Date(new Date(start).getTime() + hour * HOUR_MS)),
);

describe('findHistoryTimes', () => {
  it('has room for every lesson, in order and within its week, whenever a demo starts', () => {
    for (const now of times) {
      const period = historyPeriod(1, now);
      const found = findHistoryTimes(lessonMinutes, period, windows, []);

      expect(found, now.toISOString()).toHaveLength(DEMO_LESSONS.length);

      for (const [index, {startsAt}] of found.entries()) {
        const earliest = found[index - 1]?.endsAt ?? period.from;

        expect(startsAt >= earliest && startsAt <= period.until, now.toISOString()).toBe(true);
      }
    }
  });

  it("keeps each slot's lessons apart from the others', even when claimed together", () => {
    const now = times[0]!;
    const found = Array.from({length: DEMO_SLOTS}, (_, index) =>
      findHistoryTimes(lessonMinutes, historyPeriod(index + 1, now), windows, []),
    )
      .flat()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    for (const [index, {startsAt}] of found.entries()) {
      expect(index === 0 || startsAt >= found[index - 1]!.endsAt).toBe(true);
    }
  });

  it('works around lessons already booked', () => {
    const period = historyPeriod(1, times[0]!);
    const [first] = findHistoryTimes(lessonMinutes, period, windows, []);
    const [moved] = findHistoryTimes(lessonMinutes, period, windows, [first!]);

    expect(moved!.startsAt >= first!.endsAt).toBe(true);
  });
});
