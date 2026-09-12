import { computed, toValue, type Ref, type MaybeRefOrGetter } from 'vue';
import { useDateKeys } from '@/composables/useDateKeys';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

export interface UseDailyOperationsOptions {
    propertyId?: MaybeRefOrGetter<PropertyId | 'all' | undefined>;
}

export interface StaySection {
    label: string;
    items: Booking[];
}

export function useDailyOperations(
    bookings: Ref<Booking[]>,
    options: UseDailyOperationsOptions = {}
) {
    const { currentDay, currentHour } = useDateKeys();

    const getActivePropertyId = (): PropertyId | null => {
        // toValue executes the getter () => props.id inside the computed tracker
        const rawId = toValue(options.propertyId);
        return rawId && rawId !== 'all' ? (rawId as PropertyId) : null;
    };

    const dailyOperationsData = computed(() => {
        const today = currentDay.value;
        const hour = currentHour.value;
        const activePropertyId = getActivePropertyId();
        const list = bookings.value || [];

        const arrivals: Booking[] = [];
        const stays: Booking[] = [];
        const departures: Booking[] = [];

        let totalScheduledArrivals = 0;
        let totalScheduledDepartures = 0;

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;

            if (activePropertyId && b.propertyId !== activePropertyId) continue;

            const checkIn = b.checkIn || '';
            const checkOut = b.checkOut || '';

            if (checkIn === today) totalScheduledArrivals++;
            if (checkOut === today) totalScheduledDepartures++;

            // Arrivals
            if (checkIn === today && b.status !== 'Checked-out') {
                if (b.status !== 'Checked-in' || hour < 15) {
                    arrivals.push(b);
                }
            }

            // Departures
            if (checkOut === today) {
                if (hour < 15 || b.status === 'Checked-in') {
                    departures.push(b);
                }
            }

            // Currently Staying
            if (checkIn < today && checkOut > today) {
                stays.push(b);
            } else if (checkIn === today && (b.status === 'Checked-in' || hour >= 15)) {
                stays.push(b);
            } else if (checkOut === today && hour < 12 && b.status !== 'Checked-out') {
                stays.push(b);
            }
        }

        return {
            arrivals,
            stays,
            departures,
            turnover: {
                in: totalScheduledArrivals, // ✅ FIXED: True arrivals count (never falls back to stays)
                out: totalScheduledDepartures,
            },
        };
    });

    const todaysArrivals = computed(() => dailyOperationsData.value.arrivals);
    const currentStays = computed(() => dailyOperationsData.value.stays);
    const todaysDepartures = computed(() => dailyOperationsData.value.departures);
    const todaysTurnover = computed(() => dailyOperationsData.value.turnover);

    const isOccupied = computed<boolean>(() => {
        return currentStays.value.length > 0;
    });

    const staySections = computed<StaySection[]>(() => {
        const activePropertyId = getActivePropertyId();

        const arrivals = [...todaysArrivals.value];
        let stays = [...currentStays.value];
        let departures = [...todaysDepartures.value];

        // Specific property mode (activePropertyId !== null)
        if (activePropertyId) {
            const inHouseNames = new Set(stays.map((s) => s.guestName.trim().toLowerCase()));

            // Only show "Leaving Today" if guest matches someone in-house
            departures = departures.filter((dep) =>
                inHouseNames.has(dep.guestName.trim().toLowerCase())
            );

            // Deduplicate: Don't repeat guest in both Currently Staying and Leaving Today
            const departingNames = new Set(departures.map((d) => d.guestName.trim().toLowerCase()));
            stays = stays.filter((s) => !departingNames.has(s.guestName.trim().toLowerCase()));
        }

        return [
            { label: 'Arriving Today', items: arrivals },
            { label: 'Currently Staying', items: stays },
            { label: 'Leaving Today', items: departures },
        ].filter((section) => section.items.length > 0);
    });

    return {
        todaysArrivals,
        currentStays,
        todaysDepartures,
        todaysTurnover,
        isOccupied,
        staySections,
    };
}
