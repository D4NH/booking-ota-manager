<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '@/stores/useBookingStore';

import maiHouseJogja from '../assets/images/maihousejogja_main.jpg';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();

onMounted(async () => {
    await bookingStore.initDatabase();
    bookingStore.selectedPropertyId = propertyId.value;
    await bookingStore.loadBookings();
});

const propertyId = computed(() => route.params.id as string);

const currentProperty = computed(() =>
    bookingStore.properties.find((p) => p.id === propertyId.value)
);

const propertyBookings = computed(() =>
    bookingStore.bookings.filter((b) => b.propertyId === propertyId.value)
);

const totalRevenue = computed(() => propertyBookings.value.reduce((sum, b) => sum + b.payout, 0));

const totalNights = computed(() => propertyBookings.value.reduce((sum, b) => sum + b.nights, 0));

const formatIdr = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
};
const handleDeleteThisProperty = async (): Promise<void> => {
    if (!currentProperty.value) return;

    const confirmed = confirm(`Delete ${currentProperty.value.name} and all its bookings?`);

    if (confirmed) {
        await bookingStore.deleteProperty(currentProperty.value.id);
        void router.push('/');
    }
};
</script>

<template>
    <div class="property-view max-w-4xl mx-auto">
        <div class="relative block h-full overflow-hidden rounded-lg">
            <img
                loading="lazy"
                :src="maiHouseJogja"
                :alt="`Picture of ${currentProperty?.name}`" />

            <div class="absolute inset-0 flex items-center justify-center p-4">
                <div class="text-center text-shadow-lg bg-white/30 backdrop-blur-sm rounded-md p-4">
                    <h3 class="text-2xl font-medium uppercase">
                        {{ currentProperty?.name }}
                    </h3>
                    <p class="text-xs mt-1 w-75">
                        <fa-icon
                            class="mr-1"
                            icon="map-marker-alt" />
                        Jl. Dusun Bintaran Wetan, Bantaran Wetan, Srimulyo, Piyungan, Bantul
                        Regency, Special Region of Yogyakarta 55792
                    </p>
                </div>
            </div>
        </div>

        <pre>{{ currentProperty }}</pre>

        <div class="space-y-6">
            <div
                v-if="currentProperty"
                class="flex items-center justify-between gap-4">
                <RouterLink
                    to="/"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-mist-800 bg-mist-950 text-mist-400 hover:text-mist-200 transition">
                    &larr; Back to Properties
                </RouterLink>
                <div class="flex items-center gap-3">
                    <span
                        class="w-4 h-4 rounded-full"
                        :style="{ backgroundColor: currentProperty.color }"></span>
                    <h1 class="text-2xl font-bold text-mist-100">{{ currentProperty.name }}</h1>
                    <span class="text-xs font-mono px-2 rounded bg-mist-800 text-mist-400 mt-2">
                        {{ currentProperty.codePrefix }}
                    </span>
                </div>

                <button
                    class="px-2.5 py-1.5 text-xs font-medium bg-mist-900 border border-rose-900/50 text-rose-400 hover:bg-rose-950 rounded-lg transition"
                    title="Delete Property"
                    @click="handleDeleteThisProperty()">
                    Delete
                </button>
            </div>

            <div
                v-if="bookingStore.isLoading"
                class="text-mist-400 py-8">
                Loading house details...
            </div>

            <div
                v-else-if="!currentProperty"
                class="p-8 border border-mist-800 rounded-xl bg-mist-950 text-center">
                <p class="text-mist-400">Property with ID "{{ propertyId }}" was not found.</p>
            </div>

            <div
                v-else
                class="space-y-6">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="p-5 bg-mist-950 border border-mist-800 rounded-xl">
                        <p class="text-sm font-medium text-mist-400">Total Revenue</p>
                        <p class="mt-2 text-2xl font-bold text-lime-400">
                            {{ formatIdr(totalRevenue) }}
                        </p>
                    </div>
                    <div class="p-5 bg-mist-950 border border-mist-800 rounded-xl">
                        <p class="text-sm font-medium text-mist-400">Total Stays</p>
                        <p class="mt-2 text-2xl font-bold text-mist-100">
                            {{ propertyBookings.length }}
                        </p>
                    </div>
                    <div class="p-5 bg-mist-950 border border-mist-800 rounded-xl">
                        <p class="text-sm font-medium text-mist-400">Nights Booked</p>
                        <p class="mt-2 text-2xl font-bold text-mist-100">
                            {{ totalNights }} Nights
                        </p>
                    </div>
                </div>

                <!-- Bookings Data Table -->
                <div class="border border-mist-800 rounded-xl bg-mist-950 overflow-hidden">
                    <div
                        class="px-6 py-4 border-b border-mist-800 flex justify-between items-center">
                        <h2 class="font-semibold text-mist-200">Reservations Overview</h2>
                    </div>

                    <div
                        v-if="propertyBookings.length === 0"
                        class="p-8 text-center text-sm text-mist-500">
                        No bookings recorded for {{ currentProperty.name }} yet.
                    </div>

                    <div
                        v-else
                        class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-mist-300">
                            <thead
                                class="bg-mist-900 border-b border-mist-800 text-xs text-mist-400 uppercase">
                                <tr>
                                    <th class="px-6 py-3">ID</th>
                                    <th class="px-6 py-3">Guest</th>
                                    <th class="px-6 py-3">Dates</th>
                                    <th class="px-6 py-3">Channel</th>
                                    <th class="px-6 py-3">Payout</th>
                                    <th class="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-mist-800">
                                <tr
                                    v-for="b in propertyBookings"
                                    :key="b.id"
                                    class="hover:bg-mist-900/50">
                                    <td class="px-6 py-4 font-mono text-xs text-mist-400">
                                        {{ b.bookingId }}
                                    </td>
                                    <td class="px-6 py-4 font-medium text-mist-200">
                                        {{ b.guestName }}
                                    </td>
                                    <td class="px-6 py-4">
                                        {{ b.checkIn }} &rarr; {{ b.checkOut }} ({{ b.nights }}n)
                                    </td>
                                    <td class="px-6 py-4">
                                        <span
                                            class="px-2 py-1 rounded-md text-xs font-medium bg-mist-900 border border-mist-800">
                                            {{ b.listing }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 font-mono">{{ formatIdr(b.payout) }}</td>
                                    <td class="px-6 py-4">
                                        <span
                                            class="px-2 py-1 rounded-full text-xs font-medium bg-lime-950 text-lime-400 border border-lime-800">
                                            {{ b.status }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.property {
}
</style>
