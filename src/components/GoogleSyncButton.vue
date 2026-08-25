<script setup lang="ts">
import { ref } from 'vue';
import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS, type PropertyId } from '@/config/properties';

const props = withDefaults(
    defineProps<{
        propertyId?: PropertyId | 'all';
        label?: string;
        variant?: 'primary' | 'secondary' | 'outline';
    }>(),
    {
        propertyId: 'all',
        label: '',
        variant: 'primary',
    }
);

const emit = defineEmits<{
    (e: 'sync-start'): void;
    (e: 'sync-complete', result: { added: number; updated: number }): void;
    (e: 'sync-error', error: unknown): void;
}>();

const bookingStore = useBookingStore();
const { accessToken, isAuthorizing, isLoadingData, authError, initAuth, fetchSheetRows } =
    useGoogleSheets();

const statusMessage = ref<string>('');

const buttonVariantClasses = {
    primary: 'bg-lime-500 text-mist-950 hover:bg-lime-400 font-semibold',
    secondary: 'bg-mist-800 text-mist-100 hover:bg-mist-700 font-medium',
    outline: 'border border-mist-700 bg-mist-900 text-mist-300 hover:bg-mist-800 font-medium',
};

const handleSync = async (): Promise<void> => {
    emit('sync-start');
    statusMessage.value = 'Connecting...';

    try {
        if (!accessToken.value) {
            await initAuth();
        }

        let totalAdded = 0;
        let totalUpdated = 0;

        if (props.propertyId === 'all') {
            const propertiesToSync: PropertyId[] = ['piyungan', 'wonosari', 'imogiri'];

            for (const propId of propertiesToSync) {
                const config = PROPERTY_CONFIGS[propId];
                if (!config?.spreadsheetId) continue;

                statusMessage.value = `Syncing ${config.name}...`;
                const rows = await fetchSheetRows(config.spreadsheetId, config.defaultRange);

                if (rows.length > 0) {
                    const { added, updated } = await bookingStore.importFromGoogleSheetRows(
                        rows,
                        propId
                    );
                    totalAdded += added;
                    totalUpdated += updated;
                }
            }
        } else {
            const config = PROPERTY_CONFIGS[props.propertyId];
            if (!config?.spreadsheetId) {
                throw new Error(`Missing spreadsheet ID for ${props.propertyId}`);
            }

            statusMessage.value = `Syncing ${config.name}...`;
            const rows = await fetchSheetRows(config.spreadsheetId, config.defaultRange);

            if (rows.length > 0) {
                const { added, updated } = await bookingStore.importFromGoogleSheetRows(
                    rows,
                    props.propertyId
                );
                totalAdded += added;
                totalUpdated += updated;
            }
        }

        const result = { added: totalAdded, updated: totalUpdated };
        statusMessage.value = `Synced (${totalAdded} added, ${totalUpdated} updated)`;
        emit('sync-complete', result);
    } catch (err) {
        console.error('Google Sheets Sync Error:', err);
        statusMessage.value = 'Sync failed';
        emit('sync-error', err);
    } finally {
        setTimeout(() => {
            statusMessage.value = '';
        }, 4000);
    }
};
</script>

<template>
    <div class="inline-flex flex-col items-start gap-1">
        <button
            type="button"
            :disabled="isAuthorizing || isLoadingData"
            :class="[
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50',
                buttonVariantClasses[variant],
            ]"
            @click="handleSync">
            <!-- Loading Spinner Indicator -->
            <svg
                v-if="isAuthorizing || isLoadingData"
                class="h-3.5 w-3.5 animate-spin text-current"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>

            <!-- Google Drive Sync Icon -->
            <svg
                v-else
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>

            <span>
                {{
                    label ||
                    (propertyId === 'all'
                        ? 'Sync All Files'
                        : `${PROPERTY_CONFIGS[propertyId as PropertyId]?.name.replace('Mai House Jogja - ', '')}`)
                }}
            </span>
        </button>

        <!-- Inline Feedback Label -->
        <span
            v-if="statusMessage || authError"
            class="text-[10px] font-medium text-mist-400">
            <span
                v-if="authError"
                class="text-rose-400">
                {{ authError }}
            </span>
            <span
                v-else
                class="text-lime-400">
                {{ statusMessage }}
            </span>
        </span>
    </div>
</template>
