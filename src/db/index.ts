import Dexie, { type EntityTable } from 'dexie';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';

const db = new Dexie('YogyakartaRentalsDB') as Dexie & {
    properties: EntityTable<Property, 'id'>;
    bookings: EntityTable<Booking, 'id'>;
};

db.version(1).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
});

export { db };
