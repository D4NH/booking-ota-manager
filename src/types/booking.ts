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

export interface Booking {
    id: string;
    propertyId: PropertyId;
    bookingId: string;
    listing: BookingChannel;
    guestName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    payout: number;
    status: BookingStatus;
    notes?: string;
    createdAt: string;
}
