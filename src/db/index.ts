import Dexie, { type EntityTable, type Table } from 'dexie';
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

export class RentalDatabase extends Dexie {
    bookings!: Table<Booking, string>;
    properties!: Table<Property, string>;

    constructor() {
        super('RentalHomeDB');
        this.version(1).stores({
            bookings: '++id, bookingId, propertyId, checkIn, checkOut, status',
            properties: 'id, name, available', // Primary key: id ('piyungan', etc.)
        });
    }
}

export { db };
