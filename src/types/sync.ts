import type { PropertyId } from '@/types/property';

export interface BookingChangeDiff {
    field: string;
    oldValue: unknown;
    newValue: unknown;
}

export interface SyncLogEntry {
    type: 'imported' | 'updated' | 'deleted' | 'finance';
    bookingId: string;
    guestName: string;
    propertyId: PropertyId | string;
    diffs?: BookingChangeDiff[];
}

export interface SyncResult {
    importedCount: number;
    updatedCount: number;
    deletedCount: number;
    logs: SyncLogEntry[];
}
