<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import type { Property } from '@/types/property';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = withDefaults(
    defineProps<{
        property: Property;
        targetZoom?: number; // Final zoomed-in view (e.g. 18 or 19)
    }>(),
    {
        targetZoom: 17,
    }
);

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let marker: L.Marker | null = null;

const customMarkerIcon = L.divIcon({
    className: 'bg-transparent border-0',
    html: `
        <div class="relative flex h-8 w-8 items-center justify-center">
            <!-- Pulsing radar ring centered -->
            <span class="absolute h-8 w-8 rounded-full bg-lime-400/30 animate-ping"></span>

            <!-- Center circular pin -->
            <div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-mist-950 bg-lime-500 text-mist-950 shadow-xl">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
            </div>
        </div>
    `,
    iconSize: [32, 32],
    // locks the exact center of the circle to the GPS coordinate
    iconAnchor: [16, 16],
});

const initMap = () => {
    if (!mapContainer.value) return;

    // Initial State: Start zoomed-out over Yogyakarta region (Zoom 11)
    // Slightly offset latitude so the fly-in has a nice diagonal swoop
    map = L.map(mapContainer.value, {
        zoomControl: false,
        maxZoom: 20,
    }).setView([props.property.coordinates.lat - 0.03, props.property.coordinates.lng - 0.03], 11);

    L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`,
        {
            subdomains: 'abcd',
            maxZoom: 20,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
    ).addTo(map);

    marker = L.marker([props.property.coordinates.lat, props.property.coordinates.lng], {
        icon: customMarkerIcon,
    }).addTo(map);

    // Trigger Fly-In Animation
    setTimeout(() => {
        if (!map) return;

        // Recalculate true container boundaries
        map.invalidateSize();

        // Fly to dead center
        map.setView(
            [props.property.coordinates.lat, props.property.coordinates.lng],
            props.targetZoom,
            {
                duration: 2.2,
                easeLinearity: 0.25,
            }
        );
    }, 400);
};

onMounted(() => {
    initMap();
});

onBeforeUnmount(() => {
    if (map) {
        map.remove();
        map = null;
    }
});

watch(
    () => [props.property.coordinates.lat, props.property.coordinates.lng],
    ([newLat, newLng]) => {
        if (map && marker && newLat && newLng) {
            map.flyTo([newLat, newLng], props.targetZoom, { duration: 1.5 });
            marker.setLatLng([newLat, newLng]);
        }
    }
);
</script>

<template>
    <div
        class="relative h-full min-h-64 w-full overflow-hidden rounded-md border border-mist-800 bg-mist-950 shadow-md">
        <div
            ref="mapContainer"
            class="h-full w-full z-10" />
    </div>
</template>
