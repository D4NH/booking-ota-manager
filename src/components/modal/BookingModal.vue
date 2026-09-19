<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { CHANNEL_WARNINGS } from '@/config/constants';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights, getCurrentDate } from '@/utils/date';

const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const {
    bookingToEdit = null,
    initialCheckInDate = getCurrentDate(),
    currentProperty = 'all',
} = defineProps<{
    bookingToEdit?: Booking | null;
    initialCheckInDate?: string;
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
    checkIn: bookingToEdit?.checkIn || initialCheckInDate || getCurrentDate(),
    checkOut: bookingToEdit?.checkOut || '',
    nights: bookingToEdit?.nights || 1,
    payout: bookingToEdit?.payout || '',
    listing: bookingToEdit?.listing || '',
    status: bookingToEdit?.status || 'Booked',
    notes: bookingToEdit?.notes || '',
});
const checkIn = ref<string>('');
const checkOut = ref<string>('');

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

const handleDeleteBooking = async (): Promise<void> => {
    if (!bookingToEdit) return;
    await deleteBooking(bookingToEdit);
    emit('close');
};
const handleSubmit = () => {
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
};
const sanitizePayout = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const cleanedString = target.value.replace(/\D/g, '');
    form.value.payout = cleanedString ? parseInt(cleanedString, 10) : 0;
    target.value = cleanedString;
};
const sanitizeDate = (field: 'checkIn' | 'checkOut') => {
    const rawVal = field === 'checkIn' ? checkIn.value : checkOut.value;
    if (!rawVal) return;

    const dateObj = new Date(rawVal);
    if (!isNaN(dateObj.getTime())) {
        const formatted = dateObj.toISOString().split('T')[0] || '';
        if (field === 'checkIn') checkIn.value = formatted;
        else checkOut.value = formatted;
    }
};
const triggerDatePicker = (event: MouseEvent): void => {
    const target = event.currentTarget as HTMLInputElement | null;

    try {
        target?.showPicker();
    } catch {
        target?.focus();
    }
};

watch(
    () => [form.value.checkIn, form.value.checkOut],
    ([start, end]) => {
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const diffTime = endDate.getTime() - startDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            form.value.nights = diffDays > 0 ? diffDays : 1;
        }
    }
);
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div
                class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
                <!-- Modal Header -->
                <div
                    class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                    <h2 class="text-base font-semibold text-mist-100">
                        {{ bookingToEdit ? 'Edit Booking' : 'New Booking' }}
                    </h2>
                    <button
                        type="button"
                        class="cursor-pointer text-mist-400 hover:text-mist-200"
                        @click="emit('close')">
                        <fa-icon icon="xmark" />
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
                    <div class="relative">
                        <label
                            for="property"
                            class="block text-xs font-medium text-mist-400">
                            Property
                        </label>
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 left-3 flex items-center text-mist-500">
                            <fa-icon
                                class="text-xs"
                                icon="house" />
                        </div>
                        <select
                            id="property"
                            v-model="form.propertyId"
                            name="property"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 pl-9 pr-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                            <option
                                value=""
                                disabled>
                                Select property
                            </option>
                            <option
                                v-for="prop in sortedProperties"
                                :key="prop.id"
                                :value="prop.id">
                                {{ prop.name }}
                            </option>
                        </select>
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                            <fa-icon
                                class="text-xs"
                                icon="angle-down" />
                        </div>
                    </div>

                    <!-- Booking ID & Guest Name -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div class="relative">
                            <label
                                for="bookingId"
                                class="block text-xs font-medium text-mist-400">
                                Booking ID
                            </label>
                            <div
                                class="absolute inset-y-0 top-5 left-3 flex items-center pointer-events-none text-mist-500">
                                <fa-icon
                                    icon="hashtag"
                                    class="text-xs" />
                            </div>
                            <input
                                id="bookingId"
                                v-model="form.bookingId"
                                type="text"
                                placeholder="MHJ-000000"
                                :disabled="Boolean(bookingToEdit)"
                                :class="{
                                    'cursor-not-allowed disabled:bg-mist-900':
                                        Boolean(bookingToEdit),
                                }"
                                class="w-full rounded-md bg-mist-950/50 border border-mist-800 mt-1 pl-9 pr-3 py-2 text-sm text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors"
                                required />
                        </div>
                        <div class="relative">
                            <label class="block text-xs font-medium text-mist-400">
                                Guest Name
                            </label>
                            <div
                                class="absolute inset-y-0 top-5 left-3 flex items-center pointer-events-none text-mist-500">
                                <fa-icon
                                    icon="id-card"
                                    class="text-xs" />
                            </div>
                            <input
                                v-model="form.guestName"
                                type="text"
                                placeholder="Full Name"
                                class="w-full rounded-md bg-mist-950/50 border border-mist-800 mt-1 pl-9 pr-3 py-2 text-sm text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors"
                                required />
                        </div>
                    </div>

                    <!-- Dates & Nights -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div class="relative">
                            <label class="block text-xs font-medium text-mist-400">
                                Check In
                            </label>
                            <input
                                v-model="form.checkIn"
                                type="date"
                                class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                                required
                                :min="checkInMinDate"
                                max="2028-12-31"
                                @click="triggerDatePicker"
                                @blur="sanitizeDate('checkIn')"
                                @change="calculateNights(form.checkIn, form.checkOut)" />
                            <div
                                class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-500">
                                <fa-icon
                                    class="text-sm"
                                    icon="calendar-days" />
                            </div>
                        </div>
                        <div class="relative">
                            <label class="block text-xs font-medium text-mist-400">
                                Check Out
                            </label>
                            <input
                                v-model="form.checkOut"
                                type="date"
                                class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                                required
                                :min="form.checkIn"
                                max="2028-12-31"
                                @click="triggerDatePicker"
                                @blur="sanitizeDate('checkOut')"
                                @change="calculateNights(form.checkIn, form.checkOut)" />
                            <div
                                class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-500">
                                <fa-icon
                                    class="text-sm"
                                    icon="calendar-days" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-mist-400"> Nights </label>
                            <input
                                v-model.number="form.nights"
                                type="number"
                                min="1"
                                disabled
                                class="w-full mt-1 p-2 text-sm text-mist-200 focus:outline-none" />
                        </div>
                    </div>

                    <!-- Channel, Status & Payout -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div class="relative">
                            <label class="block text-xs font-medium text-mist-400"> Channel </label>
                            <select
                                v-model="form.listing"
                                class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                                <option
                                    value=""
                                    disabled>
                                    --
                                </option>
                                <option value="Airbnb">Airbnb</option>
                                <option value="Booking.com">Booking.com</option>
                                <option value="Tiket.com">Tiket.com</option>
                                <option value="Trip.com">Trip.com</option>
                                <option value="Unavailable">Unavailable</option>
                                <option value="Whatsapp">WhatsApp</option>
                            </select>
                            <div
                                class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                                <fa-icon
                                    class="text-xs"
                                    icon="angle-down" />
                            </div>
                        </div>

                        <div class="relative">
                            <label class="block text-xs font-medium text-mist-400"> Status </label>
                            <select
                                v-model="form.status"
                                name="status"
                                class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                                <option value="Booked">Booked</option>
                                <option value="Checked-in">Checked-in</option>
                                <option value="Waiting for payment">Waiting for payment</option>
                                <option value="Waiting for payout">Waiting for payout</option>
                                <option value="Completed">Completed</option>
                                <option value="No show">No show</option>
                                <option value="Unavailable">Unavailable</option>
                            </select>
                            <div
                                class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                                <fa-icon
                                    class="text-xs"
                                    icon="angle-down" />
                            </div>
                        </div>

                        <div class="relative">
                            <label class="block text-xs font-medium text-mist-400">
                                Payout (IDR)
                            </label>
                            <div
                                class="absolute inset-y-0 top-5 left-3 flex items-center pointer-events-none text-mist-500">
                                <fa-icon
                                    icon="rupiah-sign"
                                    class="text-xs" />
                            </div>
                            <input
                                :value="form.payout"
                                type="number"
                                placeholder="1000000"
                                class="w-full rounded-md bg-mist-950/50 border border-mist-800 mt-1 pl-8 pr-4 py-2 text-sm text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors"
                                required
                                @input="sanitizePayout" />
                        </div>
                    </div>

                    <!-- Notes -->
                    <div>
                        <label class="block text-xs font-medium text-mist-400"> Notes </label>
                        <textarea
                            v-model="form.notes"
                            rows="3"
                            placeholder="Special requests, extra beds..."
                            class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950/50 px-3 py-2.5 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none" />
                    </div>

                    <!-- Action Controls -->
                    <div
                        class="flex gap-3"
                        :class="[Boolean(bookingToEdit) ? 'justify-between' : 'justify-end']">
                        <button
                            v-if="Boolean(bookingToEdit)"
                            type="button"
                            class="cursor-pointer py-2 text-xs font-semibold text-rose-400 hover:text-rose-300"
                            @click="handleDeleteBooking">
                            <fa-icon icon="trash-can" /> Delete booking
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
