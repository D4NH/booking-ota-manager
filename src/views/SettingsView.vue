<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Property, PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { toast } from 'vue-toastflow';

import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import PageTitle from '@/components/PageTitle.vue';
import CardTitle from '@/components/CardTitle.vue';
import PropertyDataBackup from '@/components/PropertyDataBackup.vue';

const bookingStore = useBookingStore();
const financeStore = useFinanceStore();
const propertyStore = usePropertyStore();
const modalStore = useModalStore();

const { bookings } = storeToRefs(bookingStore);
const { properties, sortedProperties } = storeToRefs(propertyStore);

const { isAuthenticated, refreshAuthStatus } = useGoogleSheets();

const handleAddProperty = (): void => modalStore.openPropertyModal();
const handleEditProperty = (property: Property): void => modalStore.openPropertyModal({ property });
const handleDeleteProperty = async (id: PropertyId): Promise<void> => {
    const confirmed = window.confirm(
        `Are you sure you want to delete property "${id}"? This will not delete associated bookings in Google Sheets.`
    );
    if (!confirmed) return;

    try {
        await db.properties.delete(id);
        if (
            'loadProperties' in propertyStore &&
            typeof propertyStore.loadProperties === 'function'
        ) {
            await propertyStore.loadProperties();
        } else {
            properties.value = await db.properties.toArray();
        }
        toast.success({
            title: 'Property Removed',
            description: `Property "${id}" removed from local database.`,
        });
    } catch (err) {
        toast.error({
            title: 'Delete Failed',
            description: err instanceof Error ? err.message : 'Database write error.',
        });
    }
};
const handleClearBookings = async (): Promise<void> => {
    const confirmed = window.confirm(
        'Are you sure you want to clear all local bookings? You can re-import them anytime from Google Sheets.'
    );
    if (!confirmed) return;

    await db.bookings.clear();
    await bookingStore.loadBookings();
    toast.success({
        title: 'Bookings Cleared',
        description: 'IndexedDB bookings table has been cleared.',
    });
};
const handleClearFinance = async (): Promise<void> => {
    const confirmed = window.confirm(
        'Are you sure you want to clear all local finance? You can re-import them anytime from Google Sheets.'
    );
    if (!confirmed) return;

    await db.propertyFinances.clear();
    await db.personalFinances.clear();
    await db.sharedFinances.clear();
    await db.transfers.clear();
    await db.personalSavings.clear();
    await db.transfers.clear();
    await db.goldAssets.clear();
    await db.recurringTemplates.clear();
    await financeStore.loadLocalFinanceData();
    await financeStore.fetchRecurringTemplates();
    toast.success({
        title: 'Finance Cleared',
        description: 'IndexedDB finance table has been cleared.',
    });
};
const handleWipeDatabase = async (): Promise<void> => {
    const confirmed = window.confirm(
        'WARNING: This will erase ALL local properties and bookings. This cannot be undone unless you have a JSON backup.'
    );
    if (!confirmed) return;

    await db.transaction('rw', [db.bookings, db.properties], async () => {
        await db.bookings.clear();
        await db.properties.clear();
    });

    await bookingStore.loadBookings();
    if ('loadProperties' in propertyStore && typeof propertyStore.loadProperties === 'function') {
        await propertyStore.loadProperties();
    } else {
        properties.value = [];
    }

    toast.warning({
        title: 'Database Wiped',
        description: 'All local IndexedDB records have been erased.',
    });
};

onMounted(() => refreshAuthStatus());
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Settings</template>
            <template #subtitle>
                System integrations, property configurations and database storage
            </template>
        </PageTitle>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span
                        class="h-3 w-3 rounded-full shrink-0"
                        :class="isAuthenticated ? 'bg-lime-400 animate-pulse' : 'bg-amber-400'" />
                    <div>
                        <h4 class="text-xs font-semibold text-mist-100">
                            {{
                                isAuthenticated
                                    ? 'OAuth Token Active'
                                    : 'Not Connected / Token Expired'
                            }}
                        </h4>
                        <p class="text-[11px] text-mist-500">
                            {{
                                isAuthenticated
                                    ? 'Valid Google Sheets API session stored locally.'
                                    : 'Connect to allow importing and writing to Google Sheets.'
                            }}
                        </p>
                    </div>
                </div>

                <GoogleSyncButton scope="all" />
            </div>
        </div>

        <!-- Property Management -->
        <div class="flex flex-col">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Property Roster</template>
                    <template #subtitle>
                        Configure physical rental units and baseline pricing
                    </template>
                </CardTitle>
                <button
                    type="button"
                    class="cursor-pointer rounded-md bg-lime-500 hover:bg-lime-400 px-3 py-1.5 text-xs font-semibold text-mist-950 transition"
                    @click="handleAddProperty">
                    <fa-icon
                        icon="plus"
                        class="text-xs mr-1" />
                    Add Property
                </button>
            </div>

            <!-- Properties -->
            <div class="rounded-md border border-mist-800 bg-mist-900 shadow-md overflow-hidden">
                <div
                    v-if="sortedProperties.length === 0"
                    class="flex flex-col items-center justify-center p-8 text-xs text-mist-400">
                    <fa-icon
                        icon="house"
                        class="text-xl text-mist-600 mb-1" />
                    <p>No properties registered yet. Click "Add Property" to begin.</p>
                </div>
                <table
                    v-else
                    class="w-full text-left text-sm text-mist-300 table-fixed">
                    <thead
                        class="border-b border-mist-800 bg-mist-950/50 text-xs font-semibold uppercase text-mist-400">
                        <tr>
                            <th class="w-32 px-4 py-2.5">ID</th>
                            <th class="px-4 py-2.5">Name</th>
                            <th class="w-40 px-4 py-2.5 text-right">Base Rate</th>
                            <th class="w-48 px-4 py-2.5 text-center">Specs</th>
                            <th class="w-28 px-4 py-2.5 text-center">Status</th>
                            <th class="w-24 px-4 py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-mist-800/60">
                        <tr
                            v-for="p in sortedProperties"
                            :key="p.id"
                            class="hover:bg-mist-800/30 transition">
                            <td class="px-4 py-3 font-mono text-lime-400 text-xs truncate">
                                {{ p.id }}
                            </td>
                            <td class="px-4 py-3 font-medium text-mist-100 truncate">
                                <div>{{ p.name }}</div>
                                <div class="text-[11px] text-mist-500 truncate">
                                    {{ p.address }}
                                </div>
                            </td>
                            <td class="px-4 py-3 font-mono text-right text-xs">
                                {{ formatIDR(p.price) }}
                            </td>
                            <td class="px-4 py-3 text-center text-xs text-mist-400 gap-2">
                                <fa-icon
                                    icon="bed"
                                    class="text-[11px] text-mist-500" />
                                {{ p.bedrooms }} &bull;
                                <fa-icon
                                    icon="shower"
                                    class="text-[11px] text-mist-500" />
                                {{ p.bathrooms }} &bull;
                                <fa-icon
                                    icon="ruler-combined"
                                    class="text-[11px] text-mist-500" />
                                {{ p.plotSize }}m²
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                                    :class="
                                        p.available
                                            ? 'bg-lime-500/10 text-lime-400 border border-lime-500/20'
                                            : 'bg-mist-800 text-mist-400'
                                    ">
                                    {{ p.available ? 'Active' : 'Draft' }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        class="cursor-pointer text-mist-400 hover:text-mist-100 transition"
                                        title="Edit property"
                                        @click="handleEditProperty(p)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                    <span class="text-mist-700">|</span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-rose-400 hover:text-rose-300 transition"
                                        title="Delete property"
                                        @click="handleDeleteProperty(p.id)">
                                        <fa-icon icon="trash-can" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- JSON Backup & Restore Component -->
            <PropertyDataBackup class="mt-4" />
        </div>

        <!-- Danger Zone / Database Maintenance -->
        <div class="flex flex-col">
            <CardTitle>
                <template #title>Database Storage & Cache</template>
                <template #subtitle>Manage client-side IndexedDB records</template>
            </CardTitle>
            <div class="rounded-md border border-rose-500/20 bg-mist-900 p-4 shadow-md space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-xs font-semibold text-mist-200">Local Bookings Cache</h4>
                        <p class="text-[11px] text-mist-500">
                            Currently storing
                            <span class="text-white">{{ bookings.length }}</span> reservations in
                            local Dexie database.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition"
                        @click="handleClearBookings">
                        Clear Bookings Cache
                    </button>
                </div>
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-xs font-semibold text-mist-200">Local Finance Cache</h4>
                        <p class="text-[11px] text-mist-500">
                            Permanently purges finances from IndexedDB storage.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition"
                        @click="handleClearFinance">
                        Clear Finance Cache
                    </button>
                </div>

                <div class="border-t border-mist-800/60 pt-3 flex items-center justify-between">
                    <div>
                        <h4 class="text-xs font-semibold text-rose-400">Hard Reset Database</h4>
                        <p class="text-[11px] text-mist-500">
                            Permanently purges both properties and bookings from IndexedDB storage.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm"
                        @click="handleWipeDatabase">
                        Purge All Data
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
