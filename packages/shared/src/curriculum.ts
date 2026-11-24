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

/** The form an instructor fills in for a booked lesson, or a student reads once it is signed off. */
export interface LessonForm {
  lesson: CourseLesson;
  results: SkillResults;
  /** Skills passed in an earlier attempt at this lesson, which stay passed. */
  passedBefore: string[];
}

/** How a lesson ended: its student came, or did not. */
export const ATTENDANCES = ['attended', 'missed'] as const;
export type Attendance = (typeof ATTENDANCES)[number];

/** The body of `PUT /api/admin/lessons/:id/results/:skillId`. Null clears the mark. */
export interface SkillMark {
  result: SkillResult | null;
  /** Marks the skill before the lesson starts, which is otherwise refused. */
  early: boolean;
}

/** The body of `PUT /api/admin/lessons/:id/sign-off`, with the whole form as it stands. */
export interface LessonSignOff {
  results: SkillResults;
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
