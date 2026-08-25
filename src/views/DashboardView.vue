<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AddPropertyModal from '@/components/AddPropertyModal.vue';

import maiHouseJogja from '../assets/images/maihousejogja.jpg';

import { useBookingStore } from '@/stores/useBookingStore';

const bookingStore = useBookingStore();
const showAddModal = ref<boolean>(false);

onMounted(() => {
    void bookingStore.initDatabase();
});
</script>

<template>
    <div class="home-view max-w-4xl mx-auto">
        <div
            v-if="bookingStore.isLoading"
            class="flex items-center justify-center py-12 text-mist-400">
            <span>Loading local records...</span>
        </div>

        <div
            v-else
            class="space-y-16">
            <div>
                <h2 class="text-base font-semibold text-mist-200">Month's Performance</h2>
                <p
                    v-if="bookingStore.bookings.length === 0"
                    class="text-sm text-mist-400 mt-4">
                    No bookings found in local storage. Ready to add records!
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                    <h2 class="text-base font-semibold text-mist-200">Current In-House Guests</h2>
                    <p
                        v-if="bookingStore.bookings.length === 0"
                        class="text-sm text-mist-400 mt-4">
                        No bookings found in local storage. Ready to add records!
                    </p>
                </div>
                <div>
                    <h2 class="text-base font-semibold text-mist-200">Today's Arrival</h2>
                    <p
                        v-if="bookingStore.bookings.length === 0"
                        class="text-sm text-mist-400 mt-4">
                        No bookings found in local storage. Ready to add records!
                    </p>
                </div>
                <div>
                    <h2 class="text-base font-semibold text-mist-200">Today's Departure</h2>
                    <p
                        v-if="bookingStore.bookings.length === 0"
                        class="text-sm text-mist-400 mt-4">
                        No bookings found in local storage. Ready to add records!
                    </p>
                </div>
            </div>

            <div>
                <!-- border-b border-mist-800 py-4 -->
                <h2 class="text-base font-semibold text-mist-200">Recent Reservations</h2>
                <div class="text-sm text-mist-400 mt-4">
                    <p v-if="bookingStore.bookings.length === 0">
                        No bookings found in local storage. Ready to add records!
                    </p>
                </div>
            </div>

            <div>
                <div class="text-right">
                    <button
                        class="self-end rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-mist-950 hover:bg-lime-400 transition"
                        @click="showAddModal = true">
                        + Add Property
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <RouterLink
                        v-for="property in bookingStore.properties"
                        :key="property.id"
                        class="relative block h-full overflow-hidden rounded-lg"
                        :to="{ name: 'property-detail', params: { id: property.id } }">
                        <img
                            loading="lazy"
                            :src="maiHouseJogja"
                            :alt="`Picture of ${property.name}`"
                            class="h-68.75 w-full object-cover mask-[linear-gradient(to_bottom,black_25%,transparent_100%)]" />

                        <div class="absolute top-0 text-right inset-x-0 p-2">
                            <p
                                class="text-xs inline-block text-white rounded-md bg-black px-2 py-1">
                                Piyungan
                            </p>
                        </div>

                        <div class="absolute bottom-0 inset-x-0 p-3">
                            <h3 class="font-medium">
                                {{ property.name }}
                            </h3>
                            <p class="text-xs text-neutral-400 mt-1 truncate">
                                <fa-icon
                                    class="mr-1"
                                    icon="map-marker-alt" />
                                Jl. Dusun Bintaran Wetan, Bantaran Wetan, Srimulyo, Piyungan, Bantul
                                Regency, Special Region of Yogyakarta 55792
                            </p>
                        </div>
                    </RouterLink>
                    <div class="relative block h-full overflow-hidden rounded-lg">
                        <img
                            loading="lazy"
                            src="https://placehold.co/300x400?text=Coming+soon"
                            class="h-68.75 w-full object-cover mask-[linear-gradient(to_bottom,black_25%,transparent_100%)]" />

                        <div class="absolute top-0 text-right inset-x-0 p-2">
                            <p
                                class="text-xs inline-block text-white rounded-md bg-black px-2 py-1">
                                Wonosari
                            </p>
                        </div>

                        <div class="absolute bottom-0 inset-x-0 p-3">
                            <h3 class="text-white font-medium truncate">Mai House Jogja</h3>
                            <p class="text-xs text-neutral-400 mt-1 truncate">
                                <fa-icon
                                    class="mr-1"
                                    icon="map-marker-alt" />
                                Mulyosari, Baleharjo, Kec. Wonosari, Kabupaten Gunungkidul, Daerah
                                Istimewa Yogyakarta 55881
                            </p>
                        </div>
                    </div>
                    <div class="relative block h-full overflow-hidden rounded-lg">
                        <img
                            loading="lazy"
                            src="https://placehold.co/300x400?text=Coming+soon"
                            class="h-68.75 w-full object-cover mask-[linear-gradient(to_bottom,black_25%,transparent_100%)]" />

                        <div class="absolute top-0 text-right inset-x-0 p-2">
                            <p
                                class="text-xs inline-block text-white rounded-md bg-black px-2 py-1">
                                Bantul
                            </p>
                        </div>

                        <div class="absolute bottom-0 inset-x-0 p-3">
                            <h3 class="text-white font-medium truncate">Mai House Jogja</h3>
                            <p class="text-xs text-neutral-400 mt-1 truncate">
                                <fa-icon
                                    class="mr-1"
                                    icon="map-marker-alt" />
                                Jl. Mahoni No.Rt.05, Botokenceng, Wirokerten, Kec. Banguntapan,
                                Kabupaten Bantul, Daerah Istimewa Yogyakarta 55194
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="hidden grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div>
                <p class="text-sm font-medium text-mist-400">Total Bookings</p>
                <p class="mt-2 text-3xl font-bold text-mist-50">
                    {{ bookingStore.bookings.length }}
                </p>
            </div>
            <div>
                <p class="text-sm font-medium text-mist-400">Active Houses</p>
                <p class="mt-2 text-3xl font-bold text-mist-50">
                    {{ bookingStore.properties.length }}
                </p>
            </div>
            <div>
                <p class="text-sm font-medium text-mist-400">System Status</p>
                <p class="mt-2 text-3xl font-bold text-lime-400">IndexedDB Ready</p>
            </div>
        </div>

        <AddPropertyModal
            v-if="showAddModal"
            @close="showAddModal = false" />
    </div>
</template>
