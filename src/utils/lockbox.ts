// src/utils/lockbox.ts
import type { Booking } from '@/types/booking';

export interface LockboxContext {
    today: string; // 'YYYY-MM-DD'
    currentHour: number; // 0 - 23
    currentStays?: Booking[];
    todaysArrivals?: Booking[];
    todaysDepartures?: Booking[];
}

/**
 * Generates a deterministic 4-digit PIN for a specific booking.
 */
export function generatePinForBooking(booking: Booking | null | undefined): string | null {
    if (!booking) return null;

    const seed = `${booking.bookingId}_${booking.guestName}_${booking.checkIn}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }

    const pin = Math.abs(hash % 9000) + 1000;
    return pin.toString();
}

/**
 * Resolves which guest's lockbox code should be active right now:
 * - Shows the departing guest's code until they check out (or before 12:00).
 * - After 12:00 (or once checked out), switches to the incoming guest's code.
 */
export function getActiveLockboxBooking(context: LockboxContext): {
    booking: Booking | null;
    state: 'departing' | 'arriving' | 'in-house' | 'vacant';
} {
    const { currentHour, currentStays = [], todaysArrivals = [], todaysDepartures = [] } = context;

    const departingGuest = todaysDepartures[0] || null;
    const arrivingGuest = todaysArrivals[0] || null;
    const inHouseStay = currentStays[0] || null;

    if (departingGuest) {
        const hasNotCheckedOut = departingGuest.status !== 'Completed';
        if (currentHour < 12 && hasNotCheckedOut) {
            return { booking: departingGuest, state: 'departing' };
        }
    }

    if (arrivingGuest) {
        return { booking: arrivingGuest, state: 'arriving' };
    }

    if (inHouseStay) {
        return { booking: inHouseStay, state: 'in-house' };
    }

    return { booking: null, state: 'vacant' };
}

/**
 * Main helper: returns the active 4-digit PIN string directly.
 */
export function getLockboxCode(context: LockboxContext): string | null {
    const { booking } = getActiveLockboxBooking(context);
    return generatePinForBooking(booking);
}
