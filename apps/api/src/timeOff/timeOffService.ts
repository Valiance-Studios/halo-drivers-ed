import type {TimeOff, TimeOffAnswer, TimeOffRequest} from '@hde/shared';
import type {CatalogRepository} from '#src/repositories/catalogRepository.ts';
import type {TimeOffRepository} from '#src/repositories/timeOffRepository.ts';

import {ApiError} from '#src/http/errors.ts';
import {daysPeriod, schoolDate} from '#src/timeOff/schoolDays.ts';

/** The rules for instructors' time off. */
export class TimeOffService {
  private readonly timeOff: TimeOffRepository;
  private readonly catalog: CatalogRepository;
  private readonly now: () => Date;

  constructor(timeOff: TimeOffRepository, catalog: CatalogRepository, now: () => Date = () => new Date()) {
    this.timeOff = timeOff;
    this.catalog = catalog;
    this.now = now;
  }

  /** The instructor's time off that is not over. */
  async list(instructorSlug: string): Promise<TimeOff[]> {
    await this.checkInstructor(instructorSlug);

    return this.timeOff.list(instructorSlug, schoolDate(this.now()));
  }

  async add(instructorSlug: string, {startsOn, endsOn, cancel}: TimeOffRequest): Promise<TimeOffAnswer> {
    await this.checkInstructor(instructorSlug);
    const now = this.now();

    if (endsOn < startsOn || startsOn < schoolDate(now)) {
      throw new ApiError(
        400,
        'invalid-request',
        'Choose a first day that is not in the past, and a last day on or after it.',
      );
    }

    const days = daysPeriod(startsOn, endsOn);
    // Lessons that are over are signed off as usual, so they do not matter.
    const period = {...days, startsAt: new Date(Math.max(days.startsAt.getTime(), now.getTime()))};
    const answer = await this.timeOff.add({instructorSlug, startsOn, endsOn, period, cancel});

    if (!answer) {
      throw new ApiError(409, 'time-off-overlap', 'This instructor already has time off in those days.');
    }

    return answer;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.timeOff.remove(id))) {
      throw new ApiError(404, 'not-found', 'No such time off.');
    }
  }

  private async checkInstructor(slug: string): Promise<void> {
    const instructors = await this.catalog.listInstructors();

    if (!instructors.some((instructor) => instructor.slug === slug)) {
      throw new ApiError(404, 'not-found', 'No such instructor.');
    }
  }
}
