import { ref } from 'vue';
import { defineStore } from 'pinia';
import { db, type Booking } from '@/db';
import { PROPERTY_CONFIGS, type PropertyId } from '@/config/properties';

export const useBookingStore = defineStore('booking', () => {
    const bookings = ref<Booking[]>([]);

    const loadBookings = async (): Promise<void> => {
        bookings.value = await db.bookings.toArray();
    };

    const formatSheetRow = (b: Omit<Booking, 'id' | 'createdAt'>): (string | number)[] => [
        b.bookingId,
        b.listing,
        b.guestName,
        b.checkIn,
        b.checkOut,
        b.nights,
        b.payout,
        '',
        b.status,
        b.notes || '',
    ];

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

        const conflict = targetBookings.find((b) => checkIn < b.checkOut && checkOut > b.checkIn);
        return conflict || null;
    };

    // Local Actions
    const addBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> => {
        const newId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${payload.propertyId}-${payload.bookingId}-${Date.now()}`;

        const newBooking: Booking = {
            ...payload,
            id: newId,
            createdAt: new Date().toISOString(),
        };

        await db.bookings.add(newBooking);
        await loadBookings();
        return newBooking;
    };
    const updateBooking = async (updated: Booking): Promise<void> => {
        const recordToPut = { ...updated };

        if (!recordToPut.id) {
            const existing = bookings.value.find(
                (b) => b.bookingId === updated.bookingId && b.propertyId === updated.propertyId
            );
            if (existing?.id) {
                recordToPut.id = existing.id;
            } else {
                recordToPut.id =
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${updated.propertyId}-${updated.bookingId}-${Date.now()}`;
            }
        }

        await db.bookings.put(recordToPut);
        await loadBookings();
    };
    const deleteBooking = async (idOrBookingId: string): Promise<void> => {
        if (!idOrBookingId) return;

        let targetId = idOrBookingId;
        const matchByPrimary = bookings.value.find((b) => b.id === idOrBookingId);

        if (!matchByPrimary) {
            const matchByBookingId = bookings.value.find((b) => b.bookingId === idOrBookingId);
            if (matchByBookingId?.id) {
                targetId = matchByBookingId.id;
            }
        }

        await db.bookings.delete(targetId);
        await loadBookings();
    };
    const clearAllLocalBookings = async (): Promise<void> => {
        await db.bookings.clear();
        await loadBookings();
    };

    const addBookingWithRemoteSync = async (
        payload: Omit<Booking, 'id' | 'createdAt'>,
        sheetsApi: {
            appendSheetRow: (spreadsheetId: string, values: (string | number)[]) => Promise<void>;
        }
    ): Promise<void> => {
        const targetId = PROPERTY_CONFIGS[payload.propertyId as PropertyId]?.spreadsheetId;
        if (!targetId) {
            throw new Error(
                `Missing Google Sheet configuration for property: ${payload.propertyId}`
            );
        }

        await sheetsApi.appendSheetRow(targetId, formatSheetRow(payload));

        await addBooking(payload);
    };
    const updateBookingWithRemoteSync = async (
        updated: Booking,
        sheetsApi: {
            updateSheetRowByBookingId: (
                spreadsheetId: string,
                bookingId: string,
                values: (string | number)[]
            ) => Promise<void>;
        }
    ): Promise<void> => {
        const targetId = PROPERTY_CONFIGS[updated.propertyId as PropertyId]?.spreadsheetId;
        if (!targetId) {
            throw new Error(
                `Missing Google Sheet configuration for property: ${updated.propertyId}`
            );
        }

        await sheetsApi.updateSheetRowByBookingId(
            targetId,
            updated.bookingId,
            formatSheetRow(updated)
        );

        await updateBooking(updated);
    };
    const deleteBookingWithRemoteSync = async (
        booking: Booking,
        sheetsApi: {
            deleteSheetRowByBookingId: (spreadsheetId: string, bookingId: string) => Promise<void>;
        }
    ): Promise<void> => {
        const targetId = PROPERTY_CONFIGS[booking.propertyId as PropertyId]?.spreadsheetId;
        if (!targetId) {
            throw new Error(
                `Missing Google Sheet configuration for property: ${booking.propertyId}`
            );
        }

        await sheetsApi.deleteSheetRowByBookingId(targetId, booking.bookingId);

        if (booking.id) {
            await deleteBooking(booking.id);
        } else {
            await deleteBooking(booking.bookingId);
        }
    };

    const importBookingsFromGoogleSheets = async (
        propertyId: PropertyId,
        rows: (string | number)[][]
    ): Promise<number> => {
        let importedCount = 0;

        for (const row of rows) {
            const bookingId = String(row[0] || '').trim();
            const guestName = String(row[2] || '').trim();
            const checkIn = String(row[3] || '').trim();
            const checkOut = String(row[4] || '').trim();

            // Skip header or empty rows
            if (
                !bookingId ||
                bookingId.toLowerCase() === 'id' ||
                !guestName ||
                !checkIn ||
                !checkOut
            ) {
                continue;
            }

            // Find if booking already exists locally
            const existing = bookings.value.find(
                (b) => b.bookingId === bookingId && b.propertyId === propertyId
            );

            const payload: Omit<Booking, 'id'> = {
                propertyId,
                bookingId,
                listing: (row[1] as Booking['listing']) || 'Whatsapp',
                guestName,
                checkIn,
                checkOut,
                nights: Number(row[5]) || 1,
                payout: Number(String(row[6] ?? '').replace(/[^0-9]/g, '')) || 0,
                status: (row[8] as Booking['status']) || 'Booked',
                notes: String(row[9] || '').trim(),
                createdAt: existing?.createdAt || new Date().toISOString(),
            };

            if (existing) {
                // Update existing record preserving its Dexie primary key
                await db.bookings.put({
                    ...payload,
                    id: existing.id,
                } as Booking);
            } else {
                // Create new record with a fallback UUID/timestamp primary key
                const newId =
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${propertyId}-${bookingId}-${Date.now()}`;

                await db.bookings.add({
                    ...payload,
                    id: newId,
                } as Booking);
            }

            importedCount++;
        }

        await loadBookings();
        return importedCount;
    };

    return {
        bookings,
        loadBookings,
        hasDateConflict,
        addBooking,
        updateBooking,
        deleteBooking,
        clearAllLocalBookings,
        addBookingWithRemoteSync,
        updateBookingWithRemoteSync,
        deleteBookingWithRemoteSync,
        importBookingsFromGoogleSheets,
    };
});
