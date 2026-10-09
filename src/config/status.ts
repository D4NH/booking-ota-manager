import type { BookingStatus } from '@/types/booking';

export const bookingStatuses: BookingStatus[] = [
    'Booked',
    'Checked-in',
    'Checking-out',
    'Waiting for payment',
    'Waiting for payout',
    'Completed',
    'No show',
    'Unavailable',
];

export const STATUS_STYLES: Record<BookingStatus, string> = {
    Booked: 'bg-mist-800/80 text-mist-300',
    'Waiting for payment': 'bg-orange-500/15 text-orange-300',
    'Checked-in': 'bg-lime-500/15 text-lime-300',
    'Checking-out': 'bg-yellow-500/15 text-yellow-300',
    'Waiting for payout': 'bg-sky-500/15 text-sky-300',
    Completed: 'bg-green-500/20 text-green-300',
    Unavailable: 'bg-rose-500/15 text-rose-300',
    'No show': 'bg-red-500/15 text-red-300',
};

export const CALENDAR_EVENT_STYLES: Record<string, string> = {
    Booked: 'border-mist-700 bg-mist-800 hover:bg-mist-700',
    Completed: 'opacity-60 border-mist-700 bg-mist-800 hover:bg-mist-700',
    'Waiting for payment': 'border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/40',
    'Waiting for payout': 'border-sky-500/30 bg-sky-500/15 hover:bg-sky-500/40',
    'Checked-in': 'border-lime-500/30 bg-lime-500/15 hover:bg-lime-500/40',
    'No show': 'border-red-500/40 bg-red-500/10 hover:bg-red-500/40',
    Unavailable: 'border-red-500/40 bg-red-500/10 hover:bg-red-500/40',
};

export const STATUS_BASE_CLASS =
    'inline-flex items-center justify-center rounded-sm border-mist-900 border-b-2 px-1.5 pt-1 pb-1.5 text-[11px] font-medium leading-none text-nowrap capitalize translate-y-[1px]';

export const getStatusStyle = (status: BookingStatus | string, isCalendar = false): string => {
    const statusColors = STATUS_STYLES[status as BookingStatus] ?? STATUS_STYLES.Booked;
    return isCalendar ? `${CALENDAR_EVENT_STYLES[status]}` : `${STATUS_BASE_CLASS} ${statusColors}`;
};
