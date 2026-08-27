# TODO: Multi-Property Rental Management Website

## Stack Architecture

- [x] **Framework:** Vue 3 (`<script setup>`, Composition API) with TypeScript
- [x] **State Management:** Pinia (stores for `useBookingStore`, `usePropertyStore`)
- [x] **Local Database:** Dexie.js (IndexedDB) or SQLite WASM
- [x] **Styling:** Scoped CSS / CSS Modules
- [x] **Dev Workflow:** Local execution via `npm run dev` (`http://localhost:5173`)

---

## Phase 1: Core Setup & Data Architecture

### Data Models & Schema (`src/db/schema.ts`)

- [x] Define `Property` interface:
    - `id`: string (e.g., `'mai-house'`, `'house-2'`)
    - `name`: string (e.g., `'Mai House Jogja'`)
    - `codePrefix`: string (e.g., `'MHJ'`, `'H2'`)
    - `color`: string (UI calendar badge color)
- [x] Define `Booking` interface:
    - `id`: string (UUID internal)
    - `propertyId`: string (foreign key to `Property`)
    - `bookingId`: string (OTA ID or custom `MHJ-00032`)
    - `listing`: `'Airbnb' | 'Booking.com' | 'Tiket.com' | 'Trip.com' | 'Whatsapp' | 'Unavailable'`
    - `guestName`: string
    - `checkIn`: string (YYYY-MM-DD)
    - `checkOut`: string (YYYY-MM-DD)
    - `nights`: number
    - `payout`: number (IDR gross)
    - `commission`: number (IDR optional channel fee)
    - `netPayout`: number (computed)
    - `status`: `'Booked' | 'Completed' | 'Checked-in' | 'No show' | 'Waiting for payment' | 'Unavailable'`
    - `notes`: string (e.g., `"300k extra guest"`)
    - `createdAt`: string

### Pinia Stores

- [x] **`stores/usePropertyStore.ts`**:
    - State: `properties` array initialized with Mai House Jogja
    - State: `selectedPropertyId` (`'all'` or specific ID)
    - Action: `addProperty(payload)`
- [x] **`stores/useBookingStore.ts`**:
    - Actions: `fetchBookings()`, `addBooking()`, `updateBooking()`, `deleteBooking()`
    - Computed: `filteredBookings` (by selected property and date range)

---

## Phase 2: Views & Components

### 1. Navigation & Global Shell

- [x] Global Header with Property Selector dropdown (`All Properties`, `Mai House Jogja`, etc.)
- [x] Sidebar/Nav links: `Dashboard`, `Calendar`, `Bookings`, `Financials`, `Settings`

### 2. Operations Dashboard (`views/DashboardView.vue`)

- [x] Today's Arrival list
- [x] Today's Departure list
- [x] Current In-House Guests
- [x] Alert banner for `Waiting for payment` direct WhatsApp bookings
- [x] Quick monthly payout & occupancy rate summary cards

### 3. Visual Multi-Property Calendar (`views/CalendarView.vue`)

- [x] Multi-property stacked timeline grid (properties on Y-axis, dates on X-axis)
- [x] Color-coded reservation blocks by channel (Airbnb, Booking.com, Tiket.com, Trip.com, WhatsApp)
- [ ] Click-and-drag date range selection to open new booking form
- [x] Overlap prevention checks when creating new stays

### 4. Booking Management & Quick Form (`views/BookingsView.vue`)

- [x] Filterable data table (by property, status, channel, date range, search guest name/ID)
- [x] **New/Edit Booking Modal**:
    - Auto-suggest sequential IDs for WhatsApp bookings (e.g., `MHJ-00032`)
    - Auto-calculate `nights` based on check-in/check-out dates
    - Validation to prevent date conflicts
- [ ] **WhatsApp Quick Action Button**:
    - One-click pre-filled WhatsApp link generation (check-in details, address, payment reminders)

### 5. Financial & Multi-House Analytics (`views/AnalyticsView.vue`)

- [ ] Monthly revenue comparison charts across properties
- [ ] Channel distribution breakdown (Airbnb vs Tiket vs Booking vs Trip vs WhatsApp)
- [ ] Secondary income/notes fee tracking (extra guest fees, early check-ins)

### 6. Settings & Data Utilities (`views/SettingsView.vue`)

- [ ] Add/Edit rental properties
- [ ] **1-Click Backup Export**: Generate JSON/CSV dump of database to local disk
- [ ] **Backup Import**: File picker to restore database state

---

## Phase 3: Testing & Refinement

- [ ] Import historical spreadsheet data (`Yogyakarta Rental Property 2026`) into local database
- [ ] Test multi-house date collision scenarios
- [ ] Verify offline persistence and page refresh stability
