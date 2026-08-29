import Dexie, { type EntityTable } from 'dexie';
import type { Property } from '@/types/properties';

export interface Booking {
    id: string; // UUID
    propertyId: string;
    bookingId: string; // OTA ID
    listing: 'Airbnb' | 'Booking.com' | 'Tiket.com' | 'Trip.com' | 'Whatsapp' | 'Unavailable';
    guestName: string;
    checkIn: string; // YYYY-MM-DD
    checkOut: string; // YYYY-MM-DD
    nights: number;
    payout: number; // IDR
    status:
        | 'Booked'
        | 'Completed'
        | 'Checked-in'
        | 'No show'
        | 'Waiting for payment'
        | 'Waiting for payout'
        | 'Unavailable';
    notes?: string;
    createdAt: string;
}

// Instantiate Dexie with type-safe tables
const db = new Dexie('YogyakartaRentalsDB') as Dexie & {
    properties: EntityTable<Property, 'id'>;
    bookings: EntityTable<Booking, 'id'>;
};

// Index definition: syntax 'primaryKey, indexedProp1, indexedProp2'
db.version(1).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
});

export { db };
