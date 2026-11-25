import type {BookingStatus} from './bookings.ts';

/** One of a course's lessons, in order, and the skills its instructor marks. */
export interface CourseLesson {
  vehicleSlug: string;
  /** 1 for the course's first lesson. */
  number: number;
  title: string;
  skills: Skill[];
}

export interface Skill {
  /** Unique within its lesson. */
  id: string;
  label: string;
}

export const SKILL_RESULTS = ['pass', 'fail'] as const;
export type SkillResult = (typeof SKILL_RESULTS)[number];

/** Results by skill id; a skill not marked yet is left out. */
export type SkillResults = Record<string, SkillResult>;

/** The longest a note can be. */
export const NOTE_MAX_LENGTH = 1000;

/** An instructor's notes on a lesson; empty if there are none. */
export interface LessonNotes {
  /** The student reads this with their results. */
  student: string;
  /** Only for instructors: never sent to the student. */
  private: string;
}

/** A lesson's form as its student reads it, once it is signed off. */
export interface LessonForm {
  lesson: CourseLesson;
  results: SkillResults;
  /** Skills passed in an earlier attempt at this lesson, which stay passed. */
  passedBefore: string[];
  studentNote: string;
}

/** One of the student's earlier lessons in the same course, signed off. */
export interface PastLesson {
  id: string;
  instructorSlug: string;
  startsAt: string;
  status: BookingStatus;
  /** Null if it was missed. */
  lesson: CourseLesson | null;
  results: SkillResults;
  notes: LessonNotes;
}

/** The form an instructor fills in for a lesson. */
export interface InstructorForm extends LessonForm {
  privateNote: string;
  /** Latest first. */
  history: PastLesson[];
}

/** A student's own results in a lesson they attended, from `GET /api/results`. */
export interface AttendedLesson {
  bookingId: string;
  vehicleSlug: string;
  lessonNumber: number;
  status: BookingStatus;
  startsAt: string;
  results: SkillResults;
}

/** How a lesson ended: its student came, or did not. */
export const ATTENDANCES = ['attended', 'missed'] as const;
export type Attendance = (typeof ATTENDANCES)[number];

/**
 * Whose lessons an account signs off, and so the API's path for them: admins everyone's, and demo guests only
 * their own.
 */
export const SIGN_OFF_SCOPES = ['admin', 'demo'] as const;
export type SignOffScope = (typeof SIGN_OFF_SCOPES)[number];

/** The body of `PUT /api/:scope/lessons/:id/results/:skillId`. Null clears the mark. */
export interface SkillMark {
  result: SkillResult | null;
  /** Marks the skill before the lesson starts, which is otherwise refused. */
  early: boolean;
}

/** The body of `PUT /api/:scope/lessons/:id/notes`. */
export interface NotesRequest {
  notes: LessonNotes;
  /** Saves them before the lesson starts, which is otherwise refused. */
  early: boolean;
}

/** The body of `PUT /api/:scope/lessons/:id/sign-off`, with the whole form as it stands. */
export interface LessonSignOff {
  results: SkillResults;
  notes: LessonNotes;
  attendance: Attendance;
  /** Signs the lesson off before it ends, which is otherwise refused. */
  early: boolean;
}

/** Whether a lesson's every skill has been passed. */
export function allPassed(lesson: CourseLesson, results: SkillResults): boolean {
  return lesson.skills.every(({id}) => results[id] === 'pass');
}

/** Whether a lesson's every skill has been marked. */
export function allMarked(lesson: CourseLesson, results: SkillResults): boolean {
  return lesson.skills.every(({id}) => results[id] !== undefined);
}
