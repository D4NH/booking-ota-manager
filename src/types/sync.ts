import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

export interface BookingChangeDiff {
    field: keyof Booking;
    oldValue: unknown;
    newValue: unknown;
}

export interface SyncLogEntry {
    type: 'imported' | 'updated' | 'deleted';
    bookingId: string;
    guestName: string;
    propertyId: PropertyId;
    diffs?: BookingChangeDiff[];
}

export interface SyncResult {
    importedCount: number;
    updatedCount: number;
    deletedCount: number;
    logs: SyncLogEntry[];
}
