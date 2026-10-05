import { ref, computed, watch } from 'vue';
import { useDocumentVisibility, useWindowFocus, useOnline } from '@vueuse/core';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useStagingStore } from '@/stores/useStagingStore';
import type { PropertyId } from '@/types/property';
import type { SyncLogEntry } from '@/types/sync';

const LAST_SYNC_KEY = 'app_global_last_sync';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

const isSyncing = ref<boolean>(false);
const lastSyncTime = ref<number>(Number(localStorage.getItem(LAST_SYNC_KEY)) || 0);
const nowTimestamp = ref<number>(Date.now());
const lastSyncLogs = ref<SyncLogEntry[]>([]);
let hasInitialSynced = false;
let globalTickerStarted = false;

export interface SyncOptions {
    force?: boolean;
    silent?: boolean;
    scope?: 'all' | 'bookings' | 'finance';
    propertyId?: PropertyId | 'all';
}

export function useAppAutoSync() {
    const bookingStore = useBookingStore();
    const stagingStore = useStagingStore();
    const { syncAllFinancialData } = useFinanceSync();
    const { fetchSheetRows, isAuthenticated, refreshAuthStatus } = useGoogleSheets();

    const isOnline = useOnline();
    const windowFocused = useWindowFocus();
    const visibility = useDocumentVisibility();

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

    if (!globalTickerStarted && typeof window !== 'undefined') {
        setInterval(() => {
            nowTimestamp.value = Date.now();

            if (isEligibleToAutoSync.value && !isSyncing.value && visibility.value === 'visible') {
                syncAllData({ force: false, silent: true });
            }
        }, 1000);
        globalTickerStarted = true;
    }

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

    function shouldRevalidate(): boolean {
        return isOnline.value && isEligibleToAutoSync.value;
    }
    async function syncAllData(options: SyncOptions = {}): Promise<{
        success: boolean;
        totalImported: number;
        totalUpdated: number;
        totalDeleted: number;
        logs: SyncLogEntry[];
    }> {
        const result = {
            success: false,
            totalImported: 0,
            totalUpdated: 0,
            totalDeleted: 0,
            logs: [] as SyncLogEntry[],
        };

        if (isSyncing.value) return result;

        const authenticated = refreshAuthStatus() || isAuthenticated.value;
        if (!authenticated) return result;

        if (!options.force && !shouldRevalidate()) {
            return result;
        }

        isSyncing.value = true;
        const currentYear = new Date().getFullYear();

        try {
            const scope = options.scope || 'all';
            const tasks: Promise<unknown>[] = [];

            // Sync Bookings
            if (scope === 'all' || scope === 'bookings') {
                const targetProperties: PropertyId[] =
                    options.propertyId && options.propertyId !== 'all'
                        ? [options.propertyId]
                        : (Object.keys(PROPERTY_CONFIGS) as PropertyId[]);

                const syncYears =
                    options.force || !hasInitialSynced
                        ? [2025, currentYear, currentYear + 1]
                        : [currentYear, currentYear + 1];

                const bookingsTask = Promise.all(
                    targetProperties.flatMap((propId) => {
                        const config = PROPERTY_CONFIGS[propId];
                        if (!config) return [];

                        return syncYears.map(async (year) => {
                            const sheetId =
                                config.spreadsheetIds?.[year] ||
                                (year === 2026 ? config.spreadsheetId : undefined);

                            // Skip unconfigured spreadsheets
                            if (!sheetId || !sheetId.trim()) return;

                            const rows = await fetchSheetRows(sheetId, 'A2:K');
                            if (rows && rows.length > 0) {
                                const stats = await bookingStore.importBookingsFromGoogleSheets(
                                    propId,
                                    rows
                                );
                                result.totalImported += stats.importedCount;
                                result.totalUpdated += stats.updatedCount;
                                result.totalDeleted += stats.deletedCount;
                                result.logs.push(...stats.logs);
                            }
                        });
                    })
                );

                tasks.push(bookingsTask);
            }

            // Sync Finances
            if (scope === 'all' || scope === 'finance') {
                tasks.push(
                    syncAllFinancialData({ silent: options.silent ?? true }).then(() => {
                        result.logs.push({
                            type: 'finance',
                            bookingId: 'FINANCE-SYNC',
                            guestName: 'Ledgers Synchronized',
                            propertyId: 'Keuangan 2026',
                        });
                    })
                );
            }

            // Poll Staging Queue
            if (scope === 'all') {
                tasks.push(stagingStore.pollStagingQueue({ force: options.force }));
            }

            await Promise.all(tasks);

            const now = Date.now();
            lastSyncTime.value = now;
            hasInitialSynced = true;
            localStorage.setItem(LAST_SYNC_KEY, String(now));
            lastSyncLogs.value = [...result.logs];
            result.success = true;
            return result;
        } catch (err: unknown) {
            console.warn('Auto-sync encounter error:', err);
            return result;
        } finally {
            isSyncing.value = false;
        }
    }

    return {
        isSyncing,
        lastSyncTime,
        lastSyncLogs,
        cooldownRemainingSec,
        isEligibleToAutoSync,
        formattedCountdown,
        syncAllData,
    };
}
