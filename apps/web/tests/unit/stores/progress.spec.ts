import type {Booking, BookingStatus, Vehicle} from '@hde/shared';

import {beforeEach, describe, expect, it, vi} from 'vite-plus/test';
import {createPinia, setActivePinia} from 'pinia';
import {useBookingsStore} from '@/stores/bookings';
import {useCatalogStore} from '@/stores/catalog';
import {useProgressStore} from '@/stores/progress';

vi.mock('@/services/api', () => ({api: {}}));

const vehicle = (slug: string, ...prerequisites: string[]): Vehicle => ({
  slug,
  name: slug,
  faction: 'unsc',
  domain: 'air',
  description: '',
  lessonMinutes: 60,
  lessonsRequired: 2,
  prerequisites,
});
const lesson = (vehicleSlug: string, status: BookingStatus, lessonNumber: number | null = null): Booking => ({
  id: `${vehicleSlug}-${status}`,
  vehicleSlug,
  instructorSlug: 'arbiter',
  startsAt: '2026-06-08T12:00:00.000Z',
  endsAt: '2026-06-08T13:00:00.000Z',
  status,
  lessonNumber,
  cancelReason: null,
  signedOffAt: null,
});
const FIRST = vehicle('first');
const SECOND = vehicle('second', 'first');

describe('progress store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCatalogStore().vehicles = [FIRST, SECOND];
  });

  it('opens only courses without prerequisites to a new student', () => {
    const store = useProgressStore();

    expect(store.missingFor(FIRST)).toEqual([]);
    expect(store.missingFor(SECOND)).toEqual(['first']);
  });

  it('unlocks a course once every lesson of its prerequisite is completed', () => {
    const store = useProgressStore();
    useBookingsStore().bookings = [lesson('first', 'completed'), lesson('first', 'booked')];
    expect(store.missingFor(SECOND)).toEqual(['first']);

    useBookingsStore().bookings = [lesson('first', 'completed'), lesson('first', 'completed')];
    expect(store.missingFor(SECOND)).toEqual([]);
  });

  it('shows progress only once a lesson has been attended', () => {
    const store = useProgressStore();
    useBookingsStore().bookings = [
      lesson('first', 'booked'),
      lesson('first', 'missed'),
      lesson('second', 'completed', 1),
    ];
    expect(store.lessonsCompleted(FIRST)).toBeNull();

    useBookingsStore().bookings = [lesson('first', 'repeat', 1)];
    expect(store.lessonsCompleted(FIRST)).toBe(0);

    useBookingsStore().bookings = [lesson('first', 'repeat', 1), lesson('first', 'completed', 1)];
    expect(store.lessonsCompleted(FIRST)).toBe(1);
  });

  it('has a lesson to repeat until it is completed', () => {
    const store = useProgressStore();
    useBookingsStore().bookings = [lesson('first', 'completed', 1), lesson('first', 'repeat', 2)];
    expect(store.repeatDue(FIRST)).toBe(2);
    expect(store.repeatDue(SECOND)).toBeNull();
    expect(store.hasLessonBooked(FIRST)).toBe(false);

    useBookingsStore().bookings = [lesson('first', 'repeat', 1), lesson('first', 'completed', 1)];
    expect(store.repeatDue(FIRST)).toBeNull();
  });

  it('says how a course was completed, by its final lesson', () => {
    const store = useProgressStore();
    const final = {...lesson('first', 'completed', 2), instructorSlug: 'rtas-vadum'};
    useBookingsStore().bookings = [lesson('first', 'completed', 1), lesson('first', 'repeat', 2)];
    expect(store.completion(FIRST)).toBeNull();

    useBookingsStore().bookings = [final, lesson('first', 'completed', 1)];
    expect(store.completion(FIRST)).toEqual({instructorSlug: 'rtas-vadum', completedAt: '2026-06-08T13:00:00.000Z'});
    expect(store.completion(SECOND)).toBeNull();

    // Corrected later, then signed off before it was even due.
    useBookingsStore().bookings = [
      {...final, signedOffAt: '2026-06-20T00:00:00.000Z'},
      lesson('first', 'completed', 1),
    ];
    expect(store.completion(FIRST)?.completedAt).toBe('2026-06-08T13:00:00.000Z');

    useBookingsStore().bookings = [
      {...final, signedOffAt: '2026-06-01T00:00:00.000Z'},
      lesson('first', 'completed', 1),
    ];
    expect(store.completion(FIRST)?.completedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('counts booked and completed lessons, but not cancelled, missed or repeated ones', () => {
    const store = useProgressStore();
    useBookingsStore().bookings = [lesson('first', 'cancelled'), lesson('first', 'missed'), lesson('first', 'repeat')];
    expect(store.lessonsLeft(FIRST)).toBe(2);

    useBookingsStore().bookings = [lesson('first', 'completed'), lesson('first', 'booked')];
    expect(store.lessonsLeft(FIRST)).toBe(0);
  });
});
