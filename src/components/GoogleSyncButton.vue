<script setup lang="ts">
import { ref } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';

const { isLoadingData, authError, findSpreadsheetId, fetchSheetRows } = useGoogleSheets();
const bookingStore = useBookingStore();

const syncStatus = ref<string>('');
const FILE_NAME = 'Yogyakarta Rental Property 2026';

const handleSyncFromDrive = async (): Promise<void> => {
    syncStatus.value = 'Searching for file on Google Drive...';

    try {
        const fileId = await findSpreadsheetId(FILE_NAME);

        if (!fileId) {
            syncStatus.value = `File "${FILE_NAME}" not found on Drive.`;
            return;
        }

        syncStatus.value = 'Fetching rows...';
        const rows = await fetchSheetRows(fileId, 'A2:I500');

        if (rows.length === 0) {
            syncStatus.value = 'No rows found in sheet.';
            return;
        }

        syncStatus.value = 'Saving to local database...';
        const importedCount = await bookingStore.importFromGoogleSheetRows(rows, 'mai-house');

        syncStatus.value = `Successfully imported ${importedCount} bookings!`;
    } catch (err) {
        console.error('Failed to sync from Google Sheet:', err);
        syncStatus.value = 'Error during sync operation.';
    }
};
</script>

<template>
    <div class="flex items-center gap-3">
        <button
            :disabled="isLoadingData"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 transition disabled:opacity-50"
            @click="handleSyncFromDrive">
            {{ isLoadingData ? 'Syncing...' : 'Sync from Google Sheets' }}
        </button>

        <span
            v-if="syncStatus"
            class="text-xs text-slate-400 font-mono">
            {{ syncStatus }}
        </span>
        <span
            v-if="authError"
            class="text-xs text-rose-400 font-mono">
            {{ authError }}
        </span>
    </div>
</template>
