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
