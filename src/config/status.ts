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

export const STATUS_STYLES: Record<BookingStatus | 'Default', string> = {
    Booked: 'bg-mist-800/80 text-mist-300 ',
    'Waiting for payment': 'bg-orange-500/15 text-orange-300 ',
    'Checked-in': 'bg-lime-500/15 text-lime-300',
    'Checking-out': 'bg-yellow-500/15 text-yellow-300',
    'Waiting for payout': 'bg-sky-500/15 text-sky-300',
    Completed: 'bg-green-500/20 text-green-300',
    Unavailable: 'bg-rose-500/15 text-rose-300 ',
    'No show': 'bg-red-500/15 text-red-300 ',
    Default: 'bg-zinc-800/80 text-zinc-400',
};

export const CALENDAR_EVENT_STYLES: Record<string, string> = {
    Booked: 'border-mist-700 bg-mist-800 hover:bg-mist-700',
    Completed: 'opacity-60 border-mist-700 bg-mist-800 hover:bg-mist-700',
    'Waiting for payment': 'bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/40',
    'Waiting for payout': 'bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/40',
    'Checked-in': 'bg-lime-500/15 border border-lime-500/30 hover:bg-lime-500/40',
    'No show': 'border-red-500/40 bg-red-500/10 hover:bg-red-500/40',
    Unavailable: 'border-red-500/40 bg-red-500/10 hover:bg-red-500/40',
};

export const STATUS_BASE_CLASS = 'rounded-sm px-1.5 py-0.5 text-xs text-nowrap';

export const getStatusStyle = (status: BookingStatus | string, isCalendar = false): string => {
    const statusColors = STATUS_STYLES[status as BookingStatus] ?? STATUS_STYLES.Default;
    return isCalendar ? `${CALENDAR_EVENT_STYLES[status]}` : `${STATUS_BASE_CLASS} ${statusColors}`;
};
