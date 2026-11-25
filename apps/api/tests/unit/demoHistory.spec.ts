import {describe, expect, it} from 'vite-plus/test';
import {DEMO_SLOTS} from '@hde/shared';
import {AVAILABILITY} from '#src/db/availabilityData.ts';
import {VEHICLES} from '#src/db/catalogData.ts';
import {DEMO_LESSONS, findHistoryTimes, historyPeriod} from '#src/demo/demoHistory.ts';

const HOUR_MS = 60 * 60 * 1000;
const lessons = DEMO_LESSONS.map(({instructorSlug, vehicleSlug}) => ({
  instructorSlug,
  lessonMinutes: VEHICLES.find(({slug}) => slug === vehicleSlug)!.lessonMinutes,
}));
// Every hour of the week when daylight saving ends, and of an ordinary one.
const times = ['2026-11-01T00:00:00Z', '2026-06-07T00:00:00Z'].flatMap((start) =>
  Array.from({length: 7 * 24}, (_, hour) => new Date(new Date(start).getTime() + hour * HOUR_MS)),
);

describe('findHistoryTimes', () => {
  it('has room for every lesson, within its week and clear of the others, whenever a demo starts', () => {
    for (const now of times) {
      const period = historyPeriod(1, now);
      const found = findHistoryTimes(lessons, period, AVAILABILITY, []);

      expect(found, now.toISOString()).toHaveLength(DEMO_LESSONS.length);

      const inOrder = found.toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

      for (const [index, {startsAt}] of inOrder.entries()) {
        const earliest = inOrder[index - 1]?.endsAt ?? period.from;

        expect(startsAt >= earliest && startsAt <= period.until, now.toISOString()).toBe(true);
      }
    }
  });

  it('keeps each course in order, and the Warthog lesson to repeat the latest', () => {
    for (const now of times) {
      const found = findHistoryTimes(lessons, historyPeriod(1, now), AVAILABILITY, []);
      const repeat = found[DEMO_LESSONS.findIndex(({status}) => status === 'repeat')]!;

      for (const [index, time] of found.entries()) {
        const next = found[index + 1];

        expect(time.startsAt <= repeat.startsAt, now.toISOString()).toBe(true);

        if (next && DEMO_LESSONS[index]!.vehicleSlug === DEMO_LESSONS[index + 1]!.vehicleSlug) {
          expect(next.startsAt >= time.endsAt, now.toISOString()).toBe(true);
        }
      }
    }
  });

  it("keeps each slot's lessons apart from the others', even when claimed together", () => {
    const now = times[0]!;
    const found = Array.from({length: DEMO_SLOTS}, (_, index) =>
      findHistoryTimes(lessons, historyPeriod(index + 1, now), AVAILABILITY, []),
    )
      .flat()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    for (const [index, {startsAt}] of found.entries()) {
      expect(index === 0 || startsAt >= found[index - 1]!.endsAt).toBe(true);
    }
  });

  it('works around lessons already booked', () => {
    const period = historyPeriod(1, times[0]!);
    const [first] = findHistoryTimes(lessons, period, AVAILABILITY, []);
    const [moved] = findHistoryTimes(lessons, period, AVAILABILITY, [first!]);

    expect(moved!.startsAt >= first!.endsAt).toBe(true);
  });
});
