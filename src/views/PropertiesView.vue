<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePropertyStore } from '@/stores/usePropertyStore';

const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const propertyImage = (id: string) => {
    if (id === 'bantul') return 'https://placehold.co/300x400?text=Bantul';
    return `/images/${id}.jpg`;
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <!-- Properties -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Properties</h1>
                <p class="text-xs text-mist-400">Managed Homestays & Villas</p>
            </div>
            <!-- <button
                class="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-mist-950 hover:bg-lime-400 transition"
                @click="isPropertyModalOpen = true">
                <fa-icon icon="plus" /> Add Property
            </button> -->
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <RouterLink
                v-for="property in sortedProperties"
                :key="property.id"
                class="relative block h-full overflow-hidden rounded-lg"
                :to="{ name: 'property', params: { id: property.id } }">
                <img
                    loading="lazy"
                    :src="propertyImage(property.id)"
                    :alt="`Picture of ${property.name}`"
                    class="h-[225px] w-full object-cover mask-[linear-gradient(to_bottom,black_25%,transparent_100%)]" />

                <div class="absolute bottom-12 inset-x-0 px-3 py-2">
                    <div>
                        <h2 class="font-bold">{{ property.name }}</h2>
                        <p class="text-xs capitalize">{{ property.id }}</p>
                    </div>
                </div>

                <div class="absolute bottom-0 inset-x-0 px-3 py-2 bg-white/30 backdrop-blur-sm">
                    <p class="text-xs line-clamp-2">
                        <fa-icon icon="map-marker-alt" />
                        {{ property.address }}
                    </p>
                </div>
            </RouterLink>
        </div>
    </div>
</template>
