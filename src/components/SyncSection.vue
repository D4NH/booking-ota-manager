<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-toastflow';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useAppAutoSync } from '@/composables/useAppAutoSync';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { useStagingStore } from '@/stores/useStagingStore';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';

const isMenuOpen = ref(true);

const { isAuthenticated, fetchSheetRows } = useGoogleSheets();
const { isSyncing: isMasterSyncing, formattedCountdown, syncAllData } = useAppAutoSync();
const { syncAllFinancialData } = useFinanceSync();

const bookingStore = useBookingStore();
const stagingStore = useStagingStore();

const isSyncingBookings = ref(false);
const isSyncingEmails = ref(false);

// Sync everything
async function handleMasterSync() {
    await toast.loading(() => syncAllData({ force: true }), {
        loading: {
            title: 'Syncing Entire System...',
            description: 'Updating bookings, financials, staging, and calendar blocks.',
        },
        success: {
            title: 'System Synchronized',
            description: 'All remote sheets, Dexie storage, and assets are up to date.',
        },
        error: {
            title: 'Sync Interrupted',
            description: 'Failed to complete full system sync.',
        },
    });
}
// Sync bookings Only
async function handleSyncBookings() {
    isSyncingBookings.value = true;
    try {
        await toast.loading(
            async () => {
                const propertyIds = Object.keys(PROPERTY_CONFIGS) as PropertyId[];
                let totalImported = 0;
                let totalUpdated = 0;

                await Promise.all(
                    propertyIds.map(async (propId) => {
                        const spreadsheetId = PROPERTY_CONFIGS[propId]?.spreadsheetId;
                        if (!spreadsheetId) return;

                        const rows = await fetchSheetRows(spreadsheetId, 'A2:L');
                        if (rows && rows.length > 0) {
                            const res = await bookingStore.importBookingsFromGoogleSheets(
                                propId,
                                rows
                            );
                            totalImported += res.importedCount;
                            totalUpdated += res.updatedCount;
                        }
                    })
                );

                return { totalImported, totalUpdated };
            },
            {
                loading: {
                    title: 'Pulling Bookings...',
                    description: 'Syncing confirmed reservations from Google Sheets.',
                },
                success: (res) => ({
                    title: 'Bookings Up to Date',
                    description: `Imported ${res?.totalImported || 0}, updated ${res?.totalUpdated || 0} reservations.`,
                }),
                error: {
                    title: 'Sync Failed',
                    description: 'Unable to fetch booking sheets.',
                },
            }
        );
    } finally {
        isSyncingBookings.value = false;
    }
}
// Scan Gmail & Poll Staging
async function handleScanEmails() {
    isSyncingEmails.value = true;
    try {
        await toast.loading(
            async () => {
                const { newEmailsCount } = await stagingStore.forceScrapeAndPoll();
                return newEmailsCount;
            },
            {
                loading: {
                    title: 'Scanning Gmail Inbox...',
                    description: 'Triggering remote Apps Script scraper for OTAs.',
                },
                success: (count: unknown) => ({
                    title: 'Email Scan Complete',
                    description:
                        Number(count) > 0
                            ? `Staged ${count} new booking(s) for review.`
                            : 'No new confirmation emails found.',
                }),
                error: {
                    title: 'Scan Interrupted',
                    description: 'Failed to connect to email scraper webhook.',
                },
            }
        );
    } finally {
        isSyncingEmails.value = false;
    }
}
// Sync Financials Only
function handleSyncFinancials() {
    syncAllFinancialData({ silent: false });
}
</script>

<template>
    <div class="border-t border-mist-800/80 bg-mist-950/40 p-3 font-sans text-mist-200 select-none">
        <!-- Auth & Status Indicator -->
        <div class="mb-2 flex items-center justify-between font-mono text-[11px] text-mist-400">
            <span class="flex items-center gap-1.5">
                <span
                    class="h-2 w-2 rounded-full"
                    :class="isAuthenticated ? 'bg-lime-400' : 'bg-rose-400'"></span>
                {{ isAuthenticated ? 'Google API' : 'Disconnected' }}
            </span>
            <span class="text-[10px] text-mist-500"> SWR: {{ formattedCountdown }} </span>
        </div>

        <!-- Master Sync Button -->
        <div class="flex items-center gap-1">
            <button
                type="button"
                :disabled="isMasterSyncing"
                class="bg-mist-850 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-mist-700 px-3 py-1.5 text-xs font-semibold text-mist-100 transition hover:border-lime-500/40 hover:bg-mist-800 disabled:opacity-50"
                title="Force full system sync across all data"
                @click="handleMasterSync">
                <fa-icon
                    icon="arrows-rotate"
                    class="text-xs text-lime-400"
                    :class="{ 'animate-spin': isMasterSyncing }" />
                <span>{{ isMasterSyncing ? 'Syncing...' : 'Sync All' }}</span>
            </button>

            <!-- Toggle Options Dropdown -->
            <button
                type="button"
                class="bg-mist-850 cursor-pointer rounded border border-mist-700 px-2 py-1.5 text-xs text-mist-400 transition hover:bg-mist-800 hover:text-mist-100"
                :title="isMenuOpen ? 'Hide granular sync options' : 'Show granular sync options'"
                @click="isMenuOpen = !isMenuOpen">
                <fa-icon
                    icon="chevron-up"
                    class="transition-transform duration-200"
                    :class="{ 'rotate-180': !isMenuOpen }" />
            </button>
        </div>

        <!-- Sync Options Panel -->
        <div
            v-if="isMenuOpen"
            class="mt-2 space-y-1 font-mono text-xs">
            <!-- Sync Bookings -->
            <button
                type="button"
                class="hover:bg-mist-850 flex w-full cursor-pointer items-center justify-between rounded py-1.5 text-mist-300 transition hover:text-lime-300"
                @click="handleSyncBookings">
                <span class="flex items-center gap-1.5">
                    <fa-icon
                        icon="calendar-check"
                        class="text-[11px] text-mist-400" />
                    Bookings
                </span>
            </button>

            <!-- Sync Financials -->
            <button
                type="button"
                class="hover:bg-mist-850 flex w-full cursor-pointer items-center justify-between rounded py-1.5 text-mist-300 transition hover:text-lime-300"
                @click="handleSyncFinancials">
                <span class="flex items-center gap-1.5">
                    <fa-icon
                        icon="receipt"
                        class="text-[11px] text-mist-400" />
                    Financials
                </span>
            </button>

            <!-- Scan Gmail & Staging -->
            <button
                type="button"
                class="hover:bg-mist-850 flex w-full cursor-pointer items-center justify-between rounded py-1.5 text-mist-300 transition hover:text-lime-300"
                @click="handleScanEmails">
                <span class="flex items-center gap-1.5">
                    <fa-icon
                        icon="inbox"
                        class="text-[11px] text-mist-400" />
                    Scan Gmail (OTAs)
                </span>
            </button>
        </div>
    </div>
</template>
