<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useBookingStore } from '@/stores/useBookingStore';
import { PROPERTY_LIST, type PropertyId } from '@/config/properties';
import type { Booking } from '@/db';

const bookingStore = useBookingStore();

const props = defineProps<{
    bookingToEdit?: Booking | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', payload: Omit<Booking, 'id' | 'createdAt'>): void;
}>();

const form = ref({
    propertyId: (props.bookingToEdit?.propertyId as PropertyId) || 'piyungan',
    bookingId: props.bookingToEdit?.bookingId || '',
    guestName: props.bookingToEdit?.guestName || '',
    checkIn: props.bookingToEdit?.checkIn || '',
    checkOut: props.bookingToEdit?.checkOut || '',
    nights: props.bookingToEdit?.nights || 1,
    payout: props.bookingToEdit?.payout || 0,
    listing: props.bookingToEdit?.listing || 'Whatsapp',
    status: props.bookingToEdit?.status || 'Booked',
    notes: props.bookingToEdit?.notes || '',
});
const checkIn = ref<string>('');
const checkOut = ref<string>('');

const validationError = computed<string | null>(() => {
    if (!form.value.checkIn || !form.value.checkOut) return null;

    if (form.value.checkIn >= form.value.checkOut) {
        return 'Check-out date must be after check-in date.';
    }

    const conflictingBooking = bookingStore.hasDateConflict(
        form.value.propertyId,
        form.value.checkIn,
        form.value.checkOut,
        props.bookingToEdit?.bookingId
    );

    if (conflictingBooking) {
        return `Date conflict! Overlaps with booking ${conflictingBooking.bookingId} (${conflictingBooking.guestName}: ${conflictingBooking.checkIn} to ${conflictingBooking.checkOut}).`;
    }

    return null;
});

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

const handleSubmit = (): void => {
    if (validationError.value) return;

    emit('save', {
        propertyId: form.value.propertyId,
        bookingId: form.value.bookingId.trim(),
        guestName: form.value.guestName.trim(),
        checkIn: form.value.checkIn,
        checkOut: form.value.checkOut,
        nights: Number(form.value.nights),
        payout: Number(form.value.payout),
        listing: form.value.listing,
        status: form.value.status,
        notes: form.value.notes?.trim(),
    });
    emit('close');
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

const calculateNights = (): void => {
    if (form.value.checkIn && form.value.checkOut) {
        const start = new Date(form.value.checkIn).getTime();
        const end = new Date(form.value.checkOut).getTime();
        const diffDays = Math.ceil((end - start) / (1000 * 3600 * 24));
        form.value.nights = diffDays > 0 ? diffDays : 1;
    }
};
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/80 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-lg space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-6 shadow-2xl">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                <h2 class="text-base font-bold text-mist-100">
                    {{ bookingToEdit ? 'Edit Booking' : 'Add New Booking' }}
                </h2>
                <button
                    type="button"
                    class="text-mist-400 hover:text-mist-200"
                    @click="emit('close')">
                    &times;
                </button>
            </div>

            <div
                v-if="validationError"
                class="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {{ validationError }}
            </div>

            <form
                class="space-y-4"
                @submit.prevent="handleSubmit">
                <!-- Property Selection -->
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">Property</label>
                    <select
                        v-model="form.propertyId"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                        required>
                        <option
                            v-for="prop in PROPERTY_LIST"
                            :key="prop.id"
                            :value="prop.id">
                            {{ prop.name }}
                        </option>
                    </select>
                </div>

                <!-- Booking ID & Guest Name -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">
                            Booking ID
                            <span
                                v-if="bookingToEdit"
                                class="text-[10px] font-normal text-amber-400/80">
                                (Cannot be changed)
                            </span>
                        </label>
                        <input
                            v-model="form.bookingId"
                            type="text"
                            placeholder="e.g. MHJ-000000"
                            :disabled="Boolean(bookingToEdit)"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none disabled:border-gray-700 disabled:bg-gray-800/20"
                            required />
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">
                            Guest Name
                        </label>
                        <input
                            v-model="form.guestName"
                            type="text"
                            placeholder="Full name"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"
                            required />
                    </div>
                </div>

                <!-- Dates & Nights -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">Check In</label>
                        <input
                            v-model="form.checkIn"
                            type="date"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required
                            min="2024-01-01"
                            max="2030-12-31"
                            @blur="sanitizeDate('checkIn')"
                            @change="calculateNights" />
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">
                            Check Out
                        </label>
                        <input
                            v-model="form.checkOut"
                            type="date"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required
                            :min="checkIn || '2024-01-01'"
                            max="2030-12-31"
                            @blur="sanitizeDate('checkOut')"
                            @change="calculateNights" />
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">Nights</label>
                        <input
                            v-model.number="form.nights"
                            type="number"
                            min="1"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required />
                    </div>
                </div>

                <!-- Channel, Status & Payout -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">Channel</label>
                        <select
                            v-model="form.listing"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none">
                            <option value="Whatsapp">WhatsApp</option>
                            <option value="Airbnb">Airbnb</option>
                            <option value="Booking.com">Booking.com</option>
                            <option value="Tiket.com">Tiket.com</option>
                            <option value="Trip.com">Trip.com</option>
                            <option value="Unavailable">Unavailable</option>
                        </select>
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">Status</label>
                        <select
                            v-model="form.status"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none">
                            <option value="Booked">Booked</option>
                            <option value="Checked-in">Checked-in</option>
                            <option value="Waiting for payment">Waiting for payment</option>
                            <option value="Waiting for payout">Waiting for payout</option>
                            <option value="Completed">Completed</option>
                            <option value="No show">No show</option>
                            <option value="Unavailable">Unavailable</option>
                        </select>
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">
                            Payout (IDR)
                        </label>
                        <input
                            v-model.number="form.payout"
                            type="number"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required />
                    </div>
                </div>

                <!-- Notes -->
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">
                        Notes (Optional)
                    </label>
                    <textarea
                        v-model="form.notes"
                        rows="2"
                        placeholder="Special requests, extra beds..."
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"></textarea>
                </div>

                <!-- Action Controls -->
                <div class="flex justify-end gap-3 pt-3">
                    <button
                        type="button"
                        class="px-4 py-2 text-xs font-semibold text-mist-400 hover:text-mist-200"
                        @click="emit('close')">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="Boolean(validationError)"
                        class="rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">
                        {{ bookingToEdit ? 'Update Booking' : 'Save Booking' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
