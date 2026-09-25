import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';

export const useModalStore = defineStore('modal', () => {
    const isBookingModalOpen = ref(false);
    const bookingToEdit = ref<Booking | null>(null);
    const initialCheckInDate = ref('');
    const currentProperty = ref<PropertyId | 'all'>('all');
    const isPropertyModalOpen = ref(false);
    const propertyToEdit = ref<Property | null>(null);

    function openBookingModal(options?: {
        booking?: Booking | null;
        checkInDate?: string;
        propertyId?: PropertyId | 'all';
    }) {
        bookingToEdit.value = options?.booking || null;
        currentProperty.value = options?.propertyId || 'all';
        initialCheckInDate.value = options?.checkInDate || '';
        isBookingModalOpen.value = true;
    }
    function closeBookingModal() {
        bookingToEdit.value = null;
        initialCheckInDate.value = '';
        isBookingModalOpen.value = false;
    }
    function openPropertyModal(options?: {
        property?: Property | null;
        propertyId?: PropertyId | 'all';
    }) {
        currentProperty.value = options?.propertyId || 'all';
        propertyToEdit.value = options?.property || null;
        isPropertyModalOpen.value = true;
    }
    function closePropertyModal() {
        propertyToEdit.value = null;
        isPropertyModalOpen.value = false;
    }

    return {
        isBookingModalOpen,
        bookingToEdit,
        initialCheckInDate,
        currentProperty,
        isPropertyModalOpen,
        propertyToEdit,
        openBookingModal,
        closeBookingModal,
        openPropertyModal,
        closePropertyModal,
    };
});
