<script setup lang="ts">
import { onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import { usePropertyStore } from '@/stores/usePropertyStore';
import { useBookingStore } from '@/stores/useBookingStore';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';

useHead({
    title: 'BOM - Booking OTA Manager',
    meta: [
        {
            name: 'viewport',
            content: 'width=device-width, initial-scale=1.0',
        },
    ],
});
const propertyStore = usePropertyStore();
const bookingStore = useBookingStore();

onMounted(async () => {
    await Promise.all([propertyStore.loadProperties(), bookingStore.loadBookings()]);
});
</script>

<template>
    <div class="flex flex-col min-h-screen px-6">
        <AppHeader />

        <main class="grow">
            <RouterView />
        </main>

        <AppFooter />
    </div>
</template>
