<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { PROPERTY_CONFIGS, PROPERTY_LIST, type PropertyId } from '@/config/properties';
import AddBookingModal from '@/components/AddBookingModal.vue';
import AddPropertyModal from '@/components/AddPropertyModal.vue';
import maiHouseJogja from '../assets/images/maihousejogja.jpg';
import type { Booking } from '@/db';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);

const selectedPropertyFilter = ref<string>('all');
const isModalOpen = ref<boolean>(false);
const showAddModal = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);

// Format today's date into YYYY-MM-DD for comparison
const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const todayStr = computed(() => getTodayString());
const currentMonthStr = computed(() => todayStr.value.slice(0, 7));

// Filtered base list by selected property
const propertyBookings = computed(() => {
    if (selectedPropertyFilter.value === 'all') return bookings.value;
    return bookings.value.filter((b) => b.propertyId === selectedPropertyFilter.value);
});

// 1. Arriving Today (Check-in == today)
const todaysArrivals = computed(() => {
    return propertyBookings.value.filter(
        (b) => b.checkIn === todayStr.value && b.status !== 'Unavailable'
    );
});

// 2. Today's Departures (Check-out == today)
const todaysDepartures = computed(() => {
    return propertyBookings.value.filter(
        (b) => b.checkOut === todayStr.value && b.status !== 'Unavailable'
    );
});

// 3. Current In-House Guests (Check-in <= today AND Check-out > today)
const currentInHouse = computed(() => {
    const currentHour = new Date().getHours(); // 24-hour format (e.g., 10 for 10:00, 13 for 13:00)

    return propertyBookings.value.filter((b) => {
        if (b.status === 'Unavailable') return false;

        // 1. Guests staying multi-day strictly in between check-in and check-out dates
        const isMidStay = b.checkIn < todayStr.value && b.checkOut > todayStr.value;
        if (isMidStay) return true;

        // 2. Morning (< 12:00): Show guest who is checking out today
        if (currentHour < 12) {
            return b.checkOut === todayStr.value;
        }

        // 3. Afternoon / Evening (>= 12:00): Show guest who is checking in today
        return b.checkIn === todayStr.value;
    });
});

// 4. Alert Banner: Direct WhatsApp bookings with 'Waiting for payment' status
const pendingPaymentAlerts = computed(() => {
    return propertyBookings.value.filter((b) => {
        // 1. Must be WhatsApp channel with 'Waiting for payment' status
        if (b.listing !== 'Whatsapp' || b.status !== 'Waiting for payment') {
            return false;
        }

        if (!b.checkIn) return false;

        // 2. Calculate target alert date (Check-in minus 1 day)
        const checkInDate = new Date(b.checkIn);
        checkInDate.setDate(checkInDate.getDate() - 1);

        const alertYear = checkInDate.getFullYear();
        const alertMonth = String(checkInDate.getMonth() + 1).padStart(2, '0');
        const alertDay = String(checkInDate.getDate()).padStart(2, '0');
        const alertDateStr = `${alertYear}-${alertMonth}-${alertDay}`;

        // 3. Match only if the alert date is today
        return alertDateStr === todayStr.value;
    });
});

// 5. Monthly Summary Calculations (Current Month)
const monthlySummary = computed(() => {
    const monthBookings = propertyBookings.value.filter(
        (b) => b.checkIn.startsWith(currentMonthStr.value) && b.status !== 'Unavailable'
    );

    const totalPayout = monthBookings.reduce((sum, b) => sum + b.payout, 0);
    const totalNightsBooked = monthBookings.reduce((sum, b) => sum + b.nights, 0);

    // Parse YYYY-MM safely to avoid undefined types
    const parts = currentMonthStr.value.split('-');
    const year = parseInt(parts[0] || '2026', 10);
    const month = parseInt(parts[1] || '8', 10);

    // Days in target month (setting day index 0 gets last day of previous month)
    const daysInMonth = new Date(year, month, 0).getDate();

    const activePropertyCount = selectedPropertyFilter.value === 'all' ? PROPERTY_LIST.length : 1;
    const totalAvailableRoomNights = daysInMonth * activePropertyCount;

    const occupancyRate =
        totalAvailableRoomNights > 0
            ? Math.min(100, Math.round((totalNightsBooked / totalAvailableRoomNights) * 100))
            : 0;

    return {
        totalPayout,
        totalNightsBooked,
        occupancyRate,
        bookingCount: monthBookings.length,
    };
});

const openEditModal = (booking: Booking): void => {
    bookingToEdit.value = booking;
    isModalOpen.value = true;
};

const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    if (bookingToEdit.value) {
        await bookingStore.updateBooking({ ...bookingToEdit.value, ...payload });
    }
};

const getPropertyConfig = (id: string) => {
    return PROPERTY_CONFIGS[id as PropertyId] || { name: id, color: '#64748b' };
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-mist-800 pb-5">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Daily Operations</h1>
                <p class="text-xs text-mist-400">Live operational activity for {{ todayStr }}</p>
            </div>
        </div>

        <!-- Item 4: Alert Banner for 'Waiting for payment' WhatsApp Bookings -->
        <div
            v-if="pendingPaymentAlerts.length > 0"
            class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 shadow-lg space-y-2">
            <div
                class="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-400">
                <span>
                    Action Required: Pending WhatsApp Payments ({{ pendingPaymentAlerts.length }})
                </span>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div
                    v-for="b in pendingPaymentAlerts"
                    :key="b.id"
                    class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-mist-950/60 px-3 py-2 text-xs">
                    <div>
                        <p class="font-semibold text-mist-200">
                            {{ b.guestName }} ({{ b.bookingId }})
                        </p>
                        <p class="text-[10px] text-amber-300/80">
                            {{ getPropertyConfig(b.propertyId).name }} &bull; Rp
                            {{ b.payout.toLocaleString() }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/30"
                        @click="openEditModal(b)">
                        Review
                    </button>
                </div>
            </div>
        </div>

        <!-- Item 5: Monthly Summary Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-xl font-bold text-lime-400">
                    Rp {{ monthlySummary.totalPayout.toLocaleString() }}
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Current Month Total</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Est. Occupancy Rate</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ monthlySummary.occupancyRate }}%
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Based on total capacity</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Room Nights Booked</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ monthlySummary.totalNightsBooked }} Nights
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Completed + Upcoming</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Total Month Bookings</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ monthlySummary.bookingCount }} Reservations
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Active reservations</p>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <!-- Arriving Today -->
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-2">
                    <h2 class="text-xs font-bold uppercase text-mist-300">Arriving Today</h2>
                    <span
                        class="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {{ todaysArrivals.length }}
                    </span>
                </div>

                <div
                    v-if="todaysArrivals.length === 0"
                    class="py-6 text-center text-xs text-mist-500">
                    No arrivals scheduled for today.
                </div>
                <div
                    v-else
                    class="space-y-2">
                    <div
                        v-for="b in todaysArrivals"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <span
                                class="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                                :style="{
                                    backgroundColor: getPropertyConfig(b.propertyId).color,
                                }">
                                {{ getPropertyConfig(b.propertyId).name.split('-')[1] }}
                            </span>
                        </div>
                        <div class="flex justify-between text-[12px] text-mist-400">
                            <span>
                                {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull;
                                {{ b.nights }} night(s)
                            </span>
                            <span class="font-mono text-mist-300">{{ b.listing }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Current In-House Guests -->
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-2">
                    <div>
                        <h2 class="text-xs font-bold uppercase text-mist-300">Currently Staying</h2>
                    </div>
                    <span
                        class="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {{ currentInHouse.length }}
                    </span>
                </div>

                <div
                    v-if="currentInHouse.length === 0"
                    class="py-6 text-center text-xs text-mist-500">
                    No guests currently in-house.
                </div>
                <div
                    v-else
                    class="space-y-2">
                    <div
                        v-for="b in currentInHouse"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <span
                                class="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                                :style="{
                                    backgroundColor: getPropertyConfig(b.propertyId).color,
                                }">
                                {{ getPropertyConfig(b.propertyId).name.split('-')[1] }}
                            </span>
                        </div>
                        <div class="flex justify-between text-[12px] text-mist-400">
                            <span>
                                {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull;
                                {{ b.nights }} night(s)
                            </span>

                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Today's Departures -->
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-2">
                    <h2 class="text-xs font-bold uppercase text-mist-300">Today's Departures</h2>
                    <span
                        class="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {{ todaysDepartures.length }}
                    </span>
                </div>

                <div
                    v-if="todaysDepartures.length === 0"
                    class="py-6 text-center text-xs text-mist-500">
                    No departures scheduled for today.
                </div>
                <div
                    v-else
                    class="space-y-2">
                    <div
                        v-for="b in todaysDepartures"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <span
                                class="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                                :style="{
                                    backgroundColor: getPropertyConfig(b.propertyId).color,
                                }">
                                {{ getPropertyConfig(b.propertyId).name.split('-')[1] }}
                            </span>
                        </div>
                        <div class="flex justify-between text-[12px] text-mist-400">
                            <span>
                                {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull;
                                {{ b.nights }} night(s)
                            </span>
                            <span class="font-mono text-mist-300">{{ b.listing }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-mist-800 pb-5 mt-24">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Properties</h1>
                <p class="text-xs text-mist-400">All properties</p>
            </div>

            <div class="flex items-center gap-2">
                <button
                    class="self-end rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-mist-950 hover:bg-lime-400 transition"
                    @click="showAddModal = true">
                    + Add Property
                </button>
            </div>
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
                    <p class="text-xs inline-block text-white rounded-md bg-black px-2 py-1">
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
                    <p class="text-xs inline-block text-white rounded-md bg-black px-2 py-1">
                        Wonosari
                    </p>
                </div>

                <div class="absolute bottom-0 inset-x-0 p-3">
                    <h3 class="text-white font-medium truncate">Mai House Jogja</h3>
                    <p class="text-xs text-neutral-400 mt-1 truncate">
                        <fa-icon
                            class="mr-1"
                            icon="map-marker-alt" />
                        Mulyosari, Baleharjo, Kec. Wonosari, Kabupaten Gunungkidul, Daerah Istimewa
                        Yogyakarta 55881
                    </p>
                </div>
            </div>
            <div class="relative block h-full overflow-hidden rounded-lg">
                <img
                    loading="lazy"
                    src="https://placehold.co/300x400?text=Coming+soon"
                    class="h-68.75 w-full object-cover mask-[linear-gradient(to_bottom,black_25%,transparent_100%)]" />

                <div class="absolute top-0 text-right inset-x-0 p-2">
                    <p class="text-xs inline-block text-white rounded-md bg-black px-2 py-1">
                        Bantul
                    </p>
                </div>

                <div class="absolute bottom-0 inset-x-0 p-3">
                    <h3 class="text-white font-medium truncate">Mai House Jogja</h3>
                    <p class="text-xs text-neutral-400 mt-1 truncate">
                        <fa-icon
                            class="mr-1"
                            icon="map-marker-alt" />
                        Jl. Mahoni No.Rt.05, Botokenceng, Wirokerten, Kec. Banguntapan, Kabupaten
                        Bantul, Daerah Istimewa Yogyakarta 55194
                    </p>
                </div>
            </div>
        </div>

        <!-- Edit Modal integration -->
        <AddBookingModal
            v-if="isModalOpen"
            :booking-to-edit="bookingToEdit"
            @close="isModalOpen = false"
            @save="handleSaveBooking" />

        <AddPropertyModal
            v-if="showAddModal"
            @close="showAddModal = false" />
    </div>
</template>
