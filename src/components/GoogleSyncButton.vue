<script setup lang="ts">
import { ref } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { PROPERTY_CONFIGS, PROPERTY_LIST, type PropertyId } from '@/config/properties';

const props = defineProps<{
    propertyId?: PropertyId | 'all';
}>();

const bookingStore = useBookingStore();
const { isAuthenticated, initAuth, fetchSheetRows } = useGoogleSheets();

const isSyncing = ref<boolean>(false);
const syncLabel = ref<string>('');

const handleSync = async (): Promise<void> => {
    try {
        isSyncing.value = true;

        if (!isAuthenticated.value) {
            await initAuth();
        }

        let totalImported = 0;
        let totalDeleted = 0;

        if (props.propertyId && props.propertyId !== 'all') {
            // Sync Single File
            const spreadsheetId = PROPERTY_CONFIGS[props.propertyId]?.spreadsheetId;
            if (!spreadsheetId) throw new Error('Spreadsheet ID missing for selected property');

            syncLabel.value = `Syncing ${props.propertyId}...`;
            const rows = await fetchSheetRows(spreadsheetId);

            const { importedCount, deletedCount } =
                await bookingStore.importBookingsFromGoogleSheets(props.propertyId, rows);

            totalImported += importedCount;
            totalDeleted += deletedCount;
        } else {
            // Sync All Files
            for (const prop of PROPERTY_LIST) {
                const spreadsheetId = PROPERTY_CONFIGS[prop.id as PropertyId]?.spreadsheetId;
                if (!spreadsheetId) continue;

                syncLabel.value = `Syncing ${prop.name}...`;
                const rows = await fetchSheetRows(spreadsheetId);

                const { importedCount, deletedCount } =
                    await bookingStore.importBookingsFromGoogleSheets(prop.id as PropertyId, rows);

                totalImported += importedCount;
                totalDeleted += deletedCount;
            }
        }

        syncLabel.value = `Sync Complete! Imported ${totalImported}, removed ${totalDeleted} records.`;
    } catch (err) {
        console.error('Google Sync Failed:', err);
        syncLabel.value = 'Sync failed.';
    } finally {
        isSyncing.value = false;
        setTimeout(() => {
            syncLabel.value = '';
        }, 4000);
    }
};
</script>

<template>
    <div class="flex items-center gap-2">
        <!-- Feedback status string -->
        <span
            v-if="syncLabel"
            class="text-xs text-mist-400 font-mono">
            {{ syncLabel }}
        </span>

        <!-- Auth indicator + Action Button -->
        <button
            type="button"
            :disabled="isSyncing"
            class="cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border transition disabled:opacity-50"
            :class="[
                isAuthenticated
                    ? 'border-lime-500/30 bg-lime-500/10 text-lime-300 hover:bg-lime-500/20'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
            ]"
            @click="handleSync">
            <!-- Connected Status Dot -->
            <span
                class="h-2 w-2 rounded-full"
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
