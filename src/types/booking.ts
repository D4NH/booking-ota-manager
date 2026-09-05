import type { PropertyId } from './property';

export type BookingChannel =
    'Airbnb' | 'Booking.com' | 'Tiket.com' | 'Trip.com' | 'Whatsapp' | 'Unavailable';

export type BookingStatus =
    | 'Booked'
    | 'Checked-in'
    | 'Checked-out'
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

// export interface Booking {
//     id: string; // UUID
//     propertyId: string;
//     bookingId: string; // OTA ID
//     listing: 'Airbnb' | 'Booking.com' | 'Tiket.com' | 'Trip.com' | 'Whatsapp' | 'Unavailable';
//     guestName: string;
//     checkIn: string; // YYYY-MM-DD
//     checkOut: string; // YYYY-MM-DD
//     nights: number;
//     payout: number; // IDR
//     status:
//         | 'Booked'
//         | 'Completed'
//         | 'Checked-in'
//         | 'No show'
//         | 'Waiting for payment'
//         | 'Waiting for payout'
//         | 'Unavailable';
//     notes?: string;
//     createdAt: string;
// }
