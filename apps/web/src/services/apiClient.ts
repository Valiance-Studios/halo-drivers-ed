import type {
  AdminLesson,
  ApiErrorBody,
  AttendedLesson,
  ApiErrorCode,
  Booking,
  BookingRequest,
  CourseLesson,
  DemoSession,
  Instructor,
  InstructorForm,
  LessonForm,
  LessonNotes,
  LessonSignOff,
  LessonSlot,
  Me,
  NotesRequest,
  RescheduleRequest,
  SignOffScope,
  SkillMark,
  TimeOff,
  TimeOffAnswer,
  TimeOffRequest,
  Vehicle,
} from '@hde/shared';

import {APP_CHECK_HEADER} from '@hde/shared';

/** Supplies the tokens each request carries. Null means there is none to send. */
export interface TokenSource {
  idToken(): Promise<string | null>;
  appCheckToken(): Promise<string | null>;
}

/** A failed API request, with the API's error code when it sent one. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | null;

  constructor(status: number, code: ApiErrorCode | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof (value as ApiErrorBody | null)?.error?.code === 'string';
}

/** The app's only way to reach the API (served under /api on the same origin). */
export class ApiClient {
  private readonly tokens: TokenSource;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(tokens: TokenSource, baseUrl = '/api', fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.tokens = tokens;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
  }

  getMe(): Promise<Me> {
    return this.get('/me');
  }

  /** For anonymous accounts: starts a demo if there is room. */
  startDemo(): Promise<DemoSession> {
    return this.post('/demo-sessions');
  }

  async endDemo(): Promise<void> {
    await this.send('/demo-sessions', {method: 'DELETE'});
  }

  listVehicles(): Promise<Vehicle[]> {
    return this.get('/vehicles');
  }

  listInstructors(): Promise<Instructor[]> {
    return this.get('/instructors');
  }

  listSlots(vehicleSlug: string, instructorSlug: string): Promise<LessonSlot[]> {
    const query = new URLSearchParams({vehicle: vehicleSlug, instructor: instructorSlug});

    return this.get(`/slots?${query}`);
  }

  listBookings(): Promise<Booking[]> {
    return this.get('/bookings');
  }

  createBooking(request: BookingRequest): Promise<Booking> {
    return this.post('/bookings', request);
  }

  /** The times a booked lesson can be moved to. */
  listRescheduleSlots(id: string, instructorSlug: string): Promise<LessonSlot[]> {
    return this.get(`/bookings/${encodeURIComponent(id)}/slots?${new URLSearchParams({instructor: instructorSlug})}`);
  }

  rescheduleBooking(id: string, request: RescheduleRequest): Promise<Booking> {
    return this.post(`/bookings/${encodeURIComponent(id)}/reschedule`, request);
  }

  cancelBooking(id: string): Promise<Booking> {
    return this.post(`/bookings/${encodeURIComponent(id)}/cancel`);
  }

  listCurriculum(): Promise<CourseLesson[]> {
    return this.get('/curriculum');
  }

  /** The student's own results in every lesson they have attended. */
  listResults(): Promise<AttendedLesson[]> {
    return this.get('/results');
  }

  /** The student's own results in a lesson that has been signed off. */
  getResults(id: string): Promise<LessonForm> {
    return this.get(`/bookings/${encodeURIComponent(id)}/form`);
  }

  /** For signing off: one instructor's lessons, or every instructor's. */
  listLessons(scope: SignOffScope, instructorSlug: string | null): Promise<AdminLesson[]> {
    return this.get(
      `/${scope}/lessons${instructorSlug ? `?${new URLSearchParams({instructor: instructorSlug})}` : ''}`,
    );
  }

  getLesson(scope: SignOffScope, id: string): Promise<AdminLesson> {
    return this.get(`/${scope}/lessons/${encodeURIComponent(id)}`);
  }

  getLessonForm(scope: SignOffScope, id: string): Promise<InstructorForm> {
    return this.get(`/${scope}/lessons/${encodeURIComponent(id)}/form`);
  }

  /** Saves one skill's mark; null clears it. */
  markSkill(scope: SignOffScope, id: string, skillId: string, mark: SkillMark): Promise<SkillMark> {
    return this.put(`/${scope}/lessons/${encodeURIComponent(id)}/results/${encodeURIComponent(skillId)}`, mark);
  }

  saveNotes(scope: SignOffScope, id: string, request: NotesRequest): Promise<LessonNotes> {
    return this.put(`/${scope}/lessons/${encodeURIComponent(id)}/notes`, request);
  }

  /** Cancels a lesson on its instructor's behalf. */
  cancelLesson(scope: SignOffScope, id: string, reason: string): Promise<AdminLesson> {
    return this.put(`/${scope}/lessons/${encodeURIComponent(id)}/cancel`, {reason});
  }

  listTimeOff(instructorSlug: string): Promise<TimeOff[]> {
    return this.get(`/admin/instructors/${encodeURIComponent(instructorSlug)}/time-off`);
  }

  addTimeOff(instructorSlug: string, request: TimeOffRequest): Promise<TimeOffAnswer> {
    return this.post(`/admin/instructors/${encodeURIComponent(instructorSlug)}/time-off`, request);
  }

  async removeTimeOff(id: string): Promise<void> {
    await this.send(`/admin/time-off/${encodeURIComponent(id)}`, {method: 'DELETE'});
  }

  signOffLesson(scope: SignOffScope, id: string, signOff: LessonSignOff): Promise<AdminLesson> {
    return this.put(`/${scope}/lessons/${encodeURIComponent(id)}/sign-off`, signOff);
  }

  private get<T>(path: string): Promise<T> {
    return this.send(path);
  }

  private post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.send(path, {method: 'POST', body: JSON.stringify(body)});
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return this.send(path, {method: 'PUT', body: JSON.stringify(body)});
  }

  private async send<T>(path: string, init: {method?: string; body?: string} = {}): Promise<T> {
    const [idToken, appCheckToken] = await Promise.all([this.tokens.idToken(), this.tokens.appCheckToken()]);
    const headers: Record<string, string> = {Accept: 'application/json'};

    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    if (appCheckToken) {
      headers[APP_CHECK_HEADER] = appCheckToken;
    }

    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {...init, headers});
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw isApiErrorBody(body)
        ? new ApiRequestError(response.status, body.error.code, body.error.message)
        : new ApiRequestError(response.status, null, `The server responded with ${response.status}.`);
    }

    return body as T;
  }
}
