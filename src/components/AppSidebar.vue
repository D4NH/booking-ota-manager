<!-- src/components/AppSidebar.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { getPropertyTheme } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useDateKeys } from '@/composables/useDateKeys';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import { formatDate, getCurrentDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { currentDay } = useDateKeys();
const modalStore = useModalStore();

const isCollapsed = ref(false);

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
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-500 font-black text-mist-950">
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
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition text-mist-400 hover:bg-mist-800/60 hover:text-mist-200"
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

        <!-- Notifications -->
        <div class="flex items-center justify-between p-4">
            <div class="flex items-center space-x-2">
                <h2 class="text-sm font-bold text-mist-100">Notifications</h2>
                <span
                    v-if="pendingPayments.notificationsCount !== 0"
                    class="rounded-full bg-lime-500/20 px-2 py-0.5 text-[10px] font-semibold text-lime-400">
                    {{ pendingPayments.notificationsCount }} New
                </span>
            </div>
        </div>

        <div
            v-if="pendingPayments.notificationsCount === 0"
            class="py-12 text-center text-xs text-mist-500">
            No notifications
        </div>

        <!-- Pending Whatsapp Payments -->
        <div
            v-if="pendingPayments.whatsappPayments.length !== 0"
            class="border-t border-mist-800">
            <div
                class="flex items-center justify-between border-b border-mist-800/60 bg-mist-950/40 px-4 py-2 text-xs text-mist-400">
                Pending Whatsapp Payments
            </div>
            <div class="flex-1 overflow-y-auto divide-y divide-mist-800/40 p-4 space-y-2">
                <div
                    v-for="b in pendingPayments.whatsappPayments"
                    :key="b.id"
                    class="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <button
                                type="button"
                                class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                @click="handleEditBooking(b)">
                                <fa-icon icon="pen-to-square" />
                            </button>
                        </div>
                        <RouterLink
                            :to="{
                                name: 'property-detail',
                                params: { id: b.propertyId },
                            }"
                            class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                            :class="[
                                getPropertyTheme(b.propertyId).bg,
                                getPropertyTheme(b.propertyId).text,
                            ]">
                            {{ b.propertyId }}
                        </RouterLink>
                    </div>
                    <div class="flex justify-between text-xs text-mist-400">
                        <span>
                            {{ formatDate(b.checkIn, { shortMonth: true }) }}
                            &rarr;
                            {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                            {{ b.nights }} night(s)
                        </span>
                        <span>{{ b.listing }}</span>
                    </div>
                    <div class="flex justify-end text-xs text-mist-400">
                        <span class="font-mono text-lime-400">
                            {{ formatIDR(b.payout) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pending Payouts -->
        <div
            v-if="pendingPayments.bookingPayouts.length !== 0"
            class="border-t border-mist-800">
            <div
                class="flex items-center justify-between border-b border-mist-800/60 bg-mist-950/40 px-4 py-2 text-xs text-mist-400">
                Pending Booking Payouts
            </div>
            <div class="flex-1 overflow-y-auto divide-y divide-mist-800/40 p-4 space-y-2">
                <div
                    v-for="b in pendingPayments.bookingPayouts"
                    :key="b.id"
                    class="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-sm text-mist-200 truncate">
                                {{ b.guestName }}
                            </span>
                            <button
                                type="button"
                                class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                @click="handleEditBooking(b)">
                                <fa-icon icon="pen-to-square" />
                            </button>
                        </div>
                        <RouterLink
                            :to="{
                                name: 'property-detail',
                                params: { id: b.propertyId },
                            }"
                            class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                            :class="[
                                getPropertyTheme(b.propertyId).bg,
                                getPropertyTheme(b.propertyId).text,
                            ]">
                            {{ b.propertyId }}
                        </RouterLink>
                    </div>
                    <div class="flex justify-between text-xs text-mist-400">
                        <span>
                            {{ formatDate(b.checkIn, { shortMonth: true }) }}
                            &rarr;
                            {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                            {{ b.nights }} night(s)
                        </span>
                        <span>{{ b.listing }}</span>
                    </div>
                    <div class="flex justify-end text-xs text-mist-400">
                        <span class="font-mono text-lime-400">
                            {{ formatIDR(b.payout) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

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
            class="absolute -right-3 bottom-3 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-mist-700 bg-mist-800 text-xs text-mist-300 shadow-md transition hover:bg-mist-700 hover:text-mist-100"
            :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar">
            <fa-icon
                icon="chevron-left"
                class="transition-transform duration-300"
                :class="{ 'rotate-180': isCollapsed }" />
        </button>
    </aside>
</template>
