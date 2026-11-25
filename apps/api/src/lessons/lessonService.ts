import type {
  AdminLesson,
  AttendedLesson,
  Booking,
  BookingStatus,
  CourseLesson,
  InstructorForm,
  LessonForm,
  LessonNotes,
  LessonSignOff,
  NotesRequest,
  PastLesson,
  SkillMark,
  SkillResults,
  Vehicle,
} from '@hde/shared';
import type {CatalogRepository} from '#src/repositories/catalogRepository.ts';
import type {LessonChange, LessonContext, LessonRepository} from '#src/repositories/lessonRepository.ts';

import {allMarked, allPassed} from '@hde/shared';
import {ApiError} from '#src/http/errors.ts';
import {lessonNotFound} from '#src/http/lessonId.ts';

/**
 * The rules for instructors' lesson forms and signing lessons off. Where a method takes `student`, only that
 * student's lessons exist for it; null means everyone's.
 */
export class LessonService {
  private readonly lessons: LessonRepository;
  private readonly catalog: CatalogRepository;
  private readonly now: () => Date;

  constructor(lessons: LessonRepository, catalog: CatalogRepository, now: () => Date = () => new Date()) {
    this.lessons = lessons;
    this.catalog = catalog;
    this.now = now;
  }

  list(instructorSlug: string | null, student: string | null): Promise<AdminLesson[]> {
    return this.lessons.list(instructorSlug, student);
  }

  async find(id: string, student: string | null): Promise<AdminLesson> {
    return (await this.context(id, student)).lesson;
  }

  async form(id: string, student: string | null): Promise<InstructorForm> {
    const [context, curriculum] = await Promise.all([this.context(id, student), this.catalog.listCurriculum()]);

    return {
      ...lessonForm(context, curriculum),
      privateNote: notesOf(context, id).private,
      history: pastLessons(context, curriculum),
    };
  }

  /** The student's own results, in every lesson they have attended. */
  studentResults(email: string): Promise<AttendedLesson[]> {
    return this.lessons.listAttended(email);
  }

  /** A student's own form, once the lesson is signed off as attended. */
  async studentForm(email: string, id: string): Promise<LessonForm> {
    const [context, curriculum] = await Promise.all([this.context(id, email), this.catalog.listCurriculum()]);

    if (context.lesson.lessonNumber === null) {
      throw lessonNotFound();
    }

    return lessonForm(context, curriculum);
  }

  /** Saves one skill's mark, so marks made at the same time do not overwrite each other. */
  async mark(id: string, skillId: string, {result, early}: SkillMark, student: string | null): Promise<void> {
    const curriculum = await this.catalog.listCurriculum();
    const lesson = await this.lessons.update(id, (context) => {
      checkStudent(context, student);

      this.checkOpen(context, early);
      const form = lessonForm(context, curriculum);
      const {[skillId]: _previous, ...others} = form.results;
      // Also checks that the skill is in the lesson when clearing it.
      mergeResults(form, {[skillId]: 'pass'});

      return {
        markedLesson: form.lesson.number,
        results: withPasses(result ? {...others, [skillId]: result} : others, form.passedBefore),
        notes: null,
        signOff: null,
      };
    });

    if (!lesson) {
      throw lessonNotFound();
    }
  }

  /** Saves the notes, leaving the marks alone. */
  async saveNotes(id: string, {notes, early}: NotesRequest, student: string | null): Promise<void> {
    const lesson = await this.lessons.update(id, (context) => {
      checkStudent(context, student);
      this.checkOpen(context, early);

      return {markedLesson: 0, results: null, notes, signOff: null};
    });

    if (!lesson) {
      throw lessonNotFound();
    }
  }

  /**
   * Cancels a lesson on its instructor's behalf, any time until it is signed off. Its marks are discarded, and its
   * notes are kept.
   */
  async cancel(id: string, reason: string, student: string | null): Promise<AdminLesson> {
    const lesson = await this.lessons.update(id, (context) => {
      checkStudent(context, student);

      if (context.lesson.status !== 'booked') {
        throw conflict('This lesson is already signed off or cancelled.');
      }

      return {markedLesson: 0, results: {}, notes: null, signOff: null, cancelReason: reason};
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    return lesson;
  }

  async signOff(id: string, signOff: LessonSignOff, by: string, student: string | null): Promise<AdminLesson> {
    const [vehicles, curriculum] = await Promise.all([this.catalog.listVehicles(), this.catalog.listCurriculum()]);
    const lesson = await this.lessons.update(id, (context) => {
      checkStudent(context, student);

      if (!signOff.early && this.now() < new Date(context.lesson.endsAt)) {
        throw new ApiError(409, 'too-early', 'A lesson can be signed off once it ends.');
      }

      checkOrder(context);
      const form = lessonForm(context, curriculum);

      return decideSignOff(context, form, signOff, vehicles, {by, at: this.now()});
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    return lesson;
  }

  /** Marks and notes are saved from when a lesson starts until it is signed off. */
  private checkOpen({lesson}: LessonContext, early: boolean): void {
    if (!early && this.now() < new Date(lesson.startsAt)) {
      throw new ApiError(409, 'too-early', 'A lesson can be marked once it starts.');
    }

    if (lesson.status !== 'booked') {
      throw conflict('This lesson is already signed off or cancelled. Sign it off again to correct it.');
    }
  }

  private async context(id: string, student: string | null): Promise<LessonContext> {
    const context = await this.lessons.findContext(id);

    if (!context) {
      throw lessonNotFound();
    }

    checkStudent(context, student);

    return context;
  }
}

/** Another student's lesson looks just like one that does not exist. */
function checkStudent({lesson}: LessonContext, student: string | null): void {
  if (student !== null && lesson.studentEmail !== student) {
    throw lessonNotFound();
  }
}

function conflict(message: string): ApiError {
  return new ApiError(409, 'sign-off-conflict', message);
}

/** The student's other lessons in the same course. */
function courseBookings({lesson, studentBookings}: LessonContext): Booking[] {
  return studentBookings.filter(({id, vehicleSlug}) => id !== lesson.id && vehicleSlug === lesson.vehicleSlug);
}

/** The form for a lesson: the next one in the course the student has not completed, or the one it was signed off as. */
function lessonForm(context: LessonContext, curriculum: CourseLesson[]): LessonForm {
  const {lesson, marked} = context;
  const others = courseBookings(context);
  const completed = others.filter(({status}) => status === 'completed').length;
  const number = lesson.lessonNumber ?? completed + 1;
  const courseLesson = curriculum.find((item) => item.vehicleSlug === lesson.vehicleSlug && item.number === number);

  if (!courseLesson) {
    throw conflict('This student has already completed the course.');
  }

  const earlierAttempts = new Set(
    others
      .filter((other) => other.status === 'repeat' && other.lessonNumber === number && other.startsAt < lesson.startsAt)
      .map(({id}) => id),
  );
  const passed = new Set(
    marked
      .filter(({bookingId}) => earlierAttempts.has(bookingId))
      .flatMap(({results}) => Object.keys(results).filter((id) => results[id] === 'pass')),
  );
  const passedBefore = courseLesson.skills.map(({id}) => id).filter((id) => passed.has(id));
  // Results marked against another lesson, before an earlier one was signed off, do not apply.
  const own = marked.find(({bookingId, lessonNumber}) => bookingId === lesson.id && lessonNumber === number);

  // Nor do ones for skills since dropped from the lesson.
  const results = Object.fromEntries(
    Object.entries(own?.results ?? {}).filter(([skillId]) => courseLesson.skills.some(({id}) => id === skillId)),
  );

  return {
    lesson: courseLesson,
    results: withPasses(results, passedBefore),
    passedBefore,
    studentNote: notesOf(context, lesson.id).student,
  };
}

function notesOf({notes}: LessonContext, id: string): LessonNotes {
  return notes.get(id) ?? {student: '', private: ''};
}

/** The student's earlier lessons in the course, latest first. */
function pastLessons(context: LessonContext, curriculum: CourseLesson[]): PastLesson[] {
  const {lesson, marked} = context;

  return courseBookings(context)
    .filter(({startsAt, status}) => startsAt < lesson.startsAt && status !== 'booked' && status !== 'cancelled')
    .map(({id, vehicleSlug, instructorSlug, startsAt, status, lessonNumber}) => ({
      id,
      instructorSlug,
      startsAt,
      status,
      lesson: curriculum.find((item) => item.vehicleSlug === vehicleSlug && item.number === lessonNumber) ?? null,
      results: marked.find((item) => item.bookingId === id && item.lessonNumber === lessonNumber)?.results ?? {},
      notes: notesOf(context, id),
    }))
    .reverse();
}

function withPasses(results: SkillResults, passed: string[]): SkillResults {
  return {...results, ...Object.fromEntries(passed.map((id) => [id, 'pass' as const]))};
}

function mergeResults({lesson, passedBefore}: LessonForm, results: SkillResults): SkillResults {
  const known = new Set(lesson.skills.map(({id}) => id));

  if (Object.keys(results).some((id) => !known.has(id))) {
    throw new ApiError(400, 'invalid-request', 'A skill is not part of this lesson. Reload the form and try again.');
  }

  return withPasses(results, passedBefore);
}

/** Lessons in a course are signed off in order, since each form depends on the ones before it. */
function checkOrder(context: LessonContext): void {
  const {lesson} = context;
  const others = courseBookings(context);

  if (lesson.status === 'cancelled') {
    throw conflict('This lesson was cancelled.');
  }

  const isSignedOff = ({status}: Booking) => status !== 'booked' && status !== 'cancelled';

  if (lesson.status !== 'booked' && others.some((other) => other.startsAt > lesson.startsAt && isSignedOff(other))) {
    throw conflict('A later lesson in this course is already signed off, so this one can no longer change.');
  }

  if (others.some((other) => other.status === 'booked' && other.startsAt < lesson.startsAt)) {
    throw conflict("Sign off this student's earlier lesson in the course first.");
  }
}

function decideSignOff(
  context: LessonContext,
  form: LessonForm,
  {results: submitted, notes, attendance}: LessonSignOff,
  vehicles: Vehicle[],
  signature: {by: string; at: Date},
): LessonChange {
  const markedLesson = form.lesson.number;

  if (attendance === 'missed') {
    checkConsequences(context, 'missed', vehicles);

    return {markedLesson, results: {}, notes, signOff: {status: 'missed', lessonNumber: null, ...signature}};
  }

  const results = mergeResults(form, submitted);

  if (!allMarked(form.lesson, results)) {
    throw new ApiError(400, 'invalid-request', 'Mark every skill before signing the lesson off.');
  }

  const status = allPassed(form.lesson, results) ? 'completed' : 'repeat';
  checkConsequences(context, status, vehicles);

  return {markedLesson, results, notes, signOff: {status, lessonNumber: markedLesson, ...signature}};
}

/** Corrections must not leave the student with too many lessons, or with lessons in a course that locks again. */
function checkConsequences(context: LessonContext, status: BookingStatus, vehicles: Vehicle[]): void {
  const {lesson, studentBookings} = context;
  const vehicle = vehicles.find(({slug}) => slug === lesson.vehicleSlug);
  const counted = courseBookings(context).filter((other) => other.status === 'completed' || other.status === 'booked');

  if (status === 'completed' && counted.length + 1 > (vehicle?.lessonsRequired ?? 0)) {
    throw conflict('The student has booked this lesson again. Ask them to cancel that booking first.');
  }

  if (lesson.status === 'completed' && status !== 'completed') {
    const dependents = new Set(
      vehicles.filter(({prerequisites}) => prerequisites.includes(lesson.vehicleSlug)).map(({slug}) => slug),
    );

    if (studentBookings.some((other) => dependents.has(other.vehicleSlug) && other.status !== 'cancelled')) {
      throw conflict('The student has lessons in a course this one unlocked, so it must stay completed.');
    }
  }
}
