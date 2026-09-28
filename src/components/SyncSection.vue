<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-toastflow';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useAppAutoSync } from '@/composables/useAppAutoSync';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useStagingStore } from '@/stores/useStagingStore';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { PropertyId } from '@/types/property';

const isMenuOpen = ref(false);

const { isAuthenticated, fetchSheetRows } = useGoogleSheets();
const { isSyncing: isMasterSyncing, formattedCountdown, syncAllData } = useAppAutoSync();
const { syncAllFinancialData, persistDexieBookings } = useFinanceSync();

const bookingStore = useBookingStore();
const financeStore = useFinanceStore();
const stagingStore = useStagingStore();

const { pendingCount } = storeToRefs(stagingStore);

const isSyncingBookings = ref(false);
const isSyncingEmails = ref(false);

// 1. Master Sync (Everything)
const handleMasterSync = async () => {
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
};

// 2. Sync Bookings Only
const handleSyncBookings = async () => {
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
};

// 3. Scan Gmail & Poll Staging
const handleScanEmails = async () => {
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
};

// 4. Sync Financials Only
const handleSyncFinancials = () => {
    syncAllFinancialData({ silent: false });
};

// 5. Push Dexie Bookings to Property Ledger
const handlePersistBookings = () => {
    persistDexieBookings();
};

// 6. Refresh Live Gold Price
const handleSyncGold = () => {
    toast.loading(() => financeStore.fetchLiveGoldPrice(true), {
        loading: {
            title: 'Fetching Antam Live Price...',
            description: 'Querying official Indonesian benchmark.',
        },
        success: (price: unknown) => ({
            title: 'Gold Price Updated',
            description: `Benchmark set to Rp ${Number(price).toLocaleString('id-ID')}/g.`,
        }),
        error: {
            title: 'Fetch Failed',
            description: 'Using cached gold benchmark.',
        },
    });
};
</script>

<template>
    <div class="p-3 border-t border-mist-800/80 bg-mist-950/40 text-mist-200 font-sans select-none">
        <!-- Auth & Status Indicator -->
        <div class="flex items-center justify-between text-[11px] font-mono text-mist-400 mb-2">
            <span class="flex items-center gap-1.5">
                <span
                    class="w-2 h-2 rounded-full"
                    :class="isAuthenticated ? 'bg-emerald-400' : 'bg-rose-400'"></span>
                {{ isAuthenticated ? 'Google API' : 'Disconnected' }}
            </span>
            <span class="text-[10px] text-mist-500"> SWR: {{ formattedCountdown }} </span>
        </div>

        <!-- Master Sync Button with Menu Toggle -->
        <div class="flex items-center gap-1">
            <button
                type="button"
                :disabled="isMasterSyncing"
                class="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-mist-850 hover:bg-mist-800 text-mist-100 border border-mist-700 hover:border-lime-500/40 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                title="Force full system sync across all data"
                @click="handleMasterSync">
                <fa-icon
                    icon="arrows-rotate"
                    class="text-xs text-lime-400"
                    :class="{ 'animate-spin': isMasterSyncing }" />
                <span>{{ isMasterSyncing ? 'Syncing...' : 'Sync All' }}</span>
            </button>

            <!-- Toggle Granular Options Dropdown -->
            <button
                type="button"
                class="py-1.5 px-2 rounded bg-mist-850 hover:bg-mist-800 text-mist-400 hover:text-mist-100 border border-mist-700 transition cursor-pointer text-xs"
                :title="isMenuOpen ? 'Hide granular sync options' : 'Show granular sync options'"
                @click="isMenuOpen = !isMenuOpen">
                <fa-icon
                    icon="chevron-up"
                    class="transition-transform duration-200"
                    :class="{ 'rotate-180': !isMenuOpen }" />
            </button>
        </div>

        <!-- Granular Sync Options Panel -->
        <transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2">
            <div
                v-if="isMenuOpen"
                class="mt-2.5 pt-2 border-t border-mist-800 space-y-1 text-xs font-mono">
                <!-- 1. Sync Bookings -->
                <button
                    type="button"
                    class="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-mist-850 text-mist-300 hover:text-lime-300 transition cursor-pointer"
                    @click="handleSyncBookings">
                    <span class="flex items-center gap-1.5">
                        <fa-icon
                            icon="calendar-check"
                            class="text-[11px] text-mist-400" />
                        Bookings
                    </span>
                    <span class="text-[10px] text-mist-500">A2:L</span>
                </button>

                <!-- 2. Sync Financials -->
                <button
                    type="button"
                    class="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-mist-850 text-mist-300 hover:text-lime-300 transition cursor-pointer"
                    @click="handleSyncFinancials">
                    <span class="flex items-center gap-1.5">
                        <fa-icon
                            icon="receipt"
                            class="text-[11px] text-mist-400" />
                        Financials & Ledgers
                    </span>
                    <span class="text-[10px] text-mist-500">9 Tabs</span>
                </button>

                <!-- 3. Scan Gmail & Staging -->
                <button
                    type="button"
                    class="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-mist-850 text-mist-300 hover:text-lime-300 transition cursor-pointer"
                    @click="handleScanEmails">
                    <span class="flex items-center gap-1.5">
                        <fa-icon
                            icon="inbox"
                            class="text-[11px] text-mist-400" />
                        Scan Gmail (OTAs)
                    </span>
                    <span
                        v-if="pendingCount > 0"
                        class="px-1.5 py-0.2 rounded-full bg-lime-500/20 text-lime-300 text-[10px] font-bold">
                        {{ pendingCount }}
                    </span>
                    <span
                        v-else
                        class="text-[10px] text-mist-500"
                        >Trigger</span
                    >
                </button>

                <!-- 4. Push Bookings to Ledger -->
                <button
                    type="button"
                    class="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-mist-850 text-mist-300 hover:text-lime-300 transition cursor-pointer"
                    @click="handlePersistBookings">
                    <span class="flex items-center gap-1.5">
                        <fa-icon
                            icon="arrow-right-to-bracket"
                            class="text-[11px] text-mist-400" />
                        Push Bookings &rarr; Ledger
                    </span>
                    <span class="text-[10px] text-mist-500">Payouts</span>
                </button>

                <!-- 5. Refresh Gold Price -->
                <button
                    type="button"
                    class="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-mist-850 text-mist-300 hover:text-amber-300 transition cursor-pointer"
                    @click="handleSyncGold">
                    <span class="flex items-center gap-1.5">
                        <fa-icon
                            icon="coins"
                            class="text-[11px] text-amber-400" />
                        Live Gold Price
                    </span>
                    <span class="text-[10px] text-amber-400/80">Antam</span>
                </button>
            </div>
        </transition>
    </div>
</template>
