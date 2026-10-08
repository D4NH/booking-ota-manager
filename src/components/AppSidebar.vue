<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useStorage } from '@vueuse/core';
import { useBookingSync } from '@/composables/useBookingSync';
import { PROPERTY_CONFIGS, getPropertyStyle } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { useStagingStore } from '@/stores/useStagingStore';
import type { Booking, StagedBooking } from '@/types/booking';
import type { NavItem } from '@/types/navigation';
import { getCurrentDate } from '@/utils/date';

import SyncSection from '@/components/SyncSection.vue';
import NotificationsDrawer from '@/components/NotificationsDrawer.vue';
import ReviewBookingModal from '@/features/bookings/ReviewBookingModal.vue';

const navLinks: readonly NavItem[] = [
    { name: 'Dashboard', path: '/', icon: 'table-cells-large' },
    { name: 'Bookings', path: '/bookings', icon: 'calendar-check' },
    { name: 'Calendar', path: '/calendar', icon: 'calendar-days' },
] as const;

const currentYear = new Date().getFullYear();
const stagingSpreadsheetId = (import.meta.env.VITE_STAGING_SPREADSHEET_ID as string) || '';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const route = useRoute();
const { markBookingComplete } = useBookingSync();
const isSidebarCollapsed = useStorage<boolean>('sidebar-collapsed', false);
const isNotificationCollapsed = useStorage<boolean>('notifications-collapsed', false);
const stagingStore = useStagingStore();
const { stagedBookings } = storeToRefs(stagingStore);

const activeStagedBooking = ref<StagedBooking | null>(null);
const isReviewModalOpen = ref<boolean>(false);
const isPropertiesOpen = ref<boolean>(true);
const isFinanceOpen = ref<boolean>(true);

const pendingPayments = computed<{
    whatsappPayments: Booking[];
    bookingPayouts: Booking[];
    notificationsCount: number;
}>(() => {
    const isWithinWindow = (checkIn: string): boolean => {
        const dueDate = new Date(checkIn);
        dueDate.setDate(dueDate.getDate() - 1);

        return getCurrentDate(new Date()) >= getCurrentDate(dueDate);
    };

    const whatsappPayments = bookings.value.filter(
        (b) =>
            b.listing === 'Whatsapp' &&
            b.status === 'Waiting for payment' &&
            isWithinWindow(b.checkIn)
    );
    const bookingPayouts = bookings.value.filter((b) => b.status === 'Waiting for payout');
    const allNotifications = [...whatsappPayments, ...bookingPayouts];
    const notificationsCount = allNotifications.length;

    return {
        whatsappPayments,
        bookingPayouts,
        notificationsCount,
    };
});

watch(
    () => route.path,
    (newPath: string) => {
        if (newPath.startsWith('/properties')) {
            isPropertiesOpen.value = true;
            isFinanceOpen.value = false;
        } else if (newPath.startsWith('/finance')) {
            isFinanceOpen.value = true;
            isPropertiesOpen.value = false;
        } else {
            isPropertiesOpen.value = false;
            isFinanceOpen.value = false;
        }
    },
    { immediate: true }
);

function handleEditBooking(booking: Booking): void {
    modalStore.openBookingModal({ booking });
}
function handleInstantComplete(booking: Booking): Promise<boolean> {
    return markBookingComplete(booking);
}
function isLinkActive(path: string): boolean {
    if (path === '/') return route.path === '/';
    return route.path.startsWith(path);
}
function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
    isNotificationCollapsed.value = true;
    isPropertiesOpen.value = false;
    isFinanceOpen.value = false;
}
function toggleNotifications(): void {
    isNotificationCollapsed.value = !isNotificationCollapsed.value;
}
function handleOpenStaging(stagedItem?: StagedBooking): void {
    if (stagedItem) {
        activeStagedBooking.value = stagedItem;
        isReviewModalOpen.value = true;
    }
}
</script>

<template>
    <aside
        :class="[
            'relative flex shrink-0 flex-col border-r border-mist-800 bg-mist-900 transition-all duration-300 ease-in-out',
            isSidebarCollapsed ? 'w-16' : 'w-60',
        ]">
        <div class="flex h-14 items-center overflow-hidden border-b border-mist-800 px-4">
            <div class="flex items-center gap-3">
                <img
                    class="h-8 w-8 shrink-0 rounded-md object-cover"
                    src="/images/maihouse_logo.jpg"
                    alt="Mai House" />
                <span
                    class="overflow-hidden font-semibold text-nowrap transition-all duration-300 ease-in-out"
                    :class="isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-32 opacity-100'">
                    Mai House
                </span>
            </div>
        </div>

        <nav class="flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto p-3">
            <RouterLink
                v-for="link in navLinks"
                :key="link.name"
                :to="link.path"
                class="flex items-center gap-3 rounded-md px-3 py-1 text-sm font-medium transition"
                :class="[
                    isLinkActive(link.path)
                        ? 'bg-mist-800 font-semibold text-lime-400 shadow-sm'
                        : 'text-mist-400 hover:bg-mist-800/60 hover:text-mist-200',
                ]">
                <fa-icon
                    :icon="link.icon"
                    class="shrink-0 py-2 text-center" />
                <span
                    class="overflow-hidden text-nowrap transition-all duration-300 ease-in-out"
                    :class="isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'">
                    {{ link.name }}
                </span>
            </RouterLink>
            <!-- Properties -->
            <div class="space-y-1 pt-0.5">
                <div
                    :class="[
                        'group flex items-center justify-between rounded-md px-3 py-1 text-sm font-medium transition',
                        isLinkActive('/properties')
                            ? 'bg-mist-800/80'
                            : 'text-mist-400 hover:bg-mist-800/50 hover:text-mist-200',
                    ]">
                    <RouterLink
                        to="/properties"
                        class="flex min-w-0 flex-1 items-center gap-3"
                        :class="{ 'font-semibold text-lime-400': isLinkActive('/properties') }">
                        <fa-icon
                            class="shrink-0 py-2 text-center"
                            icon="house" />
                        <span
                            class="overflow-hidden text-nowrap transition-all duration-300 ease-in-out"
                            :class="
                                isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'
                            ">
                            Properties
                        </span>
                    </RouterLink>

                    <button
                        type="button"
                        class="cursor-pointer overflow-hidden p-1 text-mist-500 transition-all duration-300 ease-in-out hover:text-mist-200"
                        :class="
                            isSidebarCollapsed
                                ? 'pointer-events-none max-w-0 opacity-0'
                                : 'max-w-6 opacity-100'
                        "
                        @click.stop.prevent="isPropertiesOpen = !isPropertiesOpen">
                        <fa-icon
                            class="text-xs transition-transform duration-200"
                            :class="{ 'rotate-180': isPropertiesOpen }"
                            icon="chevron-down" />
                    </button>
                </div>

                <!-- Properties Subitems -->
                <div
                    v-show="!isSidebarCollapsed && isPropertiesOpen"
                    class="my-1 ml-4 animate-in space-y-1 border-l border-mist-800 pl-3.5 duration-150 fade-in">
                    <RouterLink
                        v-for="prop in PROPERTY_CONFIGS"
                        :key="prop.id"
                        :to="{ name: 'property-detail', params: { id: prop.id } }"
                        class="-ml-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-mist-800/50 hover:text-mist-200"
                        :class="[
                            route.path === `/properties/${prop.id}`
                                ? 'font-semibold text-lime-400'
                                : 'text-mist-400',
                        ]">
                        <span
                            class="h-1.5 w-1.5 shrink-0 rounded-full"
                            :class="getPropertyStyle(prop.id, true)" />
                        <span class="truncate capitalize">
                            {{ prop.id }}
                        </span>
                    </RouterLink>
                </div>
            </div>
            <!-- Finance -->
            <div class="space-y-1 pt-0.5">
                <div
                    :class="[
                        'group flex items-center justify-between rounded-md px-3 py-1 text-sm font-medium transition',
                        isLinkActive('/finance')
                            ? 'bg-mist-800/80'
                            : 'text-mist-400 hover:bg-mist-800/50 hover:text-mist-200',
                    ]">
                    <RouterLink
                        to="/finance"
                        class="flex min-w-0 flex-1 items-center gap-3"
                        :class="{ 'font-semibold text-lime-400': isLinkActive('/finance') }">
                        <fa-icon
                            class="shrink-0 py-2 text-center"
                            icon="sack-dollar" />
                        <span
                            class="overflow-hidden text-nowrap transition-all duration-300 ease-in-out"
                            :class="
                                isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'
                            ">
                            Finance
                        </span>
                    </RouterLink>

                    <button
                        type="button"
                        class="cursor-pointer overflow-hidden p-1 text-mist-500 transition-all duration-300 ease-in-out hover:text-mist-200"
                        :class="
                            isSidebarCollapsed
                                ? 'pointer-events-none max-w-0 opacity-0'
                                : 'max-w-6 opacity-100'
                        "
                        @click.stop.prevent="isFinanceOpen = !isFinanceOpen">
                        <fa-icon
                            class="text-xs transition-transform duration-200"
                            :class="{ 'rotate-180': isFinanceOpen }"
                            icon="chevron-down" />
                    </button>
                </div>
                <!-- Finance Subitems -->
                <div
                    v-show="!isSidebarCollapsed && isFinanceOpen"
                    class="my-1 ml-4 animate-in space-y-1 border-l border-mist-800 pl-3.5 duration-150 fade-in">
                    <RouterLink
                        :to="{ name: 'finance-property' }"
                        class="-ml-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-mist-800/50 hover:text-mist-200"
                        :class="[
                            route.path === `/finance/property`
                                ? 'font-semibold text-lime-400'
                                : 'text-mist-400',
                        ]">
                        <fa-icon
                            class="shrink-0 text-center"
                            icon="house" />
                        <span class="truncate capitalize">Properties</span>
                    </RouterLink>
                </div>
                <div
                    v-show="!isSidebarCollapsed && isFinanceOpen"
                    class="my-1 ml-4 animate-in space-y-1 border-l border-mist-800 pl-3.5 duration-150 fade-in">
                    <RouterLink
                        :to="{ name: 'finance-personal' }"
                        class="-ml-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-mist-800/50 hover:text-mist-200"
                        :class="[
                            route.path === `/finance/personal`
                                ? 'font-semibold text-lime-400'
                                : 'text-mist-400',
                        ]">
                        <fa-icon
                            class="shrink-0 text-center"
                            icon="user" />
                        <span class="truncate capitalize">Personal</span>
                    </RouterLink>
                </div>
            </div>
            <!-- Settings -->
            <div class="space-y-1 pt-0.5">
                <RouterLink
                    to="/settings"
                    :class="[
                        'flex items-center gap-3 rounded-md px-3 py-1 text-sm font-medium transition',
                        isLinkActive('/settings')
                            ? 'bg-mist-800 font-semibold text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:bg-mist-800/60 hover:text-mist-200',
                    ]">
                    <fa-icon
                        class="shrink-0 py-2 text-center"
                        icon="gear" />
                    <span
                        class="overflow-hidden text-nowrap transition-all duration-300 ease-in-out"
                        :class="isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'">
                        Settings
                    </span>
                </RouterLink>
            </div>
        </nav>

        <SyncSection :is-sidebar-collapsed="isSidebarCollapsed" />
        <NotificationsDrawer
            :is-sidebar-collapsed="isSidebarCollapsed"
            :is-collapsed="isNotificationCollapsed"
            :pending-payments="pendingPayments.whatsappPayments"
            :pending-payouts="pendingPayments.bookingPayouts"
            :staged-bookings="stagedBookings"
            @open-staging="handleOpenStaging"
            @close="toggleNotifications"
            @edit="handleEditBooking"
            @mark-complete="handleInstantComplete" />

        <div class="overflow-hidden border-t border-mist-800 p-3">
            <div class="flex items-center justify-center gap-2 px-2 py-1 text-xs text-mist-500">
                <fa-icon
                    class="shrink-0 transition-[padding] duration-300 ease-in-out"
                    :class="{ 'pl-2': isSidebarCollapsed }"
                    icon="copyright" />
                <span
                    class="overflow-hidden text-nowrap transition-all duration-300 ease-in-out"
                    :class="isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'">
                    {{ currentYear }} - Danh Nguyen
                </span>
            </div>
        </div>

        <button
            type="button"
            class="absolute -right-3 bottom-3 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-mist-800 bg-mist-800 text-xs text-mist-300 shadow-md transition hover:bg-mist-700 hover:text-mist-100"
            :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar">
            <fa-icon
                class="transition-transform duration-300"
                :class="{ 'rotate-180': isSidebarCollapsed }"
                icon="chevron-left" />
        </button>

        <ReviewBookingModal
            v-model="isReviewModalOpen"
            :booking="activeStagedBooking"
            :staging-spreadsheet-id="stagingSpreadsheetId" />
    </aside>
</template>
