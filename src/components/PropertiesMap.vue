<!-- src/components/properties/PortfolioMap.vue -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPropertyTheme } from '@/config/properties';
import { formatIDR } from '@/utils/money';
import type { Property, PropertyId } from '@/types/property';

const props = withDefaults(
    defineProps<{
        properties: Property[];
        selectedPropertyId?: PropertyId | 'all';
    }>(),
    {
        selectedPropertyId: 'all',
    }
);

const emit = defineEmits<{
    (e: 'select-property', id: PropertyId): void;
}>();

const mapContainer = ref<HTMLElement | null>(null);

let map: L.Map | null = null;
const markersMap = new Map<PropertyId | 'all', L.Marker>();
let featureGroup: L.FeatureGroup | null = null;

const createPropertyPin = (prop: Property, isSelected: boolean) => {
    const theme = getPropertyTheme(prop.id);
    const shortPrice = `${Math.round(prop.price / 1000)}k`;

    return L.divIcon({
        className: 'bg-transparent border-0',
        html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
                <!-- Outer glow when selected -->
                ${isSelected ? '<span class="absolute -inset-1 rounded-full bg-lime-400/40 animate-ping"></span>' : ''}

                <!-- Pin Pill -->
                <div class="relative flex items-center gap-1.5 rounded-full border ${isSelected ? 'border-lime-400 ring-2 ring-lime-400/30' : 'border-mist-700'} bg-mist-900 px-2.5 py-1 text-xs shadow-xl transition-transform duration-200 group-hover:scale-110">
                    <span class="h-2 w-2 rounded-full shrink-0 ${theme.bg || 'bg-lime-400'}"></span>
                    <span class="font-bold text-mist-100 whitespace-nowrap">${prop.name.replace('Mai House - ', '')}</span>
                    <span class="font-mono font-semibold text-lime-400 text-[11px]">${shortPrice}</span>
                </div>
            </div>
        `,
        iconSize: [100, 30],
        iconAnchor: [50, 15],
        popupAnchor: [0, -18],
    });
};

const initMap = () => {
    if (!mapContainer.value) return;

    map = L.map(mapContainer.value, {
        zoomControl: false,
        maxZoom: 22,
    }).setView([-7.8385, 110.4632], 11);

    L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`,
        {
            maxNativeZoom: 19,
            maxZoom: 22,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
    ).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    renderMarkers();
};

const renderMarkers = () => {
    if (!map) return;

    if (featureGroup) {
        featureGroup.clearLayers();
    }
    markersMap.clear();

    const markers: L.Marker[] = [];

    props.properties.forEach((prop) => {
        if (!prop.coordinates?.lat || !prop.coordinates?.lng) return;

        const isSelected = props.selectedPropertyId === prop.id;
        const marker = L.marker([prop.coordinates.lat, prop.coordinates.lng], {
            icon: createPropertyPin(prop, isSelected),
        });

        // Popup with property thumbnail, price & link
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

        marker.addTo(map);
        markers.push(marker);
        markersMap.set(prop.id, marker);
    });

    // 3. Auto-fit all markers in view
    if (markers.length > 0) {
        featureGroup = L.featureGroup(markers);

        if (props.selectedPropertyId === 'all') {
            map.fitBounds(featureGroup.getBounds(), {
                padding: [50, 50],
                maxZoom: 14,
            });
        }
    }
};

// Handle property filter switching
watch(
    () => props.selectedPropertyId,
    (newId) => {
        if (!map) return;

        if (newId === 'all' && featureGroup && featureGroup.getLayers().length > 0) {
            // Zoom out to fit all properties
            map.flyToBounds(featureGroup.getBounds(), {
                padding: [50, 50],
                duration: 1.5,
                maxZoom: 14,
            });
        } else if (newId && markersMap.has(newId)) {
            // Zoom in to the selected property
            const targetProp = props.properties.find((p) => p.id === newId);
            if (targetProp?.coordinates) {
                map.flyTo([targetProp.coordinates.lat, targetProp.coordinates.lng], 16, {
                    duration: 1.5,
                    easeLinearity: 0.25,
                });
                // Open popup
                markersMap.get(newId)?.openPopup();
            }
        }

        // Refresh pin icon styles to toggle selected glow
        props.properties.forEach((p) => {
            const m = markersMap.get(p.id);
            if (m) {
                m.setIcon(createPropertyPin(p, p.id === newId));
            }
        });
    }
);

onMounted(() => {
    initMap();
});

onBeforeUnmount(() => {
    if (map) {
        map.remove();
        map = null;
    }
});
</script>

<template>
    <div
        class="relative h-full min-h-80 w-full overflow-hidden rounded-md border border-mist-800 bg-mist-950 shadow-md">
        <!-- Map Canvas -->
        <div
            ref="mapContainer"
            class="h-full w-full z-10" />

        <!-- Top Left: Map Legend / Info Badge -->
        <div
            class="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-lg border border-mist-700/80 bg-mist-900/90 px-3 py-1.5 text-xs text-mist-200 backdrop-blur-sm shadow-lg">
            <span class="h-2 w-2 rounded-full bg-lime-400 animate-pulse" />
            <span class="font-semibold">{{ properties.length }} Locations Across Yogyakarta</span>
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
