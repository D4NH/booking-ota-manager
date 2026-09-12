<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { NavItem } from '@/types/navigation';
import { getCurrentDate } from '@/utils/date';

import NotificationsPopover from '@/components/NotificationsPopover.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const route = useRoute();

const isCollapsed = ref(false);
const isNotificationOpen = ref(true);

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
const handleEditBooking = (booking: Booking) => {
    modalStore.openBookingModal({ booking });
};

const navLinks: NavItem[] = [
    { name: 'Dashboard', path: '/', icon: 'table-cells-large' },
    { name: 'Bookings', path: '/bookings', icon: 'calendar-check' },
    { name: 'Calendar', path: '/calendar', icon: 'calendar-days' },
    { name: 'Properties', path: '/properties', icon: 'house' },
    { name: 'Finance', path: '/finance', icon: 'chart-pie' },
];

const isLinkActive = (linkPath?: string): boolean => {
    if (!linkPath) return false;

    if (linkPath === '/') {
        return route.path === '/';
    }

    return route.path.startsWith(linkPath);
};
const toggleSidebar = () => {
    isCollapsed.value = !isCollapsed.value;
    isNotificationOpen.value = false;
};
const toggleNotifications = () => {
    isNotificationOpen.value = !isNotificationOpen.value;
};
const currentYear = new Date().getFullYear();
</script>

<template>
    <aside
        :class="[
            'relative flex flex-col shrink-0 border border-mist-800 bg-mist-900 transition-all duration-300 ease-in-out',
            isCollapsed ? 'w-16' : 'w-60',
        ]">
        <div class="flex h-14 items-center border-b border-mist-800 px-4 overflow-hidden">
            <div class="flex items-center gap-3">
                <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-lime-500 font-black text-mist-950">
                    M
                </div>
                <span
                    v-show="!isCollapsed"
                    class="font-bold text-mist-100 text-nowrap transition-opacity duration-200">
                    Mai House Jogja
                </span>
            </div>
        </div>

        <nav class="flex-1 space-y-1.5 p-3 overflow-hidden">
            <RouterLink
                v-for="link in navLinks"
                :key="link.name"
                :to="link.path"
                :class="[
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isLinkActive(link.path)
                        ? 'bg-mist-800 text-lime-400 font-semibold shadow-sm'
                        : 'text-mist-400 hover:bg-mist-800/60 hover:text-mist-200',
                ]">
                <fa-icon
                    :icon="link.icon"
                    class="w-4 h-4 shrink-0" />
                <span>{{ link.name }}</span>
            </RouterLink>
        </nav>

        <NotificationsPopover
            :is-open="isNotificationOpen"
            :pending-payments="pendingPayments.whatsappPayments"
            :pending-payouts="pendingPayments.bookingPayouts"
            @close="toggleNotifications"
            @edit="handleEditBooking" />

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
            class="absolute -right-3 bottom-3 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-mist-700 bg-mist-800 text-xs text-mist-300 shadow-md transition hover:bg-mist-700 hover:text-mist-100"
            :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar">
            <fa-icon
                icon="chevron-left"
                class="transition-transform duration-300"
                :class="{ 'rotate-180': isCollapsed }" />
        </button>
    </aside>
</template>
