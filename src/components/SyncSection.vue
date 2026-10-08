<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { toast } from 'vue-toastflow';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useAppAutoSync } from '@/composables/useAppAutoSync';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useStagingStore } from '@/stores/useStagingStore';

interface Props {
    isSidebarCollapsed: boolean;
}

const { isSidebarCollapsed } = defineProps<Props>();

const { isAuthenticated, refreshAuthStatus, initAuth } = useGoogleSheets();
const { isSyncing: isMasterSyncing, formattedCountdown, syncAllData } = useAppAutoSync();
const { syncAllFinancialData } = useFinanceSync();
const stagingStore = useStagingStore();

const isMenuOpen = ref<boolean>(true);
const isSyncingBookings = ref<boolean>(false);
const isSyncingEmails = ref<boolean>(false);

watch(
    () => isSidebarCollapsed,
    (collapsed: boolean) => {
        if (collapsed) {
            isMenuOpen.value = false;
        }
    }
);

onMounted(() => {
    refreshAuthStatus();
});

async function handleAuthToggle(): Promise<void> {
    if (!isAuthenticated.value) {
        await initAuth('select_account').catch(() => null);
    }
}
async function handleMasterSync(): Promise<void> {
    if (!refreshAuthStatus()) {
        await initAuth('select_account').catch(() => null);
        if (!isAuthenticated.value) return;
    }

    await toast.loading(
        async () => {
            const res = await syncAllData({ force: true, silent: false, scope: 'all' });
            if (!res.success) {
                throw new Error('System sync was interrupted.');
            }
            return res;
        },
        {
            loading: {
                title: 'Syncing Entire System...',
                description: 'Updating bookings, financials, staging, and calendar blocks.',
            },
            success: (res) => ({
                title: 'System Synchronized',
                description: `Updated all systems (${res.totalImported} imported, ${res.totalUpdated} updated).`,
            }),
            error: (err: unknown) => ({
                title: 'Sync Interrupted',
                description:
                    err instanceof Error ? err.message : 'Failed to complete full system sync.',
            }),
        }
    );
}
async function handleSyncBookings(): Promise<void> {
    if (!refreshAuthStatus()) {
        await initAuth('select_account').catch(() => null);
        if (!isAuthenticated.value) return;
    }

    isSyncingBookings.value = true;
    try {
        await toast.loading(
            async () => {
                const res = await syncAllData({
                    force: true,
                    silent: false,
                    scope: 'bookings',
                });
                if (!res.success) {
                    throw new Error('Unable to synchronize multi-year booking sheets.');
                }
                return res;
            },
            {
                loading: {
                    title: 'Pulling Bookings...',
                    description: 'Syncing multi-year reservations via throttled queue.',
                },
                success: (res) => ({
                    title: 'Bookings Up to Date',
                    description: `Imported ${res.totalImported}, updated ${res.totalUpdated}, removed ${res.totalDeleted}.`,
                }),
                error: (err: unknown) => ({
                    title: 'Sync Failed',
                    description:
                        err instanceof Error ? err.message : 'Unable to fetch booking sheets.',
                }),
            }
        );
    } finally {
        isSyncingBookings.value = false;
    }
}
async function handleSyncFinancials(): Promise<void> {
    if (!refreshAuthStatus()) {
        await initAuth('select_account').catch(() => null);
        if (!isAuthenticated.value) return;
    }

    await syncAllFinancialData({ silent: false });
}
async function handleScanEmails(): Promise<void> {
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
                            ? `Staged ${Number(count)} new booking(s) for review.`
                            : 'No new confirmation emails found.',
                }),
                error: (err: unknown) => ({
                    title: 'Scan Interrupted',
                    description:
                        err instanceof Error
                            ? err.message
                            : 'Failed to connect to email scraper webhook.',
                }),
            }
        );
    } finally {
        isSyncingEmails.value = false;
    }
}
</script>

<template>
    <div
        class="border-t border-mist-800/80 bg-mist-950/40 p-3 text-nowrap text-mist-200 transition-all duration-300 ease-in-out select-none">
        <div
            class="flex items-center justify-between font-mono text-xs text-mist-400 transition-all duration-300"
            :class="{ 'mb-2': !isSidebarCollapsed }">
            <button
                type="button"
                class="flex cursor-pointer items-center gap-1.5 transition hover:text-mist-200"
                :title="
                    isAuthenticated ? 'Connected to Google API' : 'Click to authorize Google API'
                "
                @click="handleAuthToggle">
                <span
                    class="h-2 w-2 shrink-0 rounded-full transition-[margin] duration-300 ease-in-out"
                    :class="[
                        isAuthenticated ? 'bg-lime-400' : 'bg-rose-400',
                        { 'ml-3.5': isSidebarCollapsed },
                    ]" />
                <span
                    class="overflow-hidden text-nowrap transition-all duration-300 ease-in-out"
                    :class="isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-28 opacity-100'">
                    {{ isAuthenticated ? 'Google API' : 'Connect API' }}
                </span>
            </button>

            <span
                class="overflow-hidden text-xs text-mist-500 transition-all duration-300 ease-in-out"
                :class="isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'">
                SWR: {{ formattedCountdown }}
            </span>
        </div>

        <div class="flex items-center gap-1">
            <button
                v-if="!isSidebarCollapsed"
                type="button"
                :disabled="isMasterSyncing"
                class="bg-mist-850 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-mist-700 px-3 py-1.5 text-xs font-semibold text-mist-100 transition hover:border-lime-500/40 hover:bg-mist-800 disabled:opacity-50"
                @click="handleMasterSync">
                <fa-icon
                    icon="arrows-rotate"
                    class="shrink-0 text-xs text-lime-400"
                    :class="{ 'animate-spin': isMasterSyncing }" />
                <span class="text-nowrap">
                    {{ isMasterSyncing ? 'Syncing...' : 'Sync All' }}
                </span>
            </button>

            <button
                v-if="!isSidebarCollapsed"
                type="button"
                class="bg-mist-850 cursor-pointer rounded border border-mist-700 px-2 py-1.5 text-xs text-mist-400 transition hover:bg-mist-800 hover:text-mist-100"
                @click="isMenuOpen = !isMenuOpen">
                <fa-icon
                    icon="chevron-down"
                    class="transition-transform duration-200"
                    :class="{ 'rotate-180': !isMenuOpen }" />
            </button>
        </div>

        <div
            v-if="isMenuOpen && !isSidebarCollapsed"
            class="mt-2 space-y-1 font-mono text-xs">
            <button
                type="button"
                :disabled="isSyncingBookings"
                class="hover:bg-mist-850 flex w-full cursor-pointer items-center justify-between rounded py-1.5 text-mist-300 transition hover:text-lime-300 disabled:opacity-50"
                @click="handleSyncBookings">
                <span class="flex items-center gap-1.5">
                    <fa-icon
                        icon="calendar-check"
                        class="text-[11px] text-mist-400" />
                    <span>{{ isSyncingBookings ? 'Syncing Bookings...' : 'Bookings' }}</span>
                </span>
            </button>

            <button
                type="button"
                class="hover:bg-mist-850 flex w-full cursor-pointer items-center justify-between rounded py-1.5 text-mist-300 transition hover:text-lime-300"
                @click="handleSyncFinancials">
                <span class="flex items-center gap-1.5">
                    <fa-icon
                        icon="receipt"
                        class="text-[11px] text-mist-400" />
                    <span>Financials</span>
                </span>
            </button>

            <button
                type="button"
                :disabled="isSyncingEmails"
                class="hover:bg-mist-850 flex w-full cursor-pointer items-center justify-between rounded py-1.5 text-mist-300 transition hover:text-lime-300 disabled:opacity-50"
                @click="handleScanEmails">
                <span class="flex items-center gap-1.5">
                    <fa-icon
                        icon="inbox"
                        class="text-[11px] text-mist-400" />
                    <span>{{ isSyncingEmails ? 'Scanning...' : 'Scan Gmail (OTAs)' }}</span>
                </span>
            </button>
        </div>
    </div>
</template>
