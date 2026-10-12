import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

export function normalizeBookingId(rawId: unknown): string {
    let clean = String(rawId ?? '')
        .trim()
        .replace(/^'+/, '');
    if (clean.includes('E+') || clean.includes('e+')) {
        try {
            clean = BigInt(Math.round(Number(clean))).toString();
        } catch {
            clean = Number(clean).toLocaleString('fullwide', { useGrouping: false });
        }
    }
    return clean;
}

export function getBookedPropertiesCount(bookings: Booking[], year?: number): number {
    const currentYear = new Date().getFullYear();
    const activeProperties = new Set<PropertyId>();
    const targetYear = year ?? currentYear;

    for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];
        if (!b || b.status === 'Unavailable') continue;
        if (!targetYear || !b.checkIn.startsWith(String(targetYear))) continue;

        if (b.checkIn < `${targetYear + 1}-01-01` && b.checkOut > `${targetYear}-01-01`) {
            activeProperties.add(b.propertyId);
        }
    }

    return activeProperties.size;
}
