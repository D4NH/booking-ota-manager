import Dexie, { type EntityTable } from 'dexie';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import type {
    PropertyFinance,
    PersonalFinance,
    SharedFinance,
    OwnerTransfer,
    PersonalSavings,
    GoldAsset,
    RecurringTemplate,
    SavingGoal,
} from '@/types/finance';

export const db = new Dexie('YogyakartaRentalsDB') as Dexie & {
    properties: EntityTable<Property, 'id'>;
    bookings: EntityTable<Booking, 'id'>;
    propertyFinances: EntityTable<PropertyFinance, 'id'>;
    personalFinances: EntityTable<PersonalFinance, 'id'>;
    sharedFinances: EntityTable<SharedFinance, 'id'>;
    transfers: EntityTable<OwnerTransfer, 'id'>;
    personalSavings: EntityTable<PersonalSavings, 'id'>;
    goldAssets: EntityTable<GoldAsset, 'id'>;
    recurringTemplates: EntityTable<RecurringTemplate, 'id'>;
    savingGoals: EntityTable<SavingGoal, 'id'>;
};

db.version(1).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
});

db.version(2).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
    propertyFinances: 'id, propertyId, type, category, date, bookingId',
    personalFinances: 'id, owner, type, category, date',
    sharedFinances: 'id, type, category, date',
    transfers: 'id, sourcePropertyId, targetAccount, date',
});

db.version(3).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
    propertyFinances: 'id, propertyId, type, category, date, bookingId',
    personalFinances: 'id, owner, type, category, date',
    sharedFinances: 'id, type, category, date',
    transfers: 'id, sourcePropertyId, targetAccount, date',
    personalSavings: 'id, owner, institution',
    goldAssets: 'id, owner, type, purchaseDate',
});

db.version(4).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
    propertyFinances: 'id, propertyId, type, category, date, bookingId',
    personalFinances: 'id, owner, type, category, date',
    sharedFinances: 'id, type, category, date',
    transfers: 'id, sourcePropertyId, targetAccount, date',
    personalSavings: 'id, owner, institution',
    goldAssets: 'id, owner, type, purchaseDate',
    recurringTemplates: 'id, targetLedger, category, active',
});

db.version(5).stores({
    properties: 'id, name',
    bookings: 'id, propertyId, bookingId, checkIn, checkOut, status, listing',
    propertyFinances: 'id, propertyId, type, category, date, bookingId',
    personalFinances: 'id, owner, type, category, date',
    sharedFinances: 'id, type, category, date',
    transfers: 'id, sourcePropertyId, targetAccount, date',
    personalSavings: 'id, owner, institution',
    goldAssets: 'id, owner, type, purchaseDate',
    recurringTemplates: 'id, targetLedger, category, active',
    savingGoals: 'id, owner, priority',
});

export default db;
