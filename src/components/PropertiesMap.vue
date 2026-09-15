<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPropertyTheme } from '@/config/properties';
import { formatIDR } from '@/utils/money';
import type { Property, PropertyId } from '@/types/property';

const { properties } = defineProps<{
    properties: Property[];
}>();

const emit = defineEmits<{
    (e: 'select-property', id: PropertyId | 'all'): void;
}>();

const mapContainer = ref<HTMLElement | null>(null);

let map: L.Map | null = null;
const markersMap = new Map<PropertyId, L.Marker>();

// 1. Define initial coordinates and zoom as reusable constants
const INITIAL_CENTER: [number, number] = [-7.8385 - 0.06, 110.4632];
const INITIAL_ZOOM = 11;

const createPropertyPin = (prop: Property) => {
    const theme = getPropertyTheme(prop.id);
    const propPrice = formatIDR(prop.price);

    return L.divIcon({
        className: 'bg-transparent border-0',
        html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
                <div class="relative flex items-center gap-1.5 rounded-md border border-mist-800 bg-mist-900 pr-2.5 py-1 text-xs shadow-xl transition-transform duration-200 group-hover:scale-110">
                    <span class="h-2 w-2 rounded-md shrink-0 ${theme.bg || 'bg-lime-400'}"></span>
                    <span class="font-bold text-mist-100 whitespace-nowrap capitalize">${prop.id}</span>
                    <span class="font-mono font-semibold text-lime-400 text-[11px] whitespace-nowrap">${propPrice}</span>
                </div>
            </div>
        `,
        iconSize: [100, 30],
        iconAnchor: [50, 15],
        popupAnchor: [0, -18],
    });
};
const initMap = async () => {
    if (!mapContainer.value) return;

    await nextTick();

    map = L.map(mapContainer.value, {
        zoomControl: false,
        maxZoom: 22,
    }).setView([-7.8385 - 0.012, 110.4632 - 0.012], 6);

    map.invalidateSize();

    const tileLayer = L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`,
        {
            maxNativeZoom: 19,
            maxZoom: 22,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
    ).addTo(map);

    tileLayer.once('load', () => {
        requestAnimationFrame(() => {
            if (!map) return;
            map.flyTo(INITIAL_CENTER, INITIAL_ZOOM, {
                duration: 0.8,
                easeLinearity: 0.25,
            });
        });
    });

    // =========================================================================
    // 2. LISTEN FOR POPUP CLOSE -> REVERT TO INITIAL VIEW
    // =========================================================================
    map.on('popupclose', () => {
        // Small tick to ensure user didn't just click another marker
        requestAnimationFrame(() => {
            if (!map) return;

            // Check if any other marker's popup is currently open
            const isAnyPopupOpen = Array.from(markersMap.values()).some((m) => m.isPopupOpen());

            // If completely closed, smoothly fly back to the initial overview!
            if (!isAnyPopupOpen) {
                map.flyTo(INITIAL_CENTER, INITIAL_ZOOM, {
                    duration: 0.5,
                    easeLinearity: 0.25,
                });

                // Reset selection filter back to 'all'
                emit('select-property', 'all');
            }
        });
    });

    renderMarkers();
};
const renderMarkers = () => {
    if (!map) return;

    markersMap.clear();

    properties.forEach((prop) => {
        if (!prop.coordinates?.lat || !prop.coordinates?.lng) return;

        const marker = L.marker([prop.coordinates.lat, prop.coordinates.lng], {
            icon: createPropertyPin(prop),
        });

        const popupHtml = `
            <div style="font-family: inherit; width: 200px; color: #f4f4f5;">
                ${prop.id ? `<img src="/images/${prop.id}.jpg" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" />` : ''}
                <strong style="display: block; font-size: 13px; font-weight: 700; color: #fff;">${prop.name}</strong>
                <p style="font-size: 11px; color: #a1a1aa; margin: 2px 0 6px 0;">${prop.address}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #27272a; padding-top: 6px;">
                    <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #a3e635;">${formatIDR(prop.price)}/nt</span>
                    <a href="#/properties/${prop.id}" style="font-size: 11px; font-weight: 600; color: #a3e635; text-decoration: none;">Details &rarr;</a>
                </div>
            </div>
        `;

        marker.bindPopup(popupHtml);

        marker.on('click', () => {
            emit('select-property', prop.id);
        });

        if (!map) return;

        marker.addTo(map);
        markersMap.set(prop.id, marker);
    });
};

onMounted(() => initMap());

onBeforeUnmount(() => {
    if (map) {
        map.remove();
        map = null;
    }
});
</script>

<template>
    <div class="flex flex-col mb-4">
        <div class="mt-4 mb-4">
            <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">All Properties</h2>
            <p class="mt-1 text-xs text-mist-400">Across Indonsia</p>
        </div>
        <div
            class="relative h-full min-h-64 w-full overflow-hidden rounded-md border border-mist-800 bg-mist-950 shadow-md">
            <!-- Map Canvas -->
            <div
                ref="mapContainer"
                class="h-full w-full z-10" />

            <!-- Top Left: Map Legend / Info Badge -->
            <div
                class="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-md border border-mist-800/80 bg-mist-900/90 px-3 py-1.5 text-xs text-mist-200 backdrop-blur-sm shadow-lg">
                <span class="h-2 w-2 rounded-full bg-lime-400 animate-pulse" />
                <span class="font-semibold">
                    {{ properties.length }} Locations Across Indonesia
                </span>
            </div>
        </div>
    </div>
</template>

<style>
/* Leaflet popup dark mode styling */
.leaflet-popup-content-wrapper {
    background: #18181b !important; /* mist-900 */
    border: 1px solid #3f3f46; /* mist-700 */
    border-radius: 8px !important;
    padding: 6px !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7) !important;
}
.leaflet-popup-tip {
    background: #18181b !important;
    border: 1px solid #3f3f46;
}
.leaflet-popup-close-button {
    color: #a1a1aa !important;
}
</style>
