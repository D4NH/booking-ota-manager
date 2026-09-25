export const CHANNEL_WARNINGS: Record<string, string> = {
    'Tiket.com': 'Bookings from Tiket.com need to be blocked in Airbnb.com',
    'Trip.com': 'Bookings from Trip.com need to be blocked in Tiket.com',
};

// • Airbnb syncs and pulls from booking.com and trip.com
// • Booking.com syncs and pulls from airbnb, trip.com. only syncs to tiket.com, agoda.com
// • tiket.com syncs and pulls from airbnb and booking.com
// • Trip.com syncs and pulls from airbnb and booking.com

export const MONTH_NAMES: string[] = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

export const SHORT_MONTH_NAMES: string[] = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

export const DAYS_OF_WEEK: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
