<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { CHANNEL_WARNINGS } from '@/config/constants';
import { bookingStatuses } from '@/config/status';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights, getCurrentDate } from '@/utils/date';

import DatePicker from '@/components/ui/DatePicker.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';

const listingOptions = [
    { label: 'Airbnb', value: 'Airbnb' },
    { label: 'Booking.com', value: 'Booking.com' },
    { label: 'Tiket.com', value: 'Tiket.com' },
    { label: 'Trip.com', value: 'Trip.com' },
    { label: 'Unavailable', value: 'Unavailable' },
    { label: 'Whatsapp', value: 'Whatsapp' },
];
const statusOptions = bookingStatuses.map((status) => ({
    label: status,
    value: status,
}));

const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { bookingToEdit = null, currentProperty = 'all' } = defineProps<{
    bookingToEdit?: Booking | null;
    currentProperty?: PropertyId | 'all';
}>();
const emit = defineEmits<{
    close: [];
    save: [payload: Omit<Booking, 'id' | 'createdAt'>];
}>();

const bookingStore = useBookingStore();
const { deleteBooking } = useBookingSync();

const resolveInitialProperty = (): PropertyId | '' => {
    if (bookingToEdit?.propertyId) return bookingToEdit.propertyId as PropertyId;
    if (currentProperty && currentProperty !== 'all') return currentProperty;
    return '';
};

const form = ref({
    propertyId: resolveInitialProperty(),
    bookingId: bookingToEdit?.bookingId || '',
    guestName: bookingToEdit?.guestName || '',
    checkIn: bookingToEdit?.checkIn || getCurrentDate(),
    checkOut: bookingToEdit?.checkOut || '',
    nights: bookingToEdit?.nights || 1,
    payout: bookingToEdit?.payout || '',
    listing: bookingToEdit?.listing || '',
    status: bookingToEdit?.status || 'Booked',
    notes: bookingToEdit?.notes || '',
});

const stayDates = computed<[string, string]>({
    get: (): [string, string] => [form.value.checkIn, form.value.checkOut],
    set: ([start, end]: [string, string]) => {
        form.value.checkIn = start || '';
        form.value.checkOut = end || '';
        if (start && end) {
            form.value.nights = calculateNights(start, end);
        }
    },
});
const validationError = computed<string | null>(() => {
    if (!form.value.checkIn || !form.value.checkOut) return null;
    if (!form.value.propertyId) return 'Please select a property.';
    if (!form.value.listing) return 'Please select a channel.';
    if (form.value.checkIn >= form.value.checkOut)
        return 'Check-out date must be after check-in date.';

    const conflictingBooking = bookingStore.hasDateConflict(
        form.value.propertyId,
        form.value.checkIn,
        form.value.checkOut,
        bookingToEdit?.bookingId
    );

    if (conflictingBooking) {
        return `Date conflict! Overlaps with booking ${conflictingBooking.bookingId} (${conflictingBooking.guestName}: ${conflictingBooking.checkIn} to ${conflictingBooking.checkOut}).`;
    }

    return null;
});
const channelWarning = computed<string | undefined>(() => CHANNEL_WARNINGS[form.value.listing]);
const checkInMinDate = computed(() => (bookingToEdit ? '' : getCurrentDate()));
const propertyType = computed(() =>
    sortedProperties.value.map((property) => ({
        label: property.name,
        value: property.id,
    }))
);

async function handleDeleteBooking(): Promise<void> {
    if (!bookingToEdit) return;
    await deleteBooking(bookingToEdit);
    emit('close');
}
function handleSubmit(): void {
    if (validationError.value) return;

    const propertyId = form.value.propertyId;

    if (!propertyId) return;

    emit('save', {
        propertyId,
        bookingId: form.value.bookingId.trim(),
        guestName: form.value.guestName.trim(),
        checkIn: form.value.checkIn,
        checkOut: form.value.checkOut,
        nights: Number(form.value.nights),
        payout: Number(form.value.payout),
        listing: form.value.listing as Booking['listing'],
        status: form.value.status,
        notes: form.value.notes?.trim(),
    });
    emit('close');
}
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
            <div
                class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
                <!-- Modal Header -->
                <div
                    class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                    <h2 class="font-semibold text-mist-100">
                        {{ bookingToEdit ? 'Edit Booking' : 'New Booking' }}
                    </h2>
                    <button
                        type="button"
                        class="cursor-pointer text-mist-400 hover:text-mist-200"
                        @click="emit('close')">
                        <fa-icon
                            class="text-xs"
                            icon="xmark" />
                    </button>
                </div>

                <div
                    v-if="channelWarning"
                    class="rounded-md border border-amber-500/30 bg-amber-500/10 py-4 px-2 text-xs text-amber-300">
                    <ul class="ml-4 list-disc">
                        <li>{{ channelWarning }}</li>
                    </ul>
                </div>

                <div
                    v-if="validationError"
                    class="rounded-md border border-rose-500/30 bg-rose-500/10 py-4 px-2 text-xs text-rose-300">
                    {{ validationError }}
                </div>

                <form
                    class="max-h-[80vh] overflow-y-auto space-y-4"
                    @submit.prevent="handleSubmit">
                    <!-- Property Selection -->
                    <SelectDropdown
                        v-model="form.propertyId"
                        input-label="Type"
                        placeholder="Select property"
                        :options="propertyType" />

                    <!-- Booking ID & Guest Name -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInput
                            id="bookingId"
                            v-model.trim="form.bookingId"
                            input-label="Booking ID"
                            type="text"
                            placeholder="MHJ-000000"
                            required
                            :disabled="Boolean(bookingToEdit)">
                            <template #icon>
                                <fa-icon
                                    icon="hashtag"
                                    class="text-xs" />
                            </template>
                        </TextInput>

                        <TextInput
                            id="guestName"
                            v-model="form.guestName"
                            input-label="Guest Name"
                            type="text"
                            placeholder="Full Name"
                            required>
                            <template #icon>
                                <fa-icon
                                    icon="id-card"
                                    class="text-xs" />
                            </template>
                        </TextInput>
                    </div>

                    <!-- Dates & Nights -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div class="sm:col-span-2">
                            <DatePicker
                                v-model="stayDates"
                                mode="range"
                                input-label="Stay Dates (Check In → Check Out)"
                                placeholder="Select check-in & check-out dates"
                                :min-date="checkInMinDate" />
                        </div>

                        <div>
                            <span class="block font-medium text-xs text-mist-400 mb-1">
                                Nights
                            </span>
                            <div
                                class="flex items-center h-8 px-2 font-mono text-xs font-medium select-none">
                                {{ form.nights }}
                            </div>
                        </div>
                    </div>

                    <!-- Channel, Status & Payout -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <SelectDropdown
                            v-model="form.listing"
                            input-label="Channel"
                            placeholder="Select channel"
                            :options="listingOptions" />

                        <SelectDropdown
                            v-model="form.status"
                            input-label="Status"
                            placeholder="Select status"
                            :options="statusOptions" />

                        <TextInput
                            id="payout"
                            v-model.number="form.payout"
                            input-label="Payout"
                            type="number"
                            min="1"
                            placeholder="1.000.000"
                            required>
                            <template #icon>
                                <fa-icon
                                    icon="rupiah-sign"
                                    class="text-xs" />
                            </template>
                        </TextInput>
                    </div>

                    <!-- Notes -->
                    <TextInput
                        id="notes"
                        v-model.trim="form.notes"
                        input-label="Notes"
                        type="text"
                        placeholder="Special requests, extra beds..." />

                    <!-- Action Controls -->
                    <div
                        class="flex gap-3"
                        :class="[Boolean(bookingToEdit) ? 'justify-between' : 'justify-end']">
                        <button
                            v-if="Boolean(bookingToEdit)"
                            type="button"
                            class="cursor-pointer py-2 text-xs font-semibold text-rose-400 hover:text-rose-300"
                            @click="handleDeleteBooking">
                            <fa-icon
                                class="text-xs"
                                icon="trash-can" />
                            Delete booking
                        </button>
                        <div class="flex items-center gap-4">
                            <button
                                type="button"
                                class="cursor-pointer px-4 py-2 text-xs font-semibold text-mist-400 hover:text-mist-200"
                                @click="emit('close')">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="Boolean(validationError)"
                                class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">
                                {{ bookingToEdit ? 'Update Booking' : 'Save Booking' }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
