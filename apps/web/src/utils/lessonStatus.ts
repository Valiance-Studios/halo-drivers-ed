import type {BookingStatus} from '@hde/shared';

export const STATUS_NAMES: Record<BookingStatus, string> = {
  booked: 'Booked',
  completed: 'Completed',
  repeat: 'Needs repeat',
  missed: 'Missed',
  cancelled: 'Cancelled',
};
