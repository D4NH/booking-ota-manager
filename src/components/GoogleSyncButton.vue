<script setup lang="ts">
import { ref } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';

import { toast } from 'vue-toastflow';

const props = defineProps<{
    propertyId?: PropertyId | 'all';
}>();

const bookingStore = useBookingStore();
const propertyStore = usePropertyStore();
const { isAuthenticated, initAuth, fetchSheetRows } = useGoogleSheets();

const isSyncing = ref<boolean>(false);

const handleSync = async (): Promise<void> => {
    try {
        await toast.loading(
            async () => {
                if (!isAuthenticated.value) {
                    await initAuth();
                }

                let totalImported = 0;
                let totalUpdated = 0;
                let totalDeleted = 0;

                if (props.propertyId && props.propertyId !== 'all') {
                    const spreadsheetId = PROPERTY_CONFIGS[props.propertyId]?.spreadsheetId;

                    if (!spreadsheetId)
                        throw new Error('Spreadsheet ID missing for selected property');

                    const rows = await fetchSheetRows(spreadsheetId);
                    const { importedCount, updatedCount, deletedCount } =
                        await bookingStore.importBookingsFromGoogleSheets(props.propertyId, rows);

                    totalImported += importedCount;
                    totalUpdated += updatedCount;
                    totalDeleted += deletedCount;
                } else {
                    for (const prop of propertyStore.sortedProperties) {
                        const spreadsheetId =
                            PROPERTY_CONFIGS[prop.id as PropertyId]?.spreadsheetId;

                        if (!spreadsheetId) continue;

                        const rows = await fetchSheetRows(spreadsheetId);
                        const { importedCount, updatedCount, deletedCount } =
                            await bookingStore.importBookingsFromGoogleSheets(
                                prop.id as PropertyId,
                                rows
                            );

                        totalImported += importedCount;
                        totalUpdated += updatedCount;
                        totalDeleted += deletedCount;
                    }
                }

                return { totalImported, totalUpdated, totalDeleted };
            },
            {
                loading: {
                    title: 'Syncing...',
                    description: 'Updating bookings from Google Sheets.',
                },
                success: (data) => ({
                    title: 'Sync Complete',
                    description: `Imported ${data.totalImported}, updated ${data.totalUpdated}, removed ${data.totalDeleted} records.`,
                }),
                error: (err) => ({
                    title: 'Sync failed',
                    description:
                        err instanceof Error
                            ? err.message
                            : 'An unexpected error occurred during sync.',
                }),
            }
        );
    } catch (err) {
        console.error('Google Sync Failed:', err);
    }
};
</script>

<template>
    <div class="flex items-center gap-2">
        <button
            type="button"
            :disabled="isSyncing"
            class="cursor-pointer flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold border transition disabled:opacity-50"
            :class="[
                isAuthenticated
                    ? 'border-lime-500/30 bg-lime-500/10 text-lime-300 hover:bg-lime-500/20'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
            ]"
            @click="handleSync">
            <!-- Connected Status Dot -->
            <span
                class="h-2 w-2 rounded-md"
                :class="[isAuthenticated ? 'bg-lime-400 animate-pulse' : 'bg-amber-400']"></span>

            <span>
                {{
                    isSyncing
                        ? 'Syncing...'
                        : isAuthenticated
                          ? propertyId && propertyId !== 'all'
                              ? 'Sync Property Sheet'
                              : 'Sync All Sheets'
                          : 'Connect & Sync'
                }}
            </span>
        </button>
    </div>
</template>
