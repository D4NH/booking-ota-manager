import type { PropertyId } from './property';

export type BookingChannel =
    'Airbnb' | 'Booking.com' | 'Tiket.com' | 'Trip.com' | 'Whatsapp' | 'Unavailable';

export type BookingStatus =
    | 'Booked'
    | 'Checked-in'
    | 'Checking-out'
    | 'Waiting for payment'
    | 'Waiting for payout'
    | 'Completed'
    | 'No show'
    | 'Unavailable';

// Booking Google Sheet:
// Booking ID | Listing | Guest Name | Check-in | Check-out | Nights | Payout | Owner Payout | Status | Notes | calendarEventId
export interface Booking {
    id: string; // Dexie IndexedDB Primary Key
    createdAt: string; // Local audit timestamp
    propertyId: PropertyId; // Metadata for routing
    bookingId: string; // Google Sheets Column A
    listing: BookingChannel;
    guestName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    payout: number;
    ownerPayout?: number;
    status: BookingStatus;
    notes?: string;
    calendarEventId?: string;
}
export type BookingPayload = Omit<Booking, 'id' | 'createdAt'>;

export interface BookingGroup {
    key: string;
    label: string;
    count: number;
    bookings: Booking[];
}

// Staging Google Sheet:
// id | propertyId | bookingId | listing | guestName | checkIn | checkOut | nights | payout | status | notes | calendarEventId
export type StagingStatus = 'Pending Approval' | 'Approved' | 'Rejected';
export interface StagedBooking {
    id: string;
    propertyId: PropertyId;
    bookingId: string;
    listing: BookingChannel;
    guestName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    payout: number;
    ownerPayout?: number;
    status: StagingStatus;
    notes?: string;
    calendarEventId?: string;
    hasConflict?: boolean;
}
