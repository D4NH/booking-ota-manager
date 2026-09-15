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

import AppSidebar from '@/components/AppSidebar.vue';
import BookingModal from '@/components/modal/BookingModal.vue';
import PropertyModal from '@/components/modal/PropertyModal.vue';

useHead({
    title: 'Mai House - Booking OTA Manager',
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
    <div class="flex h-screen w-screen overflow-hidden">
        <AppSidebar class="shrink-0" />

        <main class="flex flex-1 flex-col min-w-0 min-h-0">
            <!-- Scrollable views: h-full overflow-y-auto to the root element -->
            <!-- Fixed views: h-full overflow-hidden flex flex-col to lock the page -->
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
    </div>
</template>
