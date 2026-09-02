<script setup lang="ts">
import { ref } from 'vue';

import NotificationSidebar from '@/components/NotificationSidebar.vue';

const isNotificationOpen = ref(false);

const toggleNotifications = (): void => {
    isNotificationOpen.value = !isNotificationOpen.value;
};
</script>

<template>
    <header class="w-full mt-6 mb-12 pb-6 border-b border-mist-800">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <RouterLink
                    to="/"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500 font-bold text-mist-950 logo">
                    B
                </RouterLink>
                <h1 class="text-xl font-bold">Booking OTA Manager</h1>
            </div>

            <div class="flex items-center space-x-8">
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/bookings">
                    Bookings
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/calendar">
                    Calendar
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/properties">
                    Properties
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/finance">
                    Finance
                </RouterLink>

                <button
                    type="button"
                    class="cursor-pointer relative flex items-center justify-center rounded-lg border border-mist-700 bg-mist-800 p-2 text-mist-300 hover:bg-mist-700 hover:text-mist-100 transition"
                    @click="toggleNotifications">
                    <fa-icon icon="bell" />
                    <!-- Indicator Dot -->
                    <span class="absolute -top-1 -right-1 flex h-3 w-3">
                        <span
                            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
                        <span class="relative inline-flex h-3 w-3 rounded-full bg-lime-500" />
                    </span>
                </button>
            </div>
        </div>
    </header>

    <NotificationSidebar
        :is-open="isNotificationOpen"
        @close="isNotificationOpen = false" />
</template>

<style lang="scss" scoped>
.router-link-active:not(.logo) {
    color: var(--color-primary);

    &:hover {
        color: var(--color-primary-hover);
    }
}
</style>
