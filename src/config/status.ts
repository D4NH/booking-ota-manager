import type { BookingStatus } from '@/types/booking';

export const bookingStatuses: BookingStatus[] = [
    'Booked',
    'Waiting for payment',
    'Waiting for payout',
    'No show',
    'Completed',
];

export const STATUS_STYLES: Record<string, string> = {
    Unknown: 'bg-gray-500/10 text-gray-300', // Default fallback
    'Waiting for payment': 'bg-amber-500/10 text-amber-300',
    'Checked-in': 'bg-lime-500/10 text-lime-300',
    'Waiting for payout': 'bg-sky-500/10 text-sky-300',
    Completed: 'bg-emerald-500/10 text-emerald-300',
    'No show': 'bg-red-500/10 text-red-300',
    Unavailable: 'bg-red-500/10 text-red-300',
};

export const STATUS_BASE_CLASS = 'rounded px-2 py-0.5 text-xs text-nowrap';

export const getStatusStyle = (status: string) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Unknown;
    return `${STATUS_BASE_CLASS} ${style}`;
};
