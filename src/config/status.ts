import type { Booking } from '@/types/booking';

export const validStatuses: Booking['status'][] = [
    'Booked',
    'Checked-in',
    'Waiting for payment',
    'Waiting for payout',
    'Completed',
    'No show',
    'Unavailable',
];
