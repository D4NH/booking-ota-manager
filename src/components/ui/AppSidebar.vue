<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useStorage } from '@vueuse/core';
import { useBookingSync } from '@/composables/useBookingSync';
import { PROPERTY_CONFIGS, getPropertyStyle } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { NavItem } from '@/types/navigation';
import { getCurrentDate } from '@/utils/date';

import NotificationsDrawer from '@/components/ui/NotificationsDrawer.vue';

const navLinks: NavItem[] = [
    { name: 'Dashboard', path: '/', icon: 'table-cells-large' },
    { name: 'Bookings', path: '/bookings', icon: 'calendar-check' },
    { name: 'Calendar', path: '/calendar', icon: 'calendar-days' },
];
const currentYear = new Date().getFullYear();

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const route = useRoute();
const { markBookingComplete } = useBookingSync();
const isSidebarCollapsed = useStorage('sidebar-collapsed', false);
const isNotificationCollapsed = useStorage('notifications-collapsed', false);

// const isNotificationCollapsed = ref(true);
const isPropertiesOpen = ref(true);
const isFinanceOpen = ref(true);

const pendingPayments = computed(() => {
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

const handleEditBooking = (booking: Booking) => modalStore.openBookingModal({ booking });
const handleInstantComplete = async (booking: Booking) => await markBookingComplete(booking);
const isLinkActive = (path: string) => {
    if (path === '/') return route.path === '/';
    return route.path.startsWith(path);
};
const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
    isNotificationCollapsed.value = true;
    isPropertiesOpen.value = false;
    isFinanceOpen.value = false;
};
const toggleNotifications = () => (isNotificationCollapsed.value = !isNotificationCollapsed.value);

watch(
    () => route.path,
    (newPath) => {
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
</script>

<template>
    <aside
        :class="[
            'relative flex flex-col shrink-0 border border-mist-800 bg-mist-900 transition-all duration-300 ease-in-out',
            isSidebarCollapsed ? 'w-16' : 'w-60',
        ]">
        <div class="flex h-14 items-center border-b border-mist-800 px-4 overflow-hidden">
            <div class="flex items-center gap-3">
                <img
                    class="h-8 w-8 shrink-0 rounded-md"
                    src="/images/maihouse_logo.jpg"
                    alt="Mai House" />
                <span
                    v-show="!isSidebarCollapsed"
                    class="font-semibold text-mist-100 text-nowrap transition-opacity duration-200">
                    Mai House
                </span>
            </div>
        </div>

        <nav class="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
            <RouterLink
                v-for="link in navLinks"
                :key="link.name"
                :to="link.path"
                :class="[
                    'flex items-center gap-3 rounded-md px-3 py-1 text-sm font-medium transition',
                    isLinkActive(link.path)
                        ? 'bg-mist-800 text-lime-400 font-semibold shadow-sm'
                        : 'text-mist-400 hover:bg-mist-800/60 hover:text-mist-200',
                ]">
                <fa-icon
                    :icon="link.icon"
                    class="w-4 h-4 shrink-0 text-center py-2" />
                <span
                    v-show="!isSidebarCollapsed"
                    class="truncate">
                    {{ link.name }}
                </span>
            </RouterLink>
            <!-- Properties -->
            <div class="space-y-1 pt-0.5">
                <div
                    :class="[
                        'flex items-center justify-between rounded-md px-3 py-1 text-sm font-medium transition group',
                        isLinkActive('/properties')
                            ? 'bg-mist-800/80 text-mist-100'
                            : 'text-mist-400 hover:bg-mist-800/50 hover:text-mist-200',
                    ]">
                    <RouterLink
                        to="/properties"
                        class="flex items-center gap-3 flex-1 min-w-0"
                        :class="{ 'text-lime-400 font-semibold': isLinkActive('/properties') }">
                        <fa-icon
                            icon="house"
                            class="w-4 h-4 shrink-0 text-center py-2" />
                        <span
                            v-show="!isSidebarCollapsed"
                            class="truncate">
                            Properties
                        </span>
                    </RouterLink>

                    <button
                        v-show="!isSidebarCollapsed"
                        type="button"
                        class="p-1 text-mist-500 hover:text-mist-200 transition cursor-pointer"
                        @click.stop.prevent="isPropertiesOpen = !isPropertiesOpen">
                        <fa-icon
                            icon="chevron-down"
                            class="text-[10px] transition-transform duration-200"
                            :class="{ 'rotate-180': isPropertiesOpen }" />
                    </button>
                </div>

                <!-- Properties Subitems -->
                <div
                    v-show="!isSidebarCollapsed && isPropertiesOpen"
                    class="ml-4 pl-3.5 border-l border-mist-800 space-y-1 my-1 animate-in fade-in duration-150">
                    <RouterLink
                        v-for="prop in PROPERTY_CONFIGS"
                        :key="prop.id"
                        :to="{ name: 'property-detail', params: { id: prop.id } }"
                        class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition shadow-sm hover:text-mist-200 hover:bg-mist-800/50"
                        :class="[
                            route.path === `/properties/${prop.id}`
                                ? 'font-semibold text-lime-400'
                                : 'text-mist-400',
                        ]">
                        <span
                            class="h-1.5 w-1.5 rounded-full shrink-0"
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
                        'flex items-center justify-between rounded-md px-3 py-1 text-sm font-medium transition group',
                        isLinkActive('/finance')
                            ? 'bg-mist-800/80 text-mist-100'
                            : 'text-mist-400 hover:bg-mist-800/50 hover:text-mist-200',
                    ]">
                    <RouterLink
                        to="/finance"
                        class="flex items-center gap-3 flex-1 min-w-0"
                        :class="{ 'text-lime-400 font-semibold': isLinkActive('/finance') }">
                        <fa-icon
                            icon="sack-dollar"
                            class="w-4 h-4 shrink-0 text-center py-2" />
                        <span
                            v-show="!isSidebarCollapsed"
                            class="truncate">
                            Finance
                        </span>
                    </RouterLink>
                    <button
                        v-show="!isSidebarCollapsed"
                        type="button"
                        class="p-1 text-mist-500 hover:text-mist-200 transition cursor-pointer"
                        @click.stop.prevent="isFinanceOpen = !isFinanceOpen">
                        <fa-icon
                            icon="chevron-down"
                            class="text-[10px] transition-transform duration-200"
                            :class="{ 'rotate-180': isFinanceOpen }" />
                    </button>
                </div>

                <!-- Finance Subitems -->
                <div
                    v-show="!isSidebarCollapsed && isFinanceOpen"
                    class="ml-4 pl-3.5 border-l border-mist-800 space-y-1 my-1 animate-in fade-in duration-150">
                    <RouterLink
                        :to="{ name: 'finance-personal' }"
                        class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition shadow-sm hover:text-mist-200 hover:bg-mist-800/50"
                        :class="[
                            route.path === `/finance/personal`
                                ? 'font-semibold text-lime-400'
                                : 'text-mist-400',
                        ]">
                        <span class="h-1.5 w-1.5 rounded-full bg-mist-400 shrink-0" />
                        <span class="truncate capitalize"> Personal </span>
                    </RouterLink>
                </div>
            </div>
            <!-- Settings -->
            <RouterLink
                to="/settings"
                :class="[
                    'flex items-center gap-3 rounded-md px-3 py-1 text-sm font-medium transition',
                    isLinkActive('/settings')
                        ? 'bg-mist-800 text-lime-400 font-semibold shadow-sm'
                        : 'text-mist-400 hover:bg-mist-800/60 hover:text-mist-200',
                ]">
                <fa-icon
                    icon="gear"
                    class="w-4 h-4 shrink-0 text-center py-2" />
                <span
                    v-show="!isSidebarCollapsed"
                    class="truncate">
                    Settings
                </span>
            </RouterLink>
        </nav>

        <NotificationsDrawer
            :is-collapsed="isNotificationCollapsed"
            :pending-payments="pendingPayments.whatsappPayments"
            :pending-payouts="pendingPayments.bookingPayouts"
            @close="toggleNotifications"
            @edit="handleEditBooking"
            @mark-complete="handleInstantComplete" />

        <div class="border-t border-mist-800 p-3 overflow-hidden">
            <div class="flex items-center justify-center gap-2 px-2 py-1 text-xs text-mist-500">
                <fa-icon
                    icon="copyright"
                    class="w-4 h-4 shrink-0" />
                <span class="truncate"> {{ currentYear }} - Danh Nguyen </span>
            </div>
        </div>

        <button
            type="button"
            class="absolute -right-3 bottom-3 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-mist-800 bg-mist-800 text-xs text-mist-300 shadow-md transition hover:bg-mist-700 hover:text-mist-100"
            :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar">
            <fa-icon
                icon="chevron-left"
                class="transition-transform duration-300"
                :class="{ 'rotate-180': isSidebarCollapsed }" />
        </button>
    </aside>
</template>
