<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useAppAutoSync } from '@/composables/useAppAutoSync';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';
import type { SyncLogEntry } from '@/types/sync';
import { toast } from 'vue-toastflow';

interface Props {
    scope?: 'all' | 'bookings' | 'finance';
    propertyId?: PropertyId | 'all';
    showTimer?: boolean;
}

const { scope = 'all', propertyId = 'all', showTimer = false } = defineProps<Props>();

const bookingStore = useBookingStore();
const financeStore = useFinanceStore();
const { isAuthenticated, refreshAuthStatus, initAuth, fetchSheetRows } = useGoogleSheets();
const { isEligibleToAutoSync, formattedCountdown, lastSyncTime } = useAppAutoSync();

const isSyncing = ref(false);
const showLogModal = ref(false);
const syncLogs = ref<SyncLogEntry[]>([]);

const buttonLabel = computed(() => {
    if (isSyncing.value) return 'Syncing...';
    if (!isAuthenticated.value) return 'Connect & Sync';
    if (scope === 'finance') return 'Sync Finances';
    if (scope === 'bookings')
        return propertyId !== 'all'
            ? `Sync ${propertyId.replace(/^./, (match) => match.toUpperCase())}`
            : 'Sync Bookings';
    return 'Sync All';
});

onMounted(() => {
    refreshAuthStatus();
    window.addEventListener('focus', refreshAuthStatus);
});

async function handleSync(): Promise<void> {
    if (isSyncing.value) return;

    refreshAuthStatus();
    if (!isAuthenticated.value) {
        try {
            await initAuth();
        } catch (authErr) {
            console.warn('[Sync] Auth aborted or failed:', authErr);
            return;
        }
    }

    isSyncing.value = true;
    syncLogs.value = [];

    const tasks: Promise<unknown>[] = [];
    let totalImported = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;

    if (scope === 'all' || scope === 'bookings') {
        const targetProperties: PropertyId[] =
            propertyId === 'all' ? (Object.keys(PROPERTY_CONFIGS) as PropertyId[]) : [propertyId];

        tasks.push(
            (async () => {
                for (const id of targetProperties) {
                    const config = PROPERTY_CONFIGS[id];
                    const spreadsheetId = config?.spreadsheetId;
                    if (!spreadsheetId?.trim()) continue;

                    const range = config.defaultRange || 'A2:J';
                    const rows = await fetchSheetRows(spreadsheetId, range);
                    if (!rows || rows.length === 0) continue;

                    const stats = await bookingStore.importBookingsFromGoogleSheets(id, rows);
                    totalImported += stats.importedCount;
                    totalUpdated += stats.updatedCount;
                    totalDeleted += stats.deletedCount;
                    syncLogs.value.push(...stats.logs);
                }
            })()
        );
    }

    if (scope === 'all' || scope === 'finance') {
        tasks.push(
            (async () => {
                await financeStore.fetchFinancialData();
                syncLogs.value.push({
                    type: 'finance',
                    bookingId: 'FINANCE-SYNC',
                    guestName: 'Ledgers Synchronized',
                    propertyId: 'Keuangan 2026',
                    diffs: [
                        {
                            field: 'propertyLedger',
                            oldValue: 0,
                            newValue: financeStore.sheetPropertyFinances.length,
                        },
                        {
                            field: 'personalTransactions',
                            oldValue: 0,
                            newValue: financeStore.personalFinances.length,
                        },
                        {
                            field: 'sharedTransactions',
                            oldValue: 0,
                            newValue: financeStore.sharedFinances.length,
                        },
                        {
                            field: 'transfers',
                            oldValue: 0,
                            newValue: financeStore.transfers.length,
                        },
                    ],
                });
            })()
        );
    }

    try {
        await toast.loading(
            async () => {
                await Promise.all(tasks);
                const now = Date.now();
                lastSyncTime.value = now;
                localStorage.setItem('app_global_last_sync', String(now));
                return { totalImported, totalUpdated, totalDeleted };
            },
            {
                loading: {
                    title: `Syncing ${scope === 'finance' ? 'Finances' : scope === 'bookings' ? 'Bookings' : 'All Data'}...`,
                    description: 'Updating local cache from Google Sheets.',
                },
                success: (data) => ({
                    title: 'Sync Complete',
                    description:
                        scope === 'finance'
                            ? 'All finance tabs updated.'
                            : `Imported ${data.totalImported}, updated ${data.totalUpdated}, removed ${data.totalDeleted}.`,
                }),
                error: (err) => ({
                    title: 'Sync Failed',
                    description:
                        err instanceof Error ? err.message : 'Google Sheets request failed.',
                }),
            }
        );
    } finally {
        isSyncing.value = false;
    }
}
</script>

<template>
    <div class="flex items-center gap-2">
        <button
            type="button"
            :disabled="isSyncing"
            class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
            :class="[
                isAuthenticated
                    ? 'border-lime-500/30 bg-lime-500/10 text-lime-300 hover:bg-lime-500/20'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
            ]"
            @click="handleSync">
            <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="[
                    isSyncing
                        ? 'animate-ping bg-indigo-400'
                        : isAuthenticated
                          ? 'animate-pulse bg-lime-400'
                          : 'bg-amber-400',
                ]" />
            <span>{{ buttonLabel }}</span>
        </button>

        <div
            v-if="showTimer && isAuthenticated"
            class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px]"
            :class="[
                isEligibleToAutoSync
                    ? 'border-lime-500/30 bg-lime-500/5 text-lime-400'
                    : 'border-mist-800 bg-mist-900 text-mist-400',
            ]"
            :title="
                isEligibleToAutoSync
                    ? 'Cooldown elapsed: Next window focus will trigger background sync'
                    : `In cooldown: Next background sync eligible in ${formattedCountdown}`
            ">
            <span
                class="h-1.5 w-1.5 rounded-full"
                :class="isEligibleToAutoSync ? 'animate-ping bg-lime-400' : 'bg-mist-600'" />
            <span class="text-[10px] font-medium text-mist-400">Auto:</span>
            <span class="font-bold">
                {{ isEligibleToAutoSync ? 'READY' : formattedCountdown }}
            </span>
        </div>

        <button
            v-if="syncLogs.length > 0"
            type="button"
            class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-2.5 py-1.5 text-xs text-mist-300 transition hover:bg-mist-700"
            title="View sync audit log"
            @click="showLogModal = true">
            <fa-icon icon="list-check" />
        </button>

        <!-- Audit Log Modal -->
        <div
            v-if="showLogModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            @click.self="showLogModal = false">
            <div
                class="flex max-h-[80vh] w-full max-w-2xl flex-col space-y-4 rounded-2xl border border-mist-800 bg-mist-900 p-5 shadow-2xl">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <h3 class="flex items-center gap-2 text-sm font-semibold text-mist-100">
                        <span>Sync Audit Diagnostics</span>
                        <span
                            class="rounded bg-mist-800 px-2 py-0.5 font-mono text-xs text-mist-400">
                            {{ syncLogs.length }} events
                        </span>
                    </h3>
                    <button
                        type="button"
                        class="cursor-pointer text-base text-mist-400 hover:text-mist-100"
                        @click="showLogModal = false">
                        <fa-icon icon="xmark" />
                    </button>
                </div>

                <div class="flex-1 space-y-2 overflow-y-auto pr-1">
                    <div
                        v-for="(log, idx) in syncLogs"
                        :key="idx"
                        class="space-y-1.5 rounded-xl border border-mist-800 bg-mist-950/50 p-3 text-xs">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span
                                    class="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
                                    :class="[
                                        log.type === 'imported' &&
                                            'border border-lime-500/20 bg-lime-500/10 text-lime-400',
                                        log.type === 'updated' &&
                                            'border border-sky-500/20 bg-sky-500/10 text-sky-400',
                                        log.type === 'deleted' &&
                                            'border border-rose-500/20 bg-rose-500/10 text-rose-400',
                                        log.type === 'finance' &&
                                            'border border-purple-500/20 bg-purple-500/10 text-purple-400',
                                    ]">
                                    {{ log.type }}
                                </span>
                                <span class="font-semibold text-mist-200">{{ log.guestName }}</span>
                                <span class="font-mono text-[11px] text-mist-500">
                                    ({{ log.bookingId }})
                                </span>
                            </div>
                            <span
                                class="font-mono text-[10px] font-semibold text-mist-400 capitalize">
                                {{ log.propertyId }}
                            </span>
                        </div>

                        <!-- Diff Viewer -->
                        <div
                            v-if="log.diffs && log.diffs.length > 0"
                            class="space-y-1 rounded-lg bg-mist-900/60 p-2 font-mono text-[11px]">
                            <div
                                v-for="d in log.diffs"
                                :key="String(d.field)"
                                class="flex items-center justify-between text-mist-300">
                                <span class="font-semibold text-mist-400 capitalize">
                                    {{ String(d.field) }}:
                                </span>
                                <div>
                                    <template v-if="log.type === 'finance'">
                                        <span class="font-semibold text-lime-400">
                                            {{ d.newValue }} active records
                                        </span>
                                    </template>
                                    <template v-else>
                                        <span class="mr-1 text-rose-400 line-through">
                                            {{ String(d.oldValue) || '(empty)' }}
                                        </span>
                                        &rarr;
                                        <span class="ml-1 font-semibold text-lime-400">
                                            {{ String(d.newValue) || '(empty)' }}
                                        </span>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
