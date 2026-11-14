# Booking-ota-manager

Summary of **Google Sheets backend** and **Vue 3 application** work together across your short-term rentals and personal finances.

---

# 1. High-Level Architecture & Operating Model

The system uses a **Dual-Account, Offline-First** model where **Google Sheets is the authoritative Source of Truth**, **Dexie IndexedDB provides instant 0ms local client boot**, and **Cloudflare Workers act as the high-speed edge proxy**.

```
                           ┌──────────────────────────────────────────────┐
                           │      ACCOUNT B (Headless Automation)         │
                           │   - Runs MHJ_Central_Hub.gs (5-min cron)     │
                           │   - Scrapes OTA confirmation emails in Gmail │
                           │   - Manages Staging_Reservations Sheet       │
                           │   - Creates [PENDING] Calendar events        │
                           └──────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE SHEETS (Authoritative Database)                          │
│                                                                                        │
│  1. Property Booking Sheets (Piyungan 2025/2026/2027, etc.)                             │
│  2. Master Finance Spreadsheet (Property_Finances, Personal, Shared, Transfers, SBN)   │
│  3. Staging Reservations Sheet                                                         │
└───────────────────▲────────────────────────────────────────────────┬───────────────────┘
                    │                                                │
       Sheets REST API v4 (OAuth)                             REST API / SWR
                    │                                                │
┌───────────────────┴────────────────────────────────┐               ▼
│          ACCOUNT A: VUE 3 CLIENT APPLICATION       │   ┌───────────────────────────────┐
│                                                    │   │   CLOUDFLARE WORKER PROXY     │
│  - Pinia State Stores & VueUse Composables         │   │   (mhj-calendar-proxy)        │
│  - Dexie IndexedDB (Local cache: version 7)        │   │                               │
│  - Review & Approve Staged Reservations            │   │  - Sub-second RFC 5545 iCal   │
│  - Personal & Shared Accounting Ledgers            │   │    stream to OTAs (Airbnb/    │
│  - SBN, Gold Portfolio & Waterfall Savings Goals   │   │    Booking.com/Tiket.com)     │
│  - Dark 'Mist' & 'Lime' Theme with SVG Charts      │   │  - Live Antam Gold Price API  │
│  - Manual Persistent Lockbox PINs                  │   │  - On-demand cache purge      │
└────────────────────────────────────────────────────┘   └───────────────────────────────┘
```

---

# 2. Google Sheets Schema & Structure

### A. Property Booking Sheets (`Piyungan_2026`, `Piyungan_2027`, etc.)

Multi-year sheets storing confirmed guest stays (11 columns):

|  Col  | Header            | Description / Format                                                                     |
| :---: | ----------------- | ---------------------------------------------------------------------------------------- |
| **A** | `Booking ID`      | Unique OTA reference (e.g. `HM123456`, `DIRECT-2026-10-01_2026-10-04`)                   |
| **B** | `Listing`         | Channel: `Airbnb`, `Booking.com`, `Tiket.com`, `Trip.com`, `Whatsapp`, `Unavailable`     |
| **C** | `Guest Name`      | Full name of the primary guest                                                           |
| **D** | `Check-in`        | Canonical ISO date string (`YYYY-MM-DD`)                                                 |
| **E** | `Check-out`       | Canonical ISO date string (`YYYY-MM-DD`)                                                 |
| **F** | `Nights`          | Calculated stay duration                                                                 |
| **G** | `Payout`          | Total gross revenue from the booking                                                     |
| **H** | `Owner Payout`    | Commission calculated at **15%** ($Gross \times 0.15$)                                   |
| **I** | `Status`          | `Booked`, `Checked-in`, `Checking-out`, `Completed`, `Waiting for payout`, `Unavailable` |
| **J** | `Notes`           | Guest requests, channel tags, flight info                                                |
| **K** | `calendarEventId` | Google Calendar v3 Event ID for two-way synchronization                                  |

### B. Staging Booking Sheet (`Staging_Reservations`)

Intermediate inbox managed by Account B's email parser (12 columns):
`id (UUID) | propertyId | bookingId | listing | guestName | checkIn | checkOut | nights | payout | status (Pending Approval) | notes | calendarEventId`

### C. Master Finance Spreadsheet (`VITE_FINANCE_SPREADSHEET_ID`)

Consolidates all accounting, investments, and household budgets:

1. **`Property_Finances`**: Property operating ledger (`id | propertyId | type | category | amount | date | notes`).
2. **`Personal_Transactions`**: Segregated personal transactions (`id | owner | type | category | amount | date | notes | savingsInstitution | goldWeightGrams`).
3. **`Shared_Transactions`**: Joint household expenses (`BPJS`, `House`, `Education`, `Utilities`).
4. **`Transfers`**: Owner draw distributions from rental revenue to personal/shared checking (`id | sourcePropertyId | targetAccount | amount | date | notes`).
5. **`Gold_Assets`**: Physical & digital gold portfolio (`id | owner | type | weightGrams | buyPriceTotal | purchaseDate | certificateNumber`).
6. **`Recurring_Templates`**: Monthly/yearly bills auto-projected onto cash flow.
7. **`Saving_Goals`**: Milestone savings targets evaluated against liquid reserves.
8. **`SBN_Investments`**: Government Sukuk/Bonds (SR022) with maturity countdowns and coupon yields.

---

# 3. Vue 3 Application Architecture

### A. State Management & Offline Persistence

- **Dexie IndexedDB (`YogyakartaRentalsDB`)**:
  Stores `bookings`, `propertyFinances`, `personalFinances`, `sharedFinances`, `transfers`, `goldAssets`, `recurringTemplates`, `savingGoals`, and `sbnInvestments`. On page reload, the app boots in **0ms** from Dexie before revalidating over the network.
- **Pinia Stores**:
    - `useBookingStore`: Multi-year routing, calendar event updates, conflict checks.
    - `useFinanceStore`: Root financial coordinator (batch Sheets fetches, gold price, SBN, recurring settlement).
    - `useStagingStore`: Polls unapproved reservations, triggers on-demand email scrapes, archives Gmail threads.
    - `usePropertyStore`: Metadata, amenities, Wi-Fi credentials, and coordinates.
    - `useModalStore`: Decoupled modal state controller.

### B. Network Client (`useGoogleSheets.ts`)

- **Request Deduplication**: `inFlightRequests` Map coalesces simultaneous identical GET requests.
- **Exponential Backoff**: Automatic retry with jitter on `429` (Rate Limit) and `503` (Google glitches) ($1\text{s} \to 2\text{s} \to 4\text{s}$).
- **Lean Queries**: Range searches default to `A2:A` when only matching IDs, reserving `A2:K` only when calendar IDs are required.

---

# 4. Core Business Logic & Workflows

### 1. Automated Reservation Lifecycle

1. **Ingestion**: An OTA confirmation arrives in Account B's Gmail. `MHJ_Central_Hub.gs` parses the email via custom regex, appends it to `Staging_Reservations` with status `Pending Approval`, and creates a `[PENDING]` blockout in Google Calendar.
2. **Review & Approval**: The Vue app displays the pending reservation in `ReviewBookingModal.vue`. The user verifies pricing, notes, and checks for date conflicts.
3. **Promotion**: Upon clicking **Approve**, the Vue app:
    - Appends the reservation into the active year's booking sheet (e.g. `Piyungan_2026`).
    - Updates the Google Calendar event from `[PENDING]` to a rich confirmed reservation description in place (using Column K `calendarEventId`), avoiding duplicate events.
    - Calls Cloudflare Worker `/api/purge` to refresh the outbound OTA iCal feed.
    - Triggers Account B to archive the Gmail email thread out of the inbox.

### 2. "Virtual Dexie Payouts" vs. Accounting Ledger

To avoid manually copying rental earnings into the finance ledger:

- The Vue app automatically derives **"Virtual Payouts"** in memory directly from completed bookings in Dexie (`bookingIncomeRecords`).
- If the user clicks **Persist Bookings to Sheet**, the payouts are permanently appended to the `Property_Finances` Google Sheet with an embedded tag in the notes: `[MHJ-BOOKING: bookingId]`.
- When reading the finance sheet, **`REGEX_MHJ_BOOKING`** (`/\[MHJ-BOOKING:\s*([^\]]+)\]/`) scans the notes to detect already-persisted bookings, dynamically deduplicating them so revenue is never double-counted.

### 3. Investment & Capital Tracking

- **SBN Sukuk Ritel (SR022)**:
    - Tenor progress and maturity months remaining are calculated dynamically:
      $$\text{Progress \%} = \min\left(100, \max\left(0, \frac{\text{Today} - \text{IssueDate}}{\text{MaturityDate} - \text{IssueDate}} \times 100\right)\right)$$
    - Monthly gross coupon ($Principal \times \frac{6.45\%}{12}$) and net coupon (after 10% tax) are calculated and matched against incoming shared/personal yields via regex.
- **Gold Reserves**:
    - Cloudflare Worker edge-caches the live Antam gold price per gram (`/api/gold-price`) for 2 hours.
    - Real-time portfolio valuation and unrealized PnL are evaluated dynamically:
      $$\text{Valuation} = \text{Total Grams} \times \text{Current Price}$$
      $$\text{Unrealized PnL} = \text{Valuation} - \text{Cost Basis}$$
- **Priority Waterfall Savings Allocation**:
  Liquid savings cascade into prioritized goals (capped strictly at 100% capacity).

### 4. Custom SVG Charting Engine

The app uses custom reactive SVGs designed for the `mist` dark theme (`#18181b` / `#27272a`):

- **Cash Flow Chart (`PersonalCashFlowChart.vue`)**:
  Paired SVG bars for **Income (Lime)** vs. **Expenses (Rose)** with dynamic Y-axis scaling, 6M/YTD range switching, and dynamic tooltip positioning tracking the hovered column.
- **Spending Trajectory Chart (`PersonalSpendingPacingChart.vue`)**:
  Cubic bezier (`generateSmoothPath`) curve comparing MTD cumulative spending against the previous month, terminating in a centered pulsing dot (translated via SVG `<g>` to eliminate diagonal animation drift).

---

# 5. Cloudflare Worker Edge Proxy

The Worker runs on Cloudflare's global edge network in pure JavaScript:

1. **`/piyungan.ics` (and multi-unit variants)**:
    - Fetches active bookings and pending staging holds from Account B's Google Apps Script.
    - Serves RFC 5545 `.ics` with `STATUS:CONFIRMED` and `TRANSP:OPAQUE`.
    - Enforces strict CRLF (`\r\n`) line terminators.
    - Employs Stale-While-Revalidate (`max-age=180, stale-while-revalidate=600`) edge caching for sub-15ms OTA sync response times.
2. **`/api/purge`**:
    - Authenticated webhook endpoint that instantly clears cached `.ics` files upon booking modifications in the Vue app.
3. **`/api/gold-price`**:
    - Edge-cached (2 hours) Antam gold price scraper with automatic fallback to guarantee 100% uptime for portfolio valuations.
4. **`/debug`**:
    - Live connectivity test verifying Google Script integration, payload size, and calendar RFC compliance.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
    - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
    - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
    - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
    - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
pnpm test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```
