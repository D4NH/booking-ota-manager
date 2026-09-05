<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useBookingSync } from '@/composables/useBookingSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { useDateKeys } from '@/composables/useDateKeys';
import { PROPERTY_LIST } from '@/config/properties';
import { CHANNEL_WARNINGS } from '@/config/constants';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

const props = defineProps<{
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
const { currentDayStr } = useDateKeys();

const resolveInitialProperty = (): PropertyId | '' => {
    if (props.bookingToEdit?.propertyId) return props.bookingToEdit.propertyId as PropertyId;
    if (props.currentProperty && props.currentProperty !== 'all') return props.currentProperty;
    return '';
};

const form = ref({
    propertyId: resolveInitialProperty(),
    bookingId: props.bookingToEdit?.bookingId || '',
    guestName: props.bookingToEdit?.guestName || '',
    checkIn: props.bookingToEdit?.checkIn || props.initialCheckInDate || '',
    checkOut: props.bookingToEdit?.checkOut || '',
    nights: props.bookingToEdit?.nights || 1,
    payout: props.bookingToEdit?.payout || 0,
    listing: props.bookingToEdit?.listing || '',
    status: props.bookingToEdit?.status || 'Booked',
    notes: props.bookingToEdit?.notes || '',
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
        props.bookingToEdit?.bookingId
    );

    if (conflictingBooking) {
        return `Date conflict! Overlaps with booking ${conflictingBooking.bookingId} (${conflictingBooking.guestName}: ${conflictingBooking.checkIn} to ${conflictingBooking.checkOut}).`;
    }

    return null;
});
const channelWarning = computed<string | undefined>(() => CHANNEL_WARNINGS[form.value.listing]);
const checkInMinDate = computed(() => (props.bookingToEdit ? '' : currentDayStr.value));

const handleDeleteBooking = async (): Promise<void> => {
    if (!props.bookingToEdit) return;
    await deleteBooking(props.bookingToEdit);
    emit('close');
};
const handleSubmit = () => {
    if (validationError.value) return;

    emit('save', {
        propertyId: form.value.propertyId,
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
const calculateNights = () => {
    if (form.value.checkIn && form.value.checkOut) {
        const start = new Date(form.value.checkIn).getTime();
        const end = new Date(form.value.checkOut).getTime();
        const diffDays = Math.ceil((end - start) / (1000 * 3600 * 24));
        form.value.nights = diffDays > 0 ? diffDays : 1;
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
            class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/80 p-4 backdrop-blur-sm">
            <div
                class="w-full max-w-2xl space-y-4 rounded-lg border border-mist-800 bg-mist-900 p-6 shadow-xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-base font-bold text-mist-100">
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
                    class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    <ul class="ml-4 list-disc">
                        <li>{{ channelWarning }}</li>
                    </ul>
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
                    <div class="relative">
                        <label class="mb-1 block text-xs font-medium text-mist-400">Property</label>
                        <select
                            v-model="form.propertyId"
                            class="w-full appearance-none rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required>
                            <option
                                value=""
                                disabled
                                selected>
                                --
                            </option>
                            <option
                                v-for="prop in PROPERTY_LIST"
                                :key="prop.id"
                                :value="prop.id">
                                {{ prop.name }}
                            </option>
                        </select>
                        <div
                            class="pointer-events-none absolute inset-y-0 right-0 top-5 flex items-center pr-2 text-mist-400">
                            <fa-icon
                                class="text-xs"
                                icon="angle-down" />
                        </div>
                    </div>

                    <!-- Booking ID & Guest Name -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Booking ID
                            </label>
                            <input
                                v-model="form.bookingId"
                                type="text"
                                placeholder="e.g. MHJ-000000"
                                :disabled="Boolean(bookingToEdit)"
                                :class="{
                                    'cursor-not-allowed disabled:bg-mist-900':
                                        Boolean(bookingToEdit),
                                }"
                                class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"
                                required />
                        </div>

                        <div>
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Guest Name
                            </label>
                            <input
                                v-model="form.guestName"
                                type="text"
                                placeholder="Full Name"
                                class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"
                                required />
                        </div>
                    </div>

                    <!-- Dates & Nights -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div class="relative">
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Check In
                            </label>
                            <input
                                v-model="form.checkIn"
                                type="date"
                                class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                                required
                                :min="checkInMinDate"
                                max="2028-12-31"
                                @click="triggerDatePicker"
                                @blur="sanitizeDate('checkIn')"
                                @change="calculateNights" />
                        </div>
                        <div class="relative">
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Check Out
                            </label>
                            <input
                                v-model="form.checkOut"
                                type="date"
                                class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                                required
                                :min="checkIn"
                                max="2028-12-31"
                                @click="triggerDatePicker"
                                @blur="sanitizeDate('checkOut')"
                                @change="calculateNights" />
                        </div>
                        <div>
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Nights
                            </label>
                            <input
                                v-model.number="form.nights"
                                type="number"
                                min="1"
                                disabled
                                class="w-full px-3 py-2.5 text-sm text-mist-200 focus:outline-none"
                                required />
                        </div>
                    </div>

                    <!-- Channel, Status & Payout -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div class="relative">
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Channel
                            </label>

                            <select
                                v-model="form.listing"
                                class="w-full appearance-none rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 focus:border-lime-500 focus:outline-none">
                                <option
                                    value=""
                                    disabled
                                    selected>
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
                                class="pointer-events-none absolute inset-y-0 right-0 top-5 flex items-center pr-2 text-mist-400">
                                <fa-icon
                                    class="text-xs"
                                    icon="angle-down" />
                            </div>
                        </div>

                        <div class="relative">
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Status
                            </label>
                            <select
                                v-model="form.status"
                                class="w-full appearance-none rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 focus:border-lime-500 focus:outline-none">
                                <option value="Booked">Booked</option>
                                <option value="Checked-in">Checked-in</option>
                                <option value="Waiting for payment">Waiting for payment</option>
                                <option value="Waiting for payout">Waiting for payout</option>
                                <option value="Completed">Completed</option>
                                <option value="No show">No show</option>
                                <option value="Unavailable">Unavailable</option>
                            </select>
                            <div
                                class="pointer-events-none absolute inset-y-0 right-0 top-5 flex items-center pr-2 text-mist-400">
                                <fa-icon
                                    class="text-xs"
                                    icon="angle-down" />
                            </div>
                        </div>

                        <div>
                            <label class="mb-1 block text-xs font-medium text-mist-400">
                                Payout (IDR)
                            </label>
                            <input
                                v-model.number="form.payout"
                                type="number"
                                class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
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
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2.5 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"></textarea>
                    </div>

                    <!-- Action Controls -->
                    <div
                        class="flex gap-3 pt-3"
                        :class="[Boolean(bookingToEdit) ? 'justify-between' : 'justify-end']">
                        <button
                            v-if="Boolean(bookingToEdit)"
                            type="button"
                            class="cursor-pointer py-2 text-xs font-semibold text-rose-400 hover:text-rose-300"
                            @click="handleDeleteBooking">
                            <fa-icon icon="trash-can" /> Delete booking
                        </button>
                        <div>
                            <button
                                type="button"
                                class="cursor-pointer px-4 py-2 text-xs font-semibold text-mist-400 hover:text-mist-200"
                                @click="emit('close')">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="Boolean(validationError)"
                                class="ml-5 cursor-pointer rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">
                                {{ bookingToEdit ? 'Update Booking' : 'Save Booking' }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
