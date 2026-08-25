<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { onMounted } from 'vue';

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

const bookingStore = useBookingStore();

onMounted(() => {
    void bookingStore.initDatabase();
});
</script>

<template>
    <div class="flex flex-col min-h-screen px-4 mx-auto">
        <AppHeader />

        <main class="grow">
            <RouterView />
        </main>

        <AppFooter />
    </div>
</template>
