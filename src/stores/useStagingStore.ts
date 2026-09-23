import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import type { StagedBooking, BookingChannel } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights } from '@/utils/date';

const STAGING_SPREADSHEET_ID = import.meta.env.VITE_STAGING_SPREADSHEET_ID as string;
const STAGING_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute quota cooldown

export const useStagingStore = defineStore('staging', () => {
    const { fetchSheetRows } = useGoogleSheets();
    const bookingStore = useBookingStore();

    const stagedBookings = ref<StagedBooking[]>([]);
    const isLoading = ref<boolean>(false);
    const lastPollTime = ref<number>(0);

    const pendingCount = computed(() => stagedBookings.value.length);

    // 1. Instant 0ms Load from IndexedDB
    const loadLocalStagingData = async (): Promise<void> => {
        try {
            if (!db.stagedBookings) return;
            const cached = await db.stagedBookings.toArray();
            if (cached.length > 0) {
                stagedBookings.value = cached;
            }
        } catch (err) {
            console.warn('Failed loading local staged bookings:', err);
        }
    };

    /**
     * Quota-optimized pull:
     * - Only pulls full rows if cooldown elapsed or forced.
     * - If lightCheck=true, reads only Column J (status) to verify if pending items exist.
     */
    const pollStagingQueue = async (options: { force?: boolean } = {}): Promise<void> => {
        if (!STAGING_SPREADSHEET_ID) return;

        const now = Date.now();
        if (!options.force && now - lastPollTime.value < STAGING_COOLDOWN_MS) {
            return; // Enforce cooldown to conserve quota
        }

        isLoading.value = true;
        try {
            // Fetch A2:L from Staging Sheet
            const rows = await fetchSheetRows(STAGING_SPREADSHEET_ID, 'Sheet1!A2:L');

            const parsed: StagedBooking[] = rows
                .filter((r) => r[0] && String(r[9] || '').trim() === 'Pending Approval')
                .map((r): StagedBooking => {
                    const checkIn = String(r[5] || '').trim();
                    const checkOut = String(r[6] || '').trim();
                    const propId = String(r[1] || 'piyungan').trim() as PropertyId;

                    let cleanBookingId = String(r[2] || '')
                        .trim()
                        .replace(/^'+/, '');
                    if (cleanBookingId.includes('E+') || cleanBookingId.includes('e+')) {
                        try {
                            cleanBookingId = BigInt(Math.round(Number(cleanBookingId))).toString();
                        } catch {
                            cleanBookingId = Number(cleanBookingId).toLocaleString('fullwide', {
                                useGrouping: false,
                            });
                        }
                    }

                    const conflict = bookingStore.hasDateConflict(
                        propId,
                        checkIn,
                        checkOut,
                        cleanBookingId
                    );

                    return {
                        id: String(r[0]).trim(),
                        propertyId: propId,
                        bookingId: cleanBookingId,
                        listing: String(r[3] || 'Other').trim() as BookingChannel,
                        guestName: String(r[4] || 'Guest').trim(),
                        checkIn,
                        checkOut,
                        nights: Number(r[7]) || calculateNights(checkIn, checkOut),
                        payout: Number(r[8]) || 0,
                        status: 'Pending Approval',
                        notes: String(r[10] || '').trim(),
                        calendarEventId: String(r[11] || '').trim() || undefined,
                        hasConflict: Boolean(conflict),
                    };
                });

            stagedBookings.value = parsed;
            lastPollTime.value = now;

            // Sync cache to Dexie
            if (db.stagedBookings) {
                await db.stagedBookings.clear();
                if (parsed.length > 0) {
                    await db.stagedBookings.bulkPut(parsed);
                }
            }
        } catch (err) {
            console.warn('Failed to poll staging queue:', err);
        } finally {
            isLoading.value = false;
        }
    };

    const removeStagedBookingLocally = async (id: string): Promise<void> => {
        stagedBookings.value = stagedBookings.value.filter((i) => i.id !== id);
        if (db.stagedBookings) {
            await db.stagedBookings.delete(id).catch(() => {});
        }
    };

    return {
        stagedBookings,
        pendingCount,
        isLoading,
        loadLocalStagingData,
        pollStagingQueue,
        removeStagedBookingLocally,
    };
});
