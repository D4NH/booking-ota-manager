import { ref } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { Booking, BookingStatus } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import type { SyncLogEntry, SyncResult, BookingChangeDiff } from '@/types/sync';
import { calculateNights } from '@/utils/date';

export const useBookingStore = defineStore('booking', () => {
    const bookings = ref<Booking[]>([]);

    const loadBookings = async (): Promise<void> => {
        bookings.value = await db.bookings.toArray();
    };

    const formatSheetRow = (
        b: Omit<Booking, 'id' | 'createdAt'> & { calendarEventId?: string }
    ): (string | number)[] => [
        b.bookingId,
        b.listing,
        b.guestName,
        b.checkIn,
        b.checkOut,
        b.nights,
        b.payout,
        '', // Column H: Owner Payout
        b.status,
        b.notes || '',
        b.calendarEventId || '',
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
        bookings.value = [...bookings.value, newBooking];
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
            recordToPut.id =
                existing?.id || `${updated.propertyId}-${updated.bookingId}-${Date.now()}`;
        }

        await db.bookings.put(recordToPut);

        const index = bookings.value.findIndex((b) => b.id === recordToPut.id);
        if (index !== -1) {
            bookings.value[index] = recordToPut;
        } else {
            bookings.value.push(recordToPut);
        }
    };

    const deleteBooking = async (idOrBookingId: string): Promise<void> => {
        if (!idOrBookingId) return;

        const target = bookings.value.find(
            (b) => b.id === idOrBookingId || b.bookingId === idOrBookingId
        );

        const targetId = target?.id || idOrBookingId;
        await db.bookings.delete(targetId);

        bookings.value = bookings.value.filter(
            (b) => b.id !== targetId && b.bookingId !== targetId
        );
    };

    const clearAllLocalBookings = async (): Promise<void> => {
        await db.bookings.clear();
        await loadBookings();
    };

    const addBookingWithRemoteSync = async (
        payload: Omit<Booking, 'id' | 'createdAt'>,
        sheetsApi: {
            appendSheetRow: (
                spreadsheetId: string,
                values: (string | number)[],
                range?: string,
                calendarId?: string
            ) => Promise<string>;
        }
    ): Promise<void> => {
        const config = PROPERTY_CONFIGS[payload.propertyId as PropertyId];
        const targetSheetId = config?.spreadsheetId;
        const targetCalendarId = config?.calendarId;

        if (!targetSheetId || !targetSheetId.trim()) {
            throw new Error(
                `Operation rejected: Missing Google Sheets configuration for property "${payload.propertyId}".`
            );
        }

        const nights = calculateNights(payload.checkIn, payload.checkOut);
        const payloadWithNights = { ...payload, nights };

        const calendarEventId = await sheetsApi.appendSheetRow(
            targetSheetId,
            formatSheetRow(payloadWithNights),
            'A1',
            targetCalendarId || undefined
        );

        await addBooking({
            ...payloadWithNights,
            ...(calendarEventId ? { calendarEventId } : {}),
        });
    };

    const updateBookingWithRemoteSync = async (
        updated: Booking,
        sheetsApi: {
            updateSheetRowByBookingId: (
                spreadsheetId: string,
                bookingId: string,
                values: (string | number)[],
                sheetName?: string,
                calendarId?: string
            ) => Promise<void>;
        }
    ): Promise<void> => {
        const config = PROPERTY_CONFIGS[updated.propertyId as PropertyId];
        const targetSheetId = config?.spreadsheetId;
        const targetCalendarId = config?.calendarId;

        if (!targetSheetId || !targetSheetId.trim()) {
            throw new Error(
                `Operation rejected: Missing Google Sheets configuration for property "${updated.propertyId}".`
            );
        }

        const nights = calculateNights(updated.checkIn, updated.checkOut);
        const updatedWithNights = { ...updated, nights };

        await sheetsApi.updateSheetRowByBookingId(
            targetSheetId,
            updatedWithNights.bookingId,
            formatSheetRow(updatedWithNights),
            '',
            targetCalendarId || undefined
        );

        await updateBooking(updatedWithNights);
    };

    const deleteBookingWithRemoteSync = async (
        booking: Booking,
        sheetsApi: {
            deleteSheetRowByBookingId: (
                spreadsheetId: string,
                bookingId: string,
                calendarId?: string
            ) => Promise<void>;
        }
    ): Promise<void> => {
        const config = PROPERTY_CONFIGS[booking.propertyId as PropertyId];
        const targetSheetId = config?.spreadsheetId;
        const targetCalendarId = config?.calendarId;

        if (!targetSheetId || !targetSheetId.trim()) {
            throw new Error(
                `Operation rejected: Missing Google Sheets configuration for property "${booking.propertyId}".`
            );
        }

        // Clear row from Google Sheets first
        await sheetsApi.deleteSheetRowByBookingId(
            targetSheetId,
            booking.bookingId,
            targetCalendarId || undefined
        );

        // Remove from local Dexie only after remote confirms deletion
        if (booking.id) {
            await deleteBooking(booking.id);
        } else {
            await deleteBooking(booking.bookingId);
        }
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

    /**
     * Imports and synchronizes bookings from Google Sheets rows into local Dexie database.
     */
    const importBookingsFromGoogleSheets = async (
        propertyId: PropertyId,
        rows: (string | number)[][]
    ): Promise<SyncResult> => {
        let importedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;
        const logs: SyncLogEntry[] = [];
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
            if (b.propertyId === propertyId) existingMap.set(b.bookingId, b);
        });

        const recordsToPut: Booking[] = [];

        for (const row of rows) {
            const rawBookingId = String(row[0] || '').trim();
            const rawListing = String(row[1] || '').trim();
            const rawGuestName = String(row[2] || '').trim();
            const checkIn = String(row[3] || '').trim();
            const checkOut = String(row[4] || '').trim();

            if (!checkIn || !checkOut || checkIn.length < 10 || checkOut.length < 10) continue;

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
            const calendarEventId = String(row[10] || '').trim();

            const existing = existingMap.get(bookingId);
            const payload: Booking & { calendarEventId?: string } = {
                id: existing?.id || `${propertyId}-${bookingId}`,
                propertyId,
                bookingId,
                listing,
                guestName,
                checkIn,
                checkOut,
                nights,
                payout,
                status,
                notes: notes || undefined,
                calendarEventId: calendarEventId || undefined, // Preserves Google Calendar link
                createdAt: existing?.createdAt || new Date().toISOString(),
            };

            recordsToPut.push(payload);

            if (!existing) {
                importedCount++;
                logs.push({
                    type: 'imported',
                    bookingId,
                    guestName,
                    propertyId,
                });
            } else {
                // Normalized field-by-field diff comparison
                const diffs: BookingChangeDiff[] = [];

                if (payload.guestName !== existing.guestName) {
                    diffs.push({
                        field: 'guestName',
                        oldValue: existing.guestName,
                        newValue: payload.guestName,
                    });
                }
                if (payload.checkIn !== existing.checkIn) {
                    diffs.push({
                        field: 'checkIn',
                        oldValue: existing.checkIn,
                        newValue: payload.checkIn,
                    });
                }
                if (payload.checkOut !== existing.checkOut) {
                    diffs.push({
                        field: 'checkOut',
                        oldValue: existing.checkOut,
                        newValue: payload.checkOut,
                    });
                }
                if (payload.listing !== existing.listing) {
                    diffs.push({
                        field: 'listing',
                        oldValue: existing.listing,
                        newValue: payload.listing,
                    });
                }
                if (Number(payload.payout) !== Number(existing.payout)) {
                    diffs.push({
                        field: 'payout',
                        oldValue: existing.payout,
                        newValue: payload.payout,
                    });
                }
                if (Number(payload.nights) !== Number(existing.nights)) {
                    diffs.push({
                        field: 'nights',
                        oldValue: existing.nights,
                        newValue: payload.nights,
                    });
                }
                if (payload.status !== existing.status) {
                    diffs.push({
                        field: 'status',
                        oldValue: existing.status,
                        newValue: payload.status,
                    });
                }
                if ((payload.notes || '') !== (existing.notes || '')) {
                    diffs.push({
                        field: 'notes',
                        oldValue: existing.notes || '',
                        newValue: payload.notes || '',
                    });
                }

                if (diffs.length > 0) {
                    updatedCount++;
                    logs.push({
                        type: 'updated',
                        bookingId,
                        guestName: payload.guestName,
                        propertyId,
                        diffs,
                    });
                }
            }
        }

        if (recordsToPut.length > 0) {
            await db.bookings.bulkPut(recordsToPut);
        }

        if (processedBookingIds.size > 0) {
            const localDbBookings = await db.bookings
                .where('propertyId')
                .equals(propertyId)
                .toArray();

            // Detect active operational year from imported rows (fallback to current year)
            const activeYear =
                minCheckIn !== '9999-12-31'
                    ? minCheckIn.slice(0, 4)
                    : new Date().getFullYear().toString();

            // Only purge deleted bookings from the active operational year so historical years remain preserved
            const staleBookings = localDbBookings.filter(
                (b) => b.checkIn.startsWith(activeYear) && !processedBookingIds.has(b.bookingId)
            );
            if (staleBookings.length > 0) {
                const staleIds = staleBookings.map((b) => b.id);
                await db.bookings.bulkDelete(staleIds);
                deletedCount = staleIds.length;

                staleBookings.forEach((b) => {
                    logs.push({
                        type: 'deleted',
                        bookingId: b.bookingId,
                        guestName: b.guestName,
                        propertyId,
                    });
                });
            }
        }

        await loadBookings();
        return { importedCount, updatedCount, deletedCount, logs };
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
