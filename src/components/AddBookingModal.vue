<script setup lang="ts">
import { ref, watch } from 'vue';
import { PROPERTY_LIST, type PropertyId } from '@/config/properties';
import type { Booking } from '@/db';

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

// Auto-calculate nights whenever checkIn or checkOut changes
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
        notes: form.value.notes.trim() || undefined,
    });
    emit('close');
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

            <!-- Form Inputs -->
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
                        <label class="mb-1 block text-xs font-medium text-mist-400"
                            >Booking ID</label
                        >
                        <input
                            v-model="form.bookingId"
                            type="text"
                            placeholder="e.g. HMJ-001"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"
                            required />
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400"
                            >Guest Name</label
                        >
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
                            required />
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400"
                            >Check Out</label
                        >
                        <input
                            v-model="form.checkOut"
                            type="date"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required />
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
                            <option value="Completed">Completed</option>
                            <option value="No show">No show</option>
                            <option value="Unavailable">Unavailable</option>
                        </select>
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400"
                            >Payout (IDR)</label
                        >
                        <input
                            v-model.number="form.payout"
                            type="number"
                            step="10000"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required />
                    </div>
                </div>

                <!-- Notes -->
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400"
                        >Notes (Optional)</label
                    >
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
                        class="rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400">
                        {{ bookingToEdit ? 'Update Booking' : 'Save Booking' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
