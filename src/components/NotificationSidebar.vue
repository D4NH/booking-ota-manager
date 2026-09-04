<script setup lang="ts">
import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { getPropertyTheme } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useDateKeys } from '@/composables/useDateKeys';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import { formatDate, getCurrentDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: 'booking' | 'payment' | 'system';
    read: boolean;
}

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { currentDayStr } = useDateKeys();
const modalStore = useModalStore();

defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    close: [];
    'has-notifications': [boolean];
}>();

const propertyBookings = computed(() => bookings.value);
const pendingPayments = computed(() => {
    const isPaymentDueOneDayBeforeCheckIn = (checkIn: string): boolean => {
        const checkInDate = new Date(checkIn);
        checkInDate.setDate(checkInDate.getDate() - 1);

        return getCurrentDate(checkInDate) === currentDayStr.value;
    };
    const whatsappPayments = propertyBookings.value.filter(
        (b) =>
            b.listing === 'Whatsapp' &&
            b.status === 'Waiting for payment' &&
            isPaymentDueOneDayBeforeCheckIn(b.checkIn)
    );
    const bookingPayouts = propertyBookings.value.filter((b) => b.status === 'Waiting for payout');
    const allNotifications = [...whatsappPayments, ...bookingPayouts];
    const notificationsCount = allNotifications.length;

    return {
        whatsappPayments,
        bookingPayouts,
        notificationsCount,
    };
});

// onMounted(() => {
//     emit('has-notifications', Boolean(pendingPayments.value.notificationsCount));
// });
watch(
    () => pendingPayments.value,
    () => {
        emit('has-notifications', Boolean(pendingPayments.value.notificationsCount));
    },
    { immediate: true }
);

const handleEditBooking = (booking: Booking) => {
    modalStore.openBookingModal({ booking });
};
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div
                v-if="isOpen"
                class="fixed inset-0 z-40 bg-mist-950/60 backdrop-blur-sm"
                @click="emit('close')" />
        </Transition>

        <Transition name="slide">
            <aside
                v-if="isOpen"
                class="fixed top-0 right-0 z-50 flex h-full w-80 max-w-[calc(100vw-2rem)] flex-col border-l border-mist-800 bg-mist-900 shadow-2xl">
                <!-- Sidebar Header -->
                <div class="flex items-center justify-between p-4">
                    <div class="flex items-center space-x-2">
                        <h2 class="text-sm font-bold text-mist-100">Notifications</h2>
                        <span
                            v-if="pendingPayments.notificationsCount !== 0"
                            class="rounded-full bg-lime-500/20 px-2 py-0.5 text-[10px] font-semibold text-lime-400">
                            {{ pendingPayments.notificationsCount }} New
                        </span>
                    </div>
                    <button
                        type="button"
                        class="rounded-lg p-1 text-mist-400 hover:bg-mist-800 hover:text-mist-100 transition"
                        @click="emit('close')">
                        ✕
                    </button>
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
            </aside>
        </Transition>
    </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-enter-from,
.slide-leave-to {
    transform: translateX(100%);
}
</style>
