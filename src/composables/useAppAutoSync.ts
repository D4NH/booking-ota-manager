import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useDocumentVisibility, useWindowFocus, useOnline } from '@vueuse/core';
import { useBookingStore } from '@/stores/useBookingStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';

const LAST_SYNC_KEY = 'app_global_last_sync';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function useAppAutoSync() {
    const bookingStore = useBookingStore();
    const { syncAllFinancialData } = useFinanceSync();
    const { fetchSheetRows, isAuthenticated, refreshAuthStatus } = useGoogleSheets();

    let ticker: ReturnType<typeof setInterval> | null = null;

    const isOnline = useOnline();
    const windowFocused = useWindowFocus();
    const visibility = useDocumentVisibility();

    const isSyncing = ref<boolean>(false);
    const lastSyncTime = ref<number>(Number(localStorage.getItem(LAST_SYNC_KEY)) || 0);
    const nowTimestamp = ref<number>(Date.now());

    const cooldownRemainingSec = computed<number>(() => {
        const elapsed = nowTimestamp.value - lastSyncTime.value;
        const diff = Math.max(0, SYNC_COOLDOWN_MS - elapsed);
        return Math.ceil(diff / 1000);
    });
    const isEligibleToAutoSync = computed<boolean>(
        () => isOnline.value && cooldownRemainingSec.value === 0
    );
    const formattedCountdown = computed<string>(() => {
        const sec = cooldownRemainingSec.value;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    });

    const shouldRevalidate = (): boolean => isOnline.value && isEligibleToAutoSync.value;
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

            const financeTask = syncAllFinancialData({
                silent: options.silent ?? true,
            });

            await Promise.all([bookingsTask, financeTask]);

            const now = Date.now();
            lastSyncTime.value = now;
            nowTimestamp.value = now;
            localStorage.setItem(LAST_SYNC_KEY, String(now));
            return true;
        } catch (err: unknown) {
            console.warn('Unified auto-sync encounter:', err);
            return false;
        } finally {
            isSyncing.value = false;
        }
    };

    onMounted(() => {
        ticker = setInterval(() => {
            nowTimestamp.value = Date.now();
        }, 1000);
    });

    onUnmounted(() => {
        if (ticker) clearInterval(ticker);
    });

    watch([windowFocused, visibility], ([focused, vis]) => {
        if (focused && vis === 'visible') {
            syncAllData({ force: false, silent: true });
        }
    });

    watch(isOnline, (online) => {
        if (online) {
            syncAllData({ force: false, silent: true });
        }
    });

    return {
        isSyncing,
        lastSyncTime,
        cooldownRemainingSec,
        isEligibleToAutoSync,
        formattedCountdown,
        syncAllData,
    };
}
