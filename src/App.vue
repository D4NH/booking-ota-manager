<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useHead } from '@unhead/vue';
import { useBookingSync } from '@/composables/useBookingSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';

import { ToastContainer } from 'vue-toastflow';

import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import BookingModal from '@/components/BookingModal.vue';
import PropertyModal from '@/components/PropertyModal.vue';

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
const {
    isBookingModalOpen,
    bookingToEdit,
    initialCheckInDate,
    currentProperty,
    isPropertyModalOpen,
    propertyToEdit,
} = storeToRefs(modalStore);
const propertyStore = usePropertyStore();

const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    const success = await saveBooking(payload, bookingToEdit.value);
    if (success) {
        modalStore.closeBookingModal();
    }
};
const handleSaveProperty = async (propertyData: Property): Promise<void> => {
    await propertyStore.saveProperty(propertyData);
    modalStore.closePropertyModal();
};

onMounted(async () => {
    await Promise.all([propertyStore.loadProperties(), bookingStore.loadBookings()]);
});
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

        <PropertyModal
            v-if="isPropertyModalOpen"
            :property-to-edit="propertyToEdit"
            :current-property="currentProperty"
            @close="modalStore.closePropertyModal"
            @save="handleSaveProperty" />

        <ToastContainer />
        <AppFooter />
    </div>
</template>
