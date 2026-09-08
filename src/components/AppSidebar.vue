<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useDateKeys } from '@/composables/useDateKeys';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import { getCurrentDate } from '@/utils/date';

import NotificationsPopover from '@/components/NotificationsPopover.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { currentDay } = useDateKeys();
const modalStore = useModalStore();

const isCollapsed = ref(false);
const isNotificationCollapsed = ref(true);

const pendingPayments = computed(() => {
    const isPaymentDueOneDayBeforeCheckIn = (checkIn: string): boolean => {
        const checkInDate = new Date(checkIn);
        checkInDate.setDate(checkInDate.getDate() - 1);

        return getCurrentDate(checkInDate) === currentDay.value;
    };
    const whatsappPayments = bookings.value.filter(
        (b) =>
            (b.listing === 'Whatsapp' &&
                b.status === 'Waiting for payment' &&
                isPaymentDueOneDayBeforeCheckIn(b.checkIn)) ||
            getCurrentDate(new Date(b.checkIn)) === currentDay.value
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
const navLinks = [
    { name: 'Dashboard', to: '/', icon: 'table-cells-large' },
    { name: 'Bookings', to: { name: 'bookings' }, icon: 'calendar-check' },
    { name: 'Calendar', to: { name: 'calendar' }, icon: 'calendar-days' },
    { name: 'Properties', to: { name: 'properties' }, icon: 'house' },
    { name: 'Finance', to: { name: 'finance' }, icon: 'chart-pie' },
];
const toggleSidebar = () => {
    isCollapsed.value = !isCollapsed.value;
};
const toggleNotifications = () => {
    isNotificationCollapsed.value = !isNotificationCollapsed.value;
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
                    Mai House
                </span>
            </div>
        </div>

        <nav class="flex-1 space-y-1.5 p-3 overflow-hidden">
            <RouterLink
                v-for="link in navLinks"
                :key="link.name"
                :to="link.to"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition text-mist-400 hover:bg-mist-800/60 hover:text-mist-200"
                active-class="bg-mist-800 text-lime-400 font-semibold shadow-sm">
                <fa-icon
                    :icon="link.icon"
                    class="w-4 h-4 shrink-0 text-center" />
                <span
                    v-show="!isCollapsed"
                    class="truncate transition-opacity duration-200">
                    {{ link.name }}
                </span>
            </RouterLink>
        </nav>

        <NotificationsPopover
            :is-open="isNotificationCollapsed"
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
