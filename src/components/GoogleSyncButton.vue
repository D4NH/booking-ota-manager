<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';
import type { SyncLogEntry } from '@/types/sync';
import { toast } from 'vue-toastflow';

interface Props {
    propertyId?: PropertyId | 'all';
}

const { propertyId = 'all' } = defineProps<Props>();

const bookingStore = useBookingStore();
const propertyStore = usePropertyStore();
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
            console.warn('Auth cancelled or failed:', authErr);
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

                const targetProperties =
                    propertyId === 'all'
                        ? propertyStore.sortedProperties.map((p) => p.id as PropertyId)
                        : [propertyId];

                for (const id of targetProperties) {
                    const spreadsheetId = PROPERTY_CONFIGS[id]?.spreadsheetId;
                    if (!spreadsheetId) continue;

                    const range = PROPERTY_CONFIGS[id]?.defaultRange || 'A2:J';
                    const rows = await fetchSheetRows(spreadsheetId, range);

                    if (rows.length > 0) {
                        const stats = await bookingStore.importBookingsFromGoogleSheets(id, rows);
                        totalImported += stats.importedCount;
                        totalUpdated += stats.updatedCount;
                        totalDeleted += stats.deletedCount;
                        allLogs.push(...stats.logs);
                    }
                }

                syncLogs.value = allLogs;

                if (allLogs.length > 0) {
                    console.groupCollapsed(
                        `🔄 Sync Audit: ${totalImported} new, ${totalUpdated} updated, ${totalDeleted} deleted`
                    );
                    console.table(
                        allLogs.map((l) => ({
                            Action: l.type.toUpperCase(),
                            ID: l.bookingId,
                            Guest: l.guestName,
                            Property: l.propertyId,
                            Changes:
                                l.diffs
                                    ?.map(
                                        (d) =>
                                            `${String(d.field)}: "${String(d.oldValue)}" → "${String(d.newValue)}"`
                                    )
                                    .join(' | ') || '-',
                        }))
                    );
                    console.groupEnd();
                }

                return { totalImported, totalUpdated, totalDeleted };
            },
            {
                loading: {
                    title: 'Syncing...',
                    description: 'Comparing sheets with local database.',
                },
                success: (data) => ({
                    title: 'Sync Complete',
                    description: `Imported ${data.totalImported}, updated ${data.totalUpdated}, removed ${data.totalDeleted}.`,
                }),
                error: (err) => ({
                    title: 'Sync failed',
                    description: err instanceof Error ? err.message : 'Google Sheets sync failed.',
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
            title="View last sync change audit"
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

                        <!-- Detailed Field Diffs for Updates -->
                        <div
                            v-if="log.diffs && log.diffs.length > 0"
                            class="rounded bg-mist-900/60 p-2 space-y-1 font-mono text-[11px]">
                            <div
                                v-for="d in log.diffs"
                                :key="String(d.field)"
                                class="flex items-center justify-between text-mist-300">
                                <span class="text-mist-400 font-sans font-semibold capitalize">
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
