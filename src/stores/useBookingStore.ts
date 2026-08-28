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

        const VALID_LISTINGS = [
            'Airbnb',
            'Booking.com',
            'Tiket.com',
            'Trip.com',
            'Whatsapp',
            'Unavailable',
        ] as const;

        type ListingType = (typeof VALID_LISTINGS)[number];

        for (const row of rows) {
            const rawBookingId = String(row[0] || '').trim();
            const rawListing = String(row[1] || '').trim();
            const rawGuestName = String(row[2] || '').trim();
            const checkIn = String(row[3] || '').trim();
            const checkOut = String(row[4] || '').trim();

            // Skip header/summary rows or empty rows missing valid check-in / check-out dates
            if (!checkIn || !checkOut || checkIn.length < 10 || checkOut.length < 10) {
                continue;
            }

            const isUnavailable =
                rawListing === 'Unavailable' || String(row[8] || '').trim() === 'Unavailable';

            const listing: ListingType = VALID_LISTINGS.includes(rawListing as ListingType)
                ? (rawListing as ListingType)
                : isUnavailable
                  ? 'Unavailable'
                  : 'Whatsapp';

            // Provide synthetic booking ID for unavailable rows if missing
            const bookingId =
                rawBookingId || (isUnavailable ? `UNAVAILABLE-${checkIn}` : `DIRECT-${checkIn}`);

            // Provide fallback guest name for blocked periods
            const guestName = rawGuestName || (isUnavailable ? 'Unavailable' : 'Guest');

            const nights = Number(row[5]) || 1;
            const rawPayout = String(row[6] ?? '').replace(/[^0-9]/g, '');
            const payout = isUnavailable ? 0 : Number(rawPayout) || 0;

            const rawStatus = String(row[8] || '').trim();
            const status: Booking['status'] = isUnavailable
                ? 'Unavailable'
                : (rawStatus as Booking['status']) || 'Booked';

            const notes = String(row[9] || '').trim();

            // Find if booking already exists locally for this property
            const existing = bookings.value.find(
                (b) => b.bookingId === bookingId && b.propertyId === propertyId
            );

            const payload: Omit<Booking, 'id'> = {
                propertyId,
                bookingId,
                listing,
                guestName,
                checkIn,
                checkOut,
                nights,
                payout,
                status,
                notes,
                createdAt: existing?.createdAt || new Date().toISOString(),
            };

            if (existing) {
                // Update existing record in Dexie preserving its primary key
                await db.bookings.put({
                    ...payload,
                    id: existing.id,
                } as Booking);
            } else {
                // Create new record with primary key
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
