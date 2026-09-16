import type { BookingStatus } from '@/types/booking';

export const bookingStatuses: BookingStatus[] = [
    'Booked',
    'Checked-in',
    'Checking-out',
    'Waiting for payment',
    'Waiting for payout',
    'Unavailable',
    'No show',
    'Completed',
];

export const STATUS_STYLES: Record<string, string> = {
    Default: 'bg-gray-500/10 text-gray-300',
    'Waiting for payment': 'bg-amber-500/10 text-amber-300',
    'Checked-in': 'bg-lime-500/10 text-lime-300',
    'Waiting for payout': 'bg-sky-500/10 text-sky-300',
    Completed: 'bg-emerald-500/10 text-emerald-300',
    'No show': 'bg-red-500/10 text-red-300',
    Unavailable: 'bg-red-500/10 text-red-300',
};

export const CALENDAR_STATUS_STYLES: Record<string, string> = {
    Booked: 'border-mist-700 bg-mist-800 hover:bg-mist-700',
    'Waiting for payment': 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/25',
    'Waiting for payout': 'border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/40',
    'Checked-in': 'border-lime-500/40 bg-lime-500/25 hover:bg-lime-500/40',
    Completed: 'border-mist-700 bg-mist-800 hover:bg-mist-700',
    'No show': 'border-red-500/40 bg-red-500/10 hover:bg-red-500/40',
    Unavailable: 'border-red-500/40 bg-red-500/10 hover:bg-red-500/40',
};

export const STATUS_BASE_CLASS = 'rounded-sm px-1.5 py-0.5 text-xs text-nowrap';

export const getStatusStyle = (status: string, isCalendar?: boolean) => {
    const statusColors = STATUS_STYLES[status] || STATUS_STYLES.Default;

    return isCalendar
        ? `${CALENDAR_STATUS_STYLES[status]}`
        : `${STATUS_BASE_CLASS} ${statusColors}`;
};
