import { ref } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { Booking, BookingStatus } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights } from '@/utils/date';

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

    const addBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> => {
        const newId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${payload.propertyId}-${payload.bookingId}-${Date.now()}`;

        const calculatedNights = calculateNights(payload.checkIn, payload.checkOut);

        const newBooking: Booking = {
            ...payload,
            nights: calculatedNights,
            id: newId,
            createdAt: new Date().toISOString(),
        };

        await db.bookings.add(newBooking);
        await loadBookings();
        return newBooking;
    };

    const updateBooking = async (updated: Booking): Promise<void> => {
        const recordToPut = {
            ...updated,
            nights: calculateNights(updated.checkIn, updated.checkOut),
        };

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

        const nights = calculateNights(payload.checkIn, payload.checkOut);
        const payloadWithNights = { ...payload, nights };

        await sheetsApi.appendSheetRow(targetId, formatSheetRow(payloadWithNights));
        await addBooking(payloadWithNights);
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

        const nights = calculateNights(updated.checkIn, updated.checkOut);
        const updatedWithNights = { ...updated, nights };

        await sheetsApi.updateSheetRowByBookingId(
            targetId,
            updatedWithNights.bookingId,
            formatSheetRow(updatedWithNights)
        );
        await updateBooking(updatedWithNights);
    };

    const updateBookingStatusWithSync = async (
        booking: Booking,
        newStatus: BookingStatus,
        sheetsApi: Parameters<typeof updateBookingWithRemoteSync>[1]
    ): Promise<void> => {
        const updatedBooking: Booking = {
            ...booking,
            status: newStatus,
        };

        await updateBookingWithRemoteSync(updatedBooking, sheetsApi);
    };

    const markBookingComplete = async (
        booking: Booking,
        sheetsApi: Parameters<typeof updateBookingWithRemoteSync>[1]
    ): Promise<void> => {
        await updateBookingStatusWithSync(booking, 'Completed', sheetsApi);
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

    /**
     * Imports and synchronizes bookings from Google Sheets rows into local Dexie database.
     */
    const importBookingsFromGoogleSheets = async (
        propertyId: PropertyId,
        rows: (string | number)[][]
    ): Promise<{ importedCount: number; updatedCount: number; deletedCount: number }> => {
        let importedCount = 0;
        let updatedCount = 0;
        const processedBookingIds = new Set<string>();

        const VALID_LISTINGS = [
            'Airbnb',
            'Booking.com',
            'Tiket.com',
            'Trip.com',
            'Whatsapp',
            'Unavailable',
        ] as const;

        type ListingType = (typeof VALID_LISTINGS)[number];

        let minCheckIn = '9999-12-31';
        let maxCheckIn = '0000-01-01';

        const existingMap = new Map<string, Booking>();
        bookings.value.forEach((b) => {
            if (b.propertyId === propertyId) {
                existingMap.set(b.bookingId, b);
            }
        });

        const recordsToPut: Booking[] = [];

        for (const row of rows) {
            const rawBookingId = String(row[0] || '').trim();
            const rawListing = String(row[1] || '').trim();
            const rawGuestName = String(row[2] || '').trim();
            const checkIn = String(row[3] || '').trim();
            const checkOut = String(row[4] || '').trim();

            if (!checkIn || !checkOut || checkIn.length < 10 || checkOut.length < 10) {
                continue;
            }

            if (checkIn < minCheckIn) minCheckIn = checkIn;
            if (checkIn > maxCheckIn) maxCheckIn = checkIn;

            const isUnavailable =
                rawListing === 'Unavailable' || String(row[8] || '').trim() === 'Unavailable';

            const listing: ListingType = VALID_LISTINGS.includes(rawListing as ListingType)
                ? (rawListing as ListingType)
                : isUnavailable
                  ? 'Unavailable'
                  : 'Whatsapp';

            const bookingId =
                rawBookingId ||
                (isUnavailable
                    ? `UNAVAILABLE-${checkIn}_${checkOut}`
                    : `DIRECT-${checkIn}_${checkOut}`);

            processedBookingIds.add(bookingId);

            const guestName = rawGuestName || (isUnavailable ? 'Unavailable' : 'Guest');

            const nights = calculateNights(checkIn, checkOut);

            const rawPayout = String(row[6] ?? '').replace(/[^0-9]/g, '');
            const payout = isUnavailable ? 0 : Number(rawPayout) || 0;

            const rawStatus = String(row[8] || '').trim();
            const status: Booking['status'] = isUnavailable
                ? 'Unavailable'
                : (rawStatus as Booking['status']) || 'Booked';

            const notes = String(row[9] || '').trim();

            const existing = existingMap.get(bookingId);

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

            const fallbackId = existing?.id || `${propertyId}-${bookingId}`;

            recordsToPut.push({
                ...payload,
                id: fallbackId,
            } as Booking);

            if (!existing) {
                importedCount++;
            } else if (
                payload.status !== existing.status ||
                payload.guestName !== existing.guestName ||
                payload.payout !== existing.payout ||
                payload.nights !== existing.nights
            ) {
                updatedCount++;
            }
        }

        if (recordsToPut.length > 0) {
            await db.bookings.bulkPut(recordsToPut);
        }

        let deletedCount = 0;

        if (processedBookingIds.size > 0) {
            const localDbBookings = await db.bookings
                .where('propertyId')
                .equals(propertyId)
                .filter((b) => b.checkIn >= minCheckIn && b.checkIn <= maxCheckIn)
                .toArray();

            const staleBookings = localDbBookings.filter(
                (b) => !processedBookingIds.has(b.bookingId)
            );

            if (staleBookings.length > 0) {
                const staleIds = staleBookings.map((b) => b.id);
                await db.bookings.bulkDelete(staleIds);
                deletedCount = staleIds.length;
            }
        }

        await loadBookings();

        return { importedCount, updatedCount, deletedCount };
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
        updateBookingStatusWithSync,
        markBookingComplete,
        deleteBookingWithRemoteSync,
        importBookingsFromGoogleSheets,
    };
});
