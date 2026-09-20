import { ref, watch } from 'vue';
import { useDocumentVisibility, useWindowFocus, useOnline } from '@vueuse/core';
import { useBookingStore } from '@/stores/useBookingStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';

const LAST_SYNC_KEY = 'app_global_last_sync';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes revalidation threshold

export function useAppAutoSync() {
    const bookingStore = useBookingStore();
    const { syncAllFinancialData } = useFinanceSync();
    const { fetchSheetRows, isAuthenticated, refreshAuthStatus } = useGoogleSheets();

    const isSyncing = ref<boolean>(false);
    const lastSyncTime = ref<number>(Number(localStorage.getItem(LAST_SYNC_KEY)) || 0);

    const isOnline = useOnline();
    const windowFocused = useWindowFocus();
    const visibility = useDocumentVisibility();

    const shouldRevalidate = (): boolean => {
        if (!isOnline.value) return false;
        return Date.now() - lastSyncTime.value > SYNC_COOLDOWN_MS;
    };

    /**
     * Pulls latest bookings across all properties and synchronizes all financial
     * ledgers (including property finances, personal transactions, shared costs,
     * transfers, gold assets, and recurring templates).
     */
    const syncAllData = async (
        options: { force?: boolean; silent?: boolean } = {}
    ): Promise<boolean> => {
        if (isSyncing.value) return false;

        const authenticated = refreshAuthStatus() || isAuthenticated.value;
        if (!authenticated) return false;

        if (!options.force && !shouldRevalidate()) {
            return false;
        }

        isSyncing.value = true;
        try {
            const propertyIds = Object.keys(PROPERTY_CONFIGS) as PropertyId[];

            // Sync Bookings across all configured property sheets
            const bookingsTask = Promise.all(
                propertyIds.map(async (propId) => {
                    const spreadsheetId = PROPERTY_CONFIGS[propId]?.spreadsheetId;
                    if (!spreadsheetId) return;

                    const rows = await fetchSheetRows(spreadsheetId, 'A2:J');
                    if (rows && rows.length > 0) {
                        await bookingStore.importBookingsFromGoogleSheets(propId, rows);
                    }
                })
            );

            // Sync Financial (Silent during auto-revalidation, toastflow when forced)
            const financeTask = syncAllFinancialData({
                silent: options.silent ?? true,
            });

            await Promise.all([bookingsTask, financeTask]);

            const now = Date.now();
            lastSyncTime.value = now;
            localStorage.setItem(LAST_SYNC_KEY, String(now));
            return true;
        } catch (err: unknown) {
            console.warn('Unified auto-sync encounter:', err);
            return false;
        } finally {
            isSyncing.value = false;
        }
    };

    // Auto-revalidate when returning to the browser window or tab
    watch([windowFocused, visibility], ([focused, vis]) => {
        if (focused && vis === 'visible') {
            syncAllData({ force: false, silent: true });
        }
    });

    // Auto-revalidate when device recovers internet connectivity
    watch(isOnline, (online) => {
        if (online) {
            syncAllData({ force: false, silent: true });
        }
    });

    return {
        isSyncing,
        lastSyncTime,
        syncAllData,
    };
}
