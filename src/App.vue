<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useHead } from '@unhead/vue';
import { useBookingSync } from '@/composables/useBookingSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';

import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import BookingModal from '@/components/BookingModal.vue';

useHead({
    title: 'Mai House Jogja',
    meta: [
        {
            name: 'viewport',
            content: 'width=device-width, initial-scale=1.0',
        },
    ],
});
const { saveBooking } = useBookingSync();
const bookingStore = useBookingStore();
const modalStore = useModalStore();
const { isBookingModalOpen, bookingToEdit, initialCheckInDate, currentProperty } =
    storeToRefs(modalStore);
const propertyStore = usePropertyStore();

onMounted(async () => {
    await Promise.all([propertyStore.loadProperties(), bookingStore.loadBookings()]);
});

const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    const success = await saveBooking(payload, bookingToEdit.value);
    if (success) {
        modalStore.closeBookingModal();
    }
};
</script>

<template>
    <div class="flex flex-col min-h-screen px-6">
        <AppHeader />

        <main class="grow">
            <RouterView />
        </main>

        <BookingModal
            v-if="isBookingModalOpen"
            :booking-to-edit="bookingToEdit"
            :initial-check-in-date="initialCheckInDate"
            :current-property="currentProperty"
            @close="modalStore.closeBookingModal"
            @save="handleSaveBooking" />

        <AppFooter />
    </div>
</template>
