import type {AttendedLesson, Booking, BookingRequest} from '@hde/shared';

import {defineStore} from 'pinia';
import {api} from '@/services/api';

export interface BookingsState {
  /** The student's lessons, soonest first. */
  bookings: Booking[];
  /** Their results in the lessons they have attended, soonest first. */
  results: AttendedLesson[];
  loaded: boolean;
  errorMessage: string | null;
}

/** The signed-in student's lessons. */
export const useBookingsStore = defineStore('bookings', {
  state: (): BookingsState => ({
    bookings: [],
    results: [],
    loaded: false,
    errorMessage: null,
  }),
  actions: {
    async load(): Promise<void> {
      this.errorMessage = null;

      try {
        const [bookings, results] = await Promise.all([api.listBookings(), api.listResults()]);
        this.replaceAll(bookings);
        this.results = results;
        this.loaded = true;
      } catch (error) {
        this.errorMessage = `Could not load your lessons: ${error instanceof Error ? error.message : 'unknown error'}`;
      }
    },
    /** Throws the API's error, for the page to show. */
    async book(request: BookingRequest): Promise<Booking> {
      const booking = await api.createBooking(request);
      this.replaceAll([...this.bookings, booking]);

      return booking;
    },
    /** Throws the API's error, for the page to show. */
    async cancel(id: string): Promise<void> {
      const cancelled = await api.cancelBooking(id);
      this.replaceAll(this.bookings.map((booking) => (booking.id === id ? cancelled : booking)));
    },
    replaceAll(bookings: Booking[]): void {
      this.bookings = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },
  },
});
