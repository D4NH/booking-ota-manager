<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';
import type { SyncLogEntry } from '@/types/sync';
import { toast } from 'vue-toastflow';

interface Props {
    propertyId?: PropertyId | 'all';
}

const { propertyId = 'all' } = defineProps<Props>();

const bookingStore = useBookingStore();
const { isAuthenticated, refreshAuthStatus, initAuth, fetchSheetRows } = useGoogleSheets();

const isSyncing = ref(false);
const showLogModal = ref(false);
const syncLogs = ref<SyncLogEntry[]>([]);

onMounted(() => {
    refreshAuthStatus();
    window.addEventListener('focus', refreshAuthStatus);
});

const handleSync = async (): Promise<void> => {
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

    try {
        await toast.loading(
            async () => {
                let totalImported = 0;
                let totalUpdated = 0;
                let totalDeleted = 0;
                const allLogs: SyncLogEntry[] = [];

                const targetProperties: PropertyId[] =
                    propertyId === 'all'
                        ? (Object.keys(PROPERTY_CONFIGS) as PropertyId[])
                        : [propertyId];

                console.group('🔄 Google Sheets Sync Diagnostics');
                console.log('Target properties:', targetProperties);

                for (const id of targetProperties) {
                    const config = PROPERTY_CONFIGS[id];
                    const spreadsheetId = config?.spreadsheetId;

                    if (!spreadsheetId || !spreadsheetId.trim()) {
                        console.warn(
                            `[Sync] Skipped ${id}: Missing spreadsheetId in PROPERTY_CONFIGS.`
                        );
                        continue;
                    }

                    const range = config.defaultRange || 'A2:J';
                    console.log(`[Sync] Fetching ${id} (${spreadsheetId}) with range: ${range}...`);

                    const rows = await fetchSheetRows(spreadsheetId, range);
                    console.log(`[Sync] Received ${rows.length} rows for ${id}.`);

                    if (rows.length === 0) {
                        console.warn(
                            `[Sync] Google Sheets returned 0 rows for ${id}. Verify tab name and content.`
                        );
                        continue;
                    }

                    const stats = await bookingStore.importBookingsFromGoogleSheets(id, rows);
                    totalImported += stats.importedCount;
                    totalUpdated += stats.updatedCount;
                    totalDeleted += stats.deletedCount;
                    allLogs.push(...stats.logs);
                }

                console.groupEnd();
                syncLogs.value = allLogs;

                return { totalImported, totalUpdated, totalDeleted };
            },
            {
                loading: {
                    title: 'Syncing...',
                    description: 'Fetching sheets and updating local database.',
                },
                success: (data) => {
                    const count = data.totalImported + data.totalUpdated + data.totalDeleted;
                    if (count === 0) {
                        return {
                            title: 'No Changes Detected',
                            description: 'All local bookings match Google Sheets.',
                        };
                    }
                    return {
                        title: 'Sync Complete',
                        description: `Imported ${data.totalImported}, updated ${data.totalUpdated}, removed ${data.totalDeleted}.`,
                    };
                },
                error: (err) => ({
                    title: 'Sync failed',
                    description:
                        err instanceof Error ? err.message : 'Failed to fetch Google Sheets.',
                }),
            }
        );
    } finally {
        isSyncing.value = false;
    }
};
</script>

<template>
    <div class="flex items-center gap-2">
        <button
            type="button"
            :disabled="isSyncing"
            class="cursor-pointer flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold border transition disabled:opacity-50"
            :class="[
                isAuthenticated
                    ? 'border-lime-500/30 bg-lime-500/10 text-lime-300 hover:bg-lime-500/20'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
            ]"
            @click="handleSync">
            <span
                class="h-2 w-2 rounded-full shrink-0"
                :class="[
                    isSyncing
                        ? 'bg-indigo-400 animate-ping'
                        : isAuthenticated
                          ? 'bg-lime-400 animate-pulse'
                          : 'bg-amber-400',
                ]" />
            <span>
                {{
                    isSyncing
                        ? 'Syncing...'
                        : isAuthenticated
                          ? propertyId !== 'all'
                              ? 'Sync Property Sheet'
                              : 'Sync All Sheets'
                          : 'Connect & Sync'
                }}
            </span>
        </button>

        <button
            v-if="syncLogs.length > 0"
            type="button"
            class="cursor-pointer rounded-md border border-mist-700 bg-mist-800 px-2 py-1.5 text-xs text-mist-300 hover:bg-mist-700 transition"
            title="View last sync audit"
            @click="showLogModal = true">
            <fa-icon icon="list-check" />
        </button>

        <!-- Audit Log Modal -->
        <div
            v-if="showLogModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            @click.self="showLogModal = false">
            <div
                class="flex flex-col max-h-[80vh] w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 p-4 shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <h3 class="font-bold text-mist-100 text-sm flex items-center gap-2">
                        <span>Sync Audit Log</span>
                        <span
                            class="rounded bg-mist-800 px-2 py-0.5 text-xs text-mist-400 font-mono">
                            {{ syncLogs.length }} actions
                        </span>
                    </h3>
                    <button
                        type="button"
                        class="cursor-pointer text-mist-400 hover:text-mist-100"
                        @click="showLogModal = false">
                        &times;
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto space-y-2 pr-1">
                    <div
                        v-for="(log, idx) in syncLogs"
                        :key="idx"
                        class="rounded border border-mist-800 bg-mist-950 p-2.5 text-xs space-y-1.5">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span
                                    class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                                    :class="[
                                        log.type === 'imported' &&
                                            'bg-lime-500/10 text-lime-400 border border-lime-500/20',
                                        log.type === 'updated' &&
                                            'bg-sky-500/10 text-sky-400 border border-sky-500/20',
                                        log.type === 'deleted' &&
                                            'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                                    ]">
                                    {{ log.type }}
                                </span>
                                <span class="font-bold text-mist-200">{{ log.guestName }}</span>
                                <span class="font-mono text-mist-500 text-[11px]">
                                    ({{ log.bookingId }})
                                </span>
                            </div>
                            <span class="capitalize text-[10px] text-mist-400 font-bold">
                                {{ log.propertyId }}
                            </span>
                        </div>
                        <div
                            v-if="log.diffs && log.diffs.length > 0"
                            class="rounded bg-mist-900/60 p-2 space-y-1 font-mono text-[11px]">
                            <div
                                v-for="d in log.diffs"
                                :key="String(d.field)"
                                class="flex items-center justify-between text-mist-300">
                                <span class="text-mist-400 font-semibold capitalize">
                                    {{ String(d.field) }}:
                                </span>
                                <div>
                                    <span class="text-rose-400 line-through mr-1">
                                        {{ String(d.oldValue) || '(empty)' }}
                                    </span>
                                    &rarr;
                                    <span class="text-lime-400 font-bold ml-1">
                                        {{ String(d.newValue) || '(empty)' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
