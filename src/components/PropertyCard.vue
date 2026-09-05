<script setup lang="ts">
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';

defineProps<{
    property: Property;
    bookings: Booking[];
}>();

const emit = defineEmits<{
    'edit-property': [];
}>();

const propertyImage = (id: string) =>
    id === 'bantul' ? 'https://placehold.co/300x400?text=Bantul' : `/images/${id}.jpg`;
</script>

<template>
    <RouterLink
        :to="{
            name: 'property-detail',
            params: { id: property.id },
        }"
        class="rounded-lg border border-mist-800 bg-mist-900 p-4 space-y-4 shadow-md">
        <img
            loading="lazy"
            :src="propertyImage(property.id)"
            :alt="`Picture of ${property.name}`"
            class="w-full h-50 object-cover rounded-xl mb-4" />

        <div class="flex justify-between items-start">
            <div class="flex flex-col">
                <div class="flex gap-2">
                    <h2 class="text-lg font-bold capitalize">{{ property.id }}</h2>
                    <button
                        type="button"
                        class="cursor-pointer text-mist-400 hover:text-mist-100 text-sm"
                        @click.prevent="emit('edit-property')">
                        <fa-icon icon="pen-to-square" />
                    </button>
                </div>
                <p class="mt-1 mr-4 text-xs line-clamp-1 text-mist-500">
                    <fa-icon icon="map-marker-alt" /> {{ property.address }}
                </p>
            </div>
            <OccupiedTag
                :bookings="bookings"
                :property="property" />
        </div>
        <ul class="flex space-x-4 text-sm text-mist-400">
            <li class="whitespace-nowrap">
                <fa-icon icon="bed" /> {{ property.bedrooms }} Bedroom
            </li>
            <li class="whitespace-nowrap">
                <fa-icon icon="shower" /> {{ property.bathrooms }} Bathroom
            </li>
            <li class="whitespace-nowrap">
                <fa-icon icon="ruler-combined" /> {{ property.plotSize }} m&sup3;
            </li>
        </ul>
        <div>
            <span>{{ formatIDR(property.price) }}</span>
            <span class="text-xs"> / night</span>
        </div>
    </RouterLink>
</template>
