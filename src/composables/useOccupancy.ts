import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

/**
 * Returns the number of properties that have at least 1 booking.
 * Properties with 0 bookings are excluded.
 */
export function getBookedPropertiesCount(bookings: Booking[], year?: number): number {
    const currentYear = new Date().getFullYear();
    const activeProperties = new Set<PropertyId>();
    const targetYear = year ?? currentYear;

    for (const b of bookings) {
        if (b.status === 'Unavailable') continue;
        if (!targetYear || !b.checkIn.startsWith(`${targetYear}`)) continue;

        if (b.checkIn < `${targetYear + 1}-01-01` && b.checkOut > `${targetYear}-01-01`) {
            activeProperties.add(b.propertyId);
        }
    }

    return activeProperties.size;
}
