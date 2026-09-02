import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

export const useModalStore = defineStore('modal', () => {
    const isBookingModalOpen = ref(false);
    const bookingToEdit = ref<Booking | null>(null);
    const initialCheckInDate = ref('');
    const currentProperty = ref<PropertyId | 'all'>('all');

    const openBookingModal = (options?: {
        booking?: Booking | null;
        checkInDate?: string;
        propertyId?: PropertyId | 'all';
    }) => {
        bookingToEdit.value = options?.booking || null;
        initialCheckInDate.value = options?.checkInDate || '';
        currentProperty.value = options?.propertyId || 'all';
        isBookingModalOpen.value = true;
    };

    const closeBookingModal = () => {
        isBookingModalOpen.value = false;
        bookingToEdit.value = null;
        initialCheckInDate.value = '';
    };

    return {
        isBookingModalOpen,
        bookingToEdit,
        initialCheckInDate,
        currentProperty,
        openBookingModal,
        closeBookingModal,
    };
});
