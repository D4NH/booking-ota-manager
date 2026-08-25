import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db, type Booking, type Property } from '@/db';
import { PROPERTY_CONFIGS, type PropertyId } from '@/config/properties';

export const useBookingStore = defineStore('bookings', () => {
    const bookings = ref<Booking[]>([]);
    const properties = ref<Property[]>([]);
    const isLoading = ref<boolean>(false);

    const initDatabase = async (): Promise<void> => {
        isLoading.value = true;
        try {
            await loadBookings();
            await loadProperties();
        } finally {
            isLoading.value = false;
        }
    };

    const loadBookings = async (): Promise<void> => {
        bookings.value = await db.bookings.toArray();
    };

    const loadProperties = async (): Promise<void> => {
        properties.value = await db.properties.toArray();
    };

    // Import / Sync rows from a Google Sheet
    const importFromGoogleSheetRows = async (
        rows: string[][],
        targetPropertyId: PropertyId
    ): Promise<{ added: number; updated: number }> => {
        let added = 0;
        let updated = 0;

        for (const row of rows) {
            // Index mapping:
            // row[0] = Booking ID
            // row[1] = Channel / Listing
            // row[2] = Guest Name
            // row[3] = Check In
            // row[4] = Check Out & Nights fallback
            // row[6] = Payout
            // row[8] = Status
            // row[9] = Notes
            const bookingId = row[0]?.trim();
            const listingRaw = row[1]?.trim() || 'Whatsapp';
            const guestName = row[2]?.trim();
            const checkIn = row[3]?.trim();
            const checkOut = row[4]?.trim();

            if (!bookingId || !guestName || !checkIn || !checkOut) continue;

            const nights = Number(row[5]) || 1;
            const payout = Number(row[6]?.replace(/[^0-9]/g, '')) || 0;
            const statusRaw = row[8]?.trim() || 'Booked';
            const notes = row[9]?.trim();

            const validListings: Booking['listing'][] = [
                'Airbnb',
                'Booking.com',
                'Tiket.com',
                'Trip.com',
                'Whatsapp',
                'Unavailable',
            ];
            const listing = validListings.includes(listingRaw as Booking['listing'])
                ? (listingRaw as Booking['listing'])
                : 'Whatsapp';

            const validStatuses: Booking['status'][] = [
                'Booked',
                'Completed',
                'Checked-in',
                'No show',
                'Waiting for payment',
                'Waiting for payout',
                'Unavailable',
            ];
            const status = validStatuses.includes(statusRaw as Booking['status'])
                ? (statusRaw as Booking['status'])
                : 'Booked';

            const existing = await db.bookings.where('bookingId').equals(bookingId).first();

            if (existing) {
                await db.bookings.put({
                    ...existing,
                    propertyId: targetPropertyId,
                    guestName,
                    checkIn,
                    checkOut,
                    nights,
                    payout,
                    listing,
                    status,
                    notes: notes || undefined,
                });
                updated++;
            } else {
                await db.bookings.add({
                    id: crypto.randomUUID(),
                    propertyId: targetPropertyId,
                    bookingId,
                    guestName,
                    checkIn,
                    checkOut,
                    nights,
                    payout,
                    listing,
                    status,
                    notes: notes || undefined,
                    createdAt: new Date().toISOString(),
                });
                added++;
            }
        }

        await loadBookings();
        return { added, updated };
    };

    // Add local booking with optional remote Google Sheet sync
    const addBookingWithRemoteSync = async (
        bookingData: Omit<Booking, 'id' | 'createdAt'>,
        sheetsApi?: {
            appendSheetRow: (spreadsheetId: string, values: (string | number)[]) => Promise<void>;
        }
    ): Promise<Booking> => {
        const newBooking: Booking = {
            ...bookingData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };

        await db.bookings.add(newBooking);
        await loadBookings();

        const propertyId = newBooking.propertyId as PropertyId;
        const targetSpreadsheetId = PROPERTY_CONFIGS[propertyId]?.spreadsheetId;

        if (sheetsApi && targetSpreadsheetId) {
            const sheetRow = [
                newBooking.bookingId,
                newBooking.listing,
                newBooking.guestName,
                newBooking.checkIn,
                newBooking.checkOut,
                newBooking.nights,
                newBooking.payout,
                '', // row[7] unused placeholder
                newBooking.status,
                newBooking.notes || '',
            ];

            await sheetsApi.appendSheetRow(targetSpreadsheetId, sheetRow);
        }

        return newBooking;
    };

    const updateBooking = async (updatedBooking: Booking): Promise<void> => {
        await db.bookings.put(updatedBooking);
        await loadBookings();
    };

    const updateBookingWithRemoteSync = async (
        updatedBooking: Booking,
        sheetsApi?: {
            updateSheetRowByBookingId: (
                spreadsheetId: string,
                bookingId: string,
                values: (string | number)[]
            ) => Promise<void>;
        }
    ): Promise<void> => {
        // 1. Update local state using local helper
        await updateBooking(updatedBooking);

        // 2. Sync remotely if API is available
        const propertyId = updatedBooking.propertyId as PropertyId;
        const targetSpreadsheetId = PROPERTY_CONFIGS[propertyId]?.spreadsheetId;

        if (sheetsApi && targetSpreadsheetId) {
            const sheetRow = [
                updatedBooking.bookingId,
                updatedBooking.listing,
                updatedBooking.guestName,
                updatedBooking.checkIn,
                updatedBooking.checkOut,
                updatedBooking.nights,
                updatedBooking.payout,
                '',
                updatedBooking.status,
                updatedBooking.notes || '',
            ];

            await sheetsApi.updateSheetRowByBookingId(
                targetSpreadsheetId,
                updatedBooking.bookingId,
                sheetRow
            );
        }
    };

    const deleteBookingWithRemoteSync = async (
        id: string,
        bookingId: string,
        propertyId: PropertyId,
        sheetsApi?: {
            deleteSheetRowByBookingId: (spreadsheetId: string, bId: string) => Promise<void>;
        }
    ): Promise<void> => {
        await db.bookings.delete(id);
        await loadBookings();

        const targetSpreadsheetId = PROPERTY_CONFIGS[propertyId]?.spreadsheetId;

        if (sheetsApi && targetSpreadsheetId) {
            await sheetsApi.deleteSheetRowByBookingId(targetSpreadsheetId, bookingId);
        }
    };

    const deleteProperty = async (id: string): Promise<void> => {
        await db.properties.delete(id);
        await loadProperties();
    };

    const clearAllBookings = async (): Promise<void> => {
        await db.bookings.clear();
        await loadBookings();
    };

    const hasDateConflict = (
        propertyId: PropertyId,
        checkIn: string,
        checkOut: string,
        excludeBookingId?: string
    ): Booking | null => {
        if (!checkIn || !checkOut || checkIn >= checkOut) return null;

        const targetBookings = bookings.value.filter(
            (b) =>
                b.propertyId === propertyId &&
                b.status !== 'Unavailable' &&
                b.bookingId !== excludeBookingId
        );

        const conflict = targetBookings.find((b) => {
            // Overlap condition: (StartA < EndB) and (EndA > StartB)
            return checkIn < b.checkOut && checkOut > b.checkIn;
        });

        return conflict || null;
    };

    return {
        bookings,
        properties,
        isLoading,
        initDatabase,
        loadBookings,
        loadProperties,
        importFromGoogleSheetRows,
        addBookingWithRemoteSync,
        updateBookingWithRemoteSync,
        deleteBookingWithRemoteSync,
        deleteProperty,
        clearAllBookings,
        hasDateConflict,
    };
});
