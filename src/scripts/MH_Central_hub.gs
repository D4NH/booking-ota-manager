/**
 * ============================================================================
 * MAI HOUSE JOGJA — CENTRAL AUTOMATION HUB
 *
 * • Gmail Scraper (OTA Confirmation Emails -> Staging Sheet)
 * • Two-Way Google Calendar Sync
 * • Master RFC 5545 iCal Stream for Cloudflare Edge Proxy
 * • Bi-directional Mobile Google Sheets Sync & Cleanup
 * • Chronological Sheet Sorter (Jan -> Dec by Check-in & Day)
 * ============================================================================
 */

// ============================================================================
// 1. UNIFIED SYSTEM CONFIGURATION
// ============================================================================

const PROPS = PropertiesService.getScriptProperties().getProperties();

const CONFIG = {
    SYNC_SECRET: PROPS.SYNC_SECRET || '',
    STAGING_SHEET_ID: PROPS.STAGING_SHEET_ID || '',

    BOOKING_COM_COMMISSION_PCT: Number(PROPS.BOOKING_COM_COMMISSION_PCT) || 19.2,
    SCRAPER_DAYS_LOOKBACK: Number(PROPS.SCRAPER_DAYS_LOOKBACK) || 4,

    PROPERTIES: {
        piyungan: {
            name: 'Mai House Jogja - Piyungan',
            calendarId: PROPS.CALENDAR_ID_PIYUNGAN || '',
            sheets: [
                { year: 2026, id: PROPS.SHEET_ID_PIYUNGAN_2026 || '' },
                { year: 2027, id: PROPS.SHEET_ID_PIYUNGAN_2027 || '' },
            ],
        },
        wonosari: {
            name: 'Mai House Jogja - Wonosari',
            calendarId: PROPS.CALENDAR_ID_WONOSARI || '',
            sheets: [
                { year: 2026, id: PROPS.SHEET_ID_WONOSARI_2026 || '' },
                { year: 2027, id: PROPS.SHEET_ID_WONOSARI_2027 || '' },
            ],
        },
        banguntapan: {
            name: 'Mai House Jogja - Banguntapan',
            calendarId: PROPS.CALENDAR_ID_BANGUNTAPAN || '',
            sheets: [
                { year: 2026, id: PROPS.SHEET_ID_BANGUNTAPAN_2026 || '' },
                { year: 2027, id: PROPS.SHEET_ID_BANGUNTAPAN_2027 || '' },
            ],
        },
        nusadua: {
            name: 'Mai House Bali - Nusa Dua',
            calendarId: PROPS.CALENDAR_ID_NUSADUA || '',
            sheets: [
                { year: 2026, id: PROPS.SHEET_ID_NUSADUA_2026 || '' },
                { year: 2027, id: PROPS.SHEET_ID_NUSADUA_2027 || '' },
            ],
        },
    },
};

// Patterns to discard immediately (payouts, bank transfers, insurance policies)
const IGNORED_SUBJECT_PATTERNS = [
    'Dokumen Polis',
    'Polis Perlindungan',
    'Flip for Business',
    'Bukti Transfer',
    'We sent a payout',
    'Payout sent',
    'Allotment Reconfirm',
    'Prepay Reservations Reconciliation',
    'Invoice',
    'Laporan kinerja mingguan',
    'statement',
    'Pemberitahuan Pembayaran',
    'Pembayaran',
    'We received this message',
];

function isIgnoredEmail(subject, snippet) {
    const text = (subject + ' ' + (snippet || '')).toLowerCase();
    for (let i = 0; i < IGNORED_SUBJECT_PATTERNS.length; i++) {
        if (text.includes(IGNORED_SUBJECT_PATTERNS[i].toLowerCase())) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// 2. UNIFIED WEB ROUTER (doGet)
// ============================================================================
function doGet(e) {
    const params = (e && e.parameter) || {};
    const token = params.token || '';
    const action = (params.action || '').toUpperCase();
    const propertyId = (params.property || 'piyungan').toLowerCase();
    const targetChannel = (params.channel || params.target || '').toLowerCase();

    // ROUTE A: iCal Export (For Cloudflare Worker / OTAs)
    if (action === 'ICAL_EXPORT' || (e && e.pathInfo && e.pathInfo.endsWith('.ics'))) {
        try {
            const icsContent = generateMasterIcs(propertyId, targetChannel);
            return ContentService.createTextOutput(icsContent).setMimeType(
                ContentService.MimeType.ICAL
            );
        } catch (err) {
            return ContentService.createTextOutput('ERROR: ' + err.toString()).setMimeType(
                ContentService.MimeType.TEXT
            );
        }
    }

    // Security Check for Protected Actions (Scrape, Archive)
    if (!token || token !== CONFIG.SYNC_SECRET) {
        return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: 'Unauthorized' })
        ).setMimeType(ContentService.MimeType.JSON);
    }

    // ROUTE B: Archive Email by Booking ID (Triggered when user clicks Approve / Reject in Vue)
    if (action === 'ARCHIVEEMAIL') {
        const bookingId = params.bookingId || '';
        const success = archiveEmailByBookingId(bookingId, params.label || 'Reservation');
        return ContentService.createTextOutput(
            JSON.stringify({ success, bookingId, action: 'archived' })
        ).setMimeType(ContentService.MimeType.JSON);
    }

    // ROUTE C: On-Demand Gmail Scrape (Triggered by "Scan Emails" button in Vue)
    if (action === 'SCRAPE' || !action) {
        try {
            const scrapedCount = processOtaEmails();
            return ContentService.createTextOutput(
                JSON.stringify({
                    success: true,
                    scrapedCount,
                    timestamp: new Date().toISOString(),
                })
            ).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
            return ContentService.createTextOutput(
                JSON.stringify({ success: false, error: err.toString() })
            ).setMimeType(ContentService.MimeType.JSON);
        }
    }

    // ROUTE D: On-Demand Force Sort Across All Property Sheets
    if (action === 'SORT') {
        try {
            sortAllConfiguredSheets();
            return ContentService.createTextOutput(
                JSON.stringify({ success: true, message: 'All sheets sorted chronologically' })
            ).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
            return ContentService.createTextOutput(
                JSON.stringify({ success: false, error: err.toString() })
            ).setMimeType(ContentService.MimeType.JSON);
        }
    }

    return ContentService.createTextOutput(
        JSON.stringify({ status: 'active', message: 'Master Calendar Server' })
    ).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// 3. iCAL EXPORT ENGINE (RFC 5545 COMPLIANT)
// ============================================================================
function generateMasterIcs(propertyId, targetChannel) {
    const propConfig = CONFIG.PROPERTIES[propertyId] || CONFIG.PROPERTIES.piyungan;
    const events = [];

    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${('0' + (now.getMonth() + 1)).slice(-2)}-01`;
    const isAirbnb = targetChannel === 'airbnb';

    // A. Fetch Confirmed Bookings from Active Property Sheets
    for (let i = 0; i < propConfig.sheets.length; i++) {
        const sheetObj = propConfig.sheets[i];
        const sheetId = sheetObj.id;
        if (!sheetId || sheetId.includes('YOUR_')) continue;

        try {
            const ss = SpreadsheetApp.openById(sheetId);
            const sheet = sheetObj.sheetName
                ? ss.getSheetByName(sheetObj.sheetName)
                : ss.getSheets()[0];
            const lastRow = sheet.getLastRow();
            if (lastRow <= 1) continue;

            const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

            for (let r = 0; r < data.length; r++) {
                const row = data[r];
                const bookingId = String(row[0] || '').trim();
                const listing = String(row[1] || 'Direct').trim();
                const checkIn = normalizeDateStr(row[3]);
                const checkOut = normalizeDateStr(row[4]);
                const status = String(row[8] || '')
                    .trim()
                    .toLowerCase();

                // Skip rows with missing dates or cancelled stays (Unavailable MUST be kept as opaque blocks)
                if (!checkIn || !checkOut || status === 'cancelled' || status === 'delete')
                    continue;
                if (checkOut < startOfMonth) continue;

                // Skip Airbnb's own bookings for Airbnb feeds to prevent collision
                if (
                    isAirbnb &&
                    (listing.toLowerCase().includes('airbnb') || bookingId.startsWith('HM'))
                ) {
                    continue;
                }

                const cleanUid = String(bookingId).replace(/[^a-zA-Z0-9]/g, '') || `row-${r + 2}`;

                events.push({
                    uid: `block-${cleanUid}@maihousejogja.com`,
                    checkIn,
                    checkOut,
                    summary: status === 'unavailable' ? 'Unavailable' : 'Reserved',
                });
            }
        } catch (err) {
            console.warn(`Could not read sheet ${sheetId}: ${err.toString()}`);
        }
    }

    // B. Fetch Pending Staged Bookings (Blocks calendar before approval)
    if (CONFIG.STAGING_SHEET_ID) {
        try {
            const stagingSs = SpreadsheetApp.openById(CONFIG.STAGING_SHEET_ID);
            const stagingSheet = stagingSs.getSheets()[0];
            const lastRow = stagingSheet.getLastRow();

            if (lastRow > 1) {
                const stagingData = stagingSheet.getRange(2, 1, lastRow - 1, 10).getValues();

                for (let r = 0; r < stagingData.length; r++) {
                    const row = stagingData[r];
                    const pId = String(row[1] || '')
                        .trim()
                        .toLowerCase();
                    const bookingId = String(row[2] || '')
                        .trim()
                        .replace(/^'+/, '');
                    const listing = String(row[3] || 'OTA').trim();
                    const checkIn = normalizeDateStr(row[5]);
                    const checkOut = normalizeDateStr(row[6]);
                    const status = String(row[9] || '').trim();

                    if (pId === propertyId && status === 'Pending Approval') {
                        if (!checkIn || !checkOut || checkOut < startOfMonth) continue;
                        if (
                            isAirbnb &&
                            (listing.toLowerCase().includes('airbnb') || bookingId.startsWith('HM'))
                        )
                            continue;

                        const cleanUid = String(bookingId).replace(/[^a-zA-Z0-9]/g, '');
                        events.push({
                            uid: `staged-${cleanUid}@maihousejogja.com`,
                            checkIn,
                            checkOut,
                            summary: 'Reserved',
                        });
                    }
                }
            }
        } catch (err) {
            console.warn(`Could not read staging sheet: ${err.toString()}`);
        }
    }

    // C. Build Anonymized RFC 5545 .ics Stream
    const nowUtc = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mai House Jogja//Availability Calendar 1.0//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${propConfig.name.replace(/[,;]/g, '')}`,
        'X-WR-TIMEZONE:Asia/Jakarta',
    ];

    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const startStr = e.checkIn.replace(/[^0-9]/g, '');
        const endStr = e.checkOut.replace(/[^0-9]/g, '');

        lines.push(
            'BEGIN:VEVENT',
            `UID:${e.uid}`,
            `DTSTAMP:${nowUtc}`,
            `DTSTART;VALUE=DATE:${startStr}`,
            `DTEND;VALUE=DATE:${endStr}`,
            `SUMMARY:${e.summary}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'END:VEVENT'
        );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
}

// ============================================================================
// 4. GMAIL SCRAPING & STAGING INGESTION
// ============================================================================
function processOtaEmails() {
    if (!CONFIG.STAGING_SHEET_ID) {
        console.warn('STAGING_SHEET_ID not configured in Script Properties.');
        return 0;
    }

    const stagingSs = SpreadsheetApp.openById(CONFIG.STAGING_SHEET_ID);
    const sheet = stagingSs.getSheets()[0];
    const existingIds = getExistingBookingIds(sheet);

    const ignoredSubjectsQuery = IGNORED_SUBJECT_PATTERNS.map(function (term) {
        return '-subject:"' + term + '"';
    }).join(' ');

    const query = [
        'in:inbox',
        '-label:Reservation',
        '(from:(booking.com OR airbnb.com OR tiket.com OR trip.com) OR subject:("New booking" OR "Reservation confirmed" OR "Itinerary ID" OR "Pemesanan baru"))',
        ignoredSubjectsQuery,
        'newer_than:' + CONFIG.SCRAPER_DAYS_LOOKBACK + 'd',
    ].join(' ');

    const threads = GmailApp.search(query, 0, 20);
    let stagedCount = 0;

    for (let i = 0; i < threads.length; i++) {
        const messages = threads[i].getMessages();
        for (let j = 0; j < messages.length; j++) {
            const msg = messages[j];
            const subject = msg.getSubject() || '';
            const snippet = (msg.getPlainBody() || '').slice(0, 160);

            if (isIgnoredEmail(subject, snippet)) continue;

            const from = msg.getFrom().toLowerCase();
            const body = msg.getPlainBody() || '';
            const htmlBody = msg.getBody() || '';
            const msgDate = msg.getDate();

            let booking = null;

            if (from.includes('airbnb') || /Reservation confirmed/i.test(subject)) {
                booking = parseAirbnbEmail(subject, body, htmlBody, msgDate);
            } else if (from.includes('tiket') || /Itinerary ID/i.test(subject)) {
                booking = parseTiketEmail(subject, body, htmlBody, msgDate);
            } else if (from.includes('trip.com') || /pemesanan/i.test(subject)) {
                booking = parseTripEmail(subject, body, htmlBody, msgDate);
            } else if (from.includes('booking.com') || /New booking/i.test(subject)) {
                booking = parseBookingDotComEmail(subject, body, htmlBody, msgDate);
            }

            if (booking && booking.bookingId && !existingIds.has(booking.bookingId)) {
                const stageId = 'STAGE-' + Utilities.getUuid().slice(0, 8);
                const calendarEventId = blockCalendarDates(booking);
                const safeBookingId = "'" + String(booking.bookingId).replace(/^'+/, '');

                sheet.appendRow([
                    stageId,
                    booking.propertyId || 'piyungan',
                    safeBookingId,
                    booking.listing,
                    booking.guestName,
                    booking.checkIn,
                    booking.checkOut,
                    Number(booking.nights) || 1,
                    Number(booking.payout) || 0,
                    'Pending Approval',
                    booking.notes || 'Imported from ' + booking.listing + ' confirmation email',
                    calendarEventId || '',
                ]);

                existingIds.add(booking.bookingId);
                stagedCount++;
                console.log(
                    `✅ Staged: ${booking.listing} [${booking.bookingId}] for ${booking.guestName} (${booking.checkIn} -> ${booking.checkOut})`
                );
            }
        }
    }

    // Run two-way manual mobile edit synchronization
    syncManualSheetBookingsToCalendar();

    console.log(`🎉 Ingestion completed. Staged ${stagedCount} new reservation(s).`);
    return stagedCount;
}

// ============================================================================
// 5. PARSERS (DYNAMIC YEAR RESOLUTION)
// ============================================================================

/**
 * Specifically tailored for Booking.com Lite Security Notification emails:
 * - Extracts Booking ID & Check-in date directly from subject line / extranet link
 * - Sets fallback checkout to +1 day so calendar is immediately blocked
 * - Sets guestName: 'Booking.com Guest' & payout: 0 for review in Vue/Pulse
 */
function parseBookingDotComEmail(subject, body, htmlBody, msgDate) {
    try {
        const rawSubject = subject || '';
        const rawBody = body || '';
        const rawHtml = htmlBody || '';
        const combined = (
            rawSubject +
            '\n' +
            rawBody +
            '\n' +
            rawHtml.replace(/<[^>]+>/g, ' ')
        ).replace(/[ \t]+/g, ' ');
        const emailYear =
            msgDate instanceof Date ? msgDate.getFullYear() : new Date().getFullYear();

        // 1. Extract Booking ID
        const idMatch =
            rawSubject.match(/\((\d{8,12})/i) ||
            combined.match(/res_id=(\d{8,12})/i) ||
            combined.match(/Booking confirmation\s*[—–-]\s*(\d{8,12})/i);
        if (!idMatch) return null;
        const bookingId = idMatch[1];

        // 2. Extract Check-in Date from Subject line (e.g. "Saturday, 26 December 2026")
        let checkIn = '';
        const subjectDateMatch =
            rawSubject.match(
                /,\s*([A-Za-z]+,?\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
            ) || rawSubject.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
        if (subjectDateMatch) {
            checkIn = parseDateToISO(subjectDateMatch[1], emailYear, msgDate);
        } else {
            const bodyDateMatch = combined.match(
                /(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
            );
            if (bodyDateMatch) checkIn = parseDateToISO(bodyDateMatch[1], emailYear, msgDate);
        }
        if (!checkIn) return null;

        // 3. Set temporary +1 day checkout so dates can be safely locked on Google Calendar
        const d = new Date(checkIn);
        d.setDate(d.getDate() + 1);
        const checkOut = normalizeDateStr(d);

        const propertyId = resolvePropertyId(combined);

        return {
            propertyId,
            bookingId,
            listing: 'Booking.com',
            guestName: 'Booking.com Guest',
            checkIn,
            checkOut,
            nights: 1,
            payout: 0,
            notes: 'Lite Alert - Check Pulse/Extranet for Name & Price',
        };
    } catch (err) {
        return null;
    }
}

function parseTiketEmail(subject, body, htmlBody, msgDate) {
    try {
        const rawHtml = htmlBody || '';
        const textFromHtml = rawHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
        const combined = (subject + '\n' + body + '\n' + textFromHtml).replace(/[ \t]+/g, ' ');
        const emailYear =
            msgDate instanceof Date ? msgDate.getFullYear() : new Date().getFullYear();

        const idMatch =
            subject.match(/Itinerary ID\s*(\d{7,12})/i) ||
            combined.match(/Itinerary ID:?\s*(\d{7,12})/i);
        if (!idMatch) return null;
        const bookingId = idMatch[1];

        const dateMatches = combined.match(
            /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Sen|Sel|Rab|Kam|Jum|Sab|Min),?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Za-z]{3,9},?\s*\d{4})\b/gi
        );

        let checkIn = '';
        let checkOut = '';

        if (dateMatches && dateMatches.length >= 2) {
            checkIn = parseDateToISO(dateMatches[0], emailYear, msgDate);
            checkOut = parseDateToISO(dateMatches[1], emailYear, msgDate);
        } else {
            const inMatch = combined.match(
                /Check-in[\s\S]{0,80}?([A-Za-z]{3,9}\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Za-z]{3,9},?\s*\d{4})/i
            );
            const outMatch = combined.match(
                /Check-out[\s\S]{0,80}?([A-Za-z]{3,9}\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Za-z]{3,9},?\s*\d{4})/i
            );
            if (inMatch) checkIn = parseDateToISO(inMatch[1], emailYear, msgDate);
            if (outMatch) checkOut = parseDateToISO(outMatch[1], emailYear, msgDate);
        }

        if (!checkIn || !checkOut) return null;

        let guestName = 'Tiket.com Guest';
        const guestMatch =
            combined.match(
                /Guest Name[\s:]*(?:<br>|\n|\s)*(?:\d+\.\s*)?([A-Za-z\s]+?)(?=\s*(?:Room|Tipe|Meal|Policy|1\s*Room|$))/i
            ) || combined.match(/(?:1\.\s*)([A-Za-z\s]{3,40}?)(?=\s*(?:Room|Meal|Policy|$))/i);
        if (guestMatch && guestMatch[1]) {
            guestName = guestMatch[1].replace(/^\d+\.\s*/, '').trim();
        }

        let payout = 0;
        const payoutMatch = combined.match(
            /(?:Total Payout|Total Pembayaran|Tarif Kamar)[\s:]*(?:IDR|Rp)?\s*([0-9.,]+)/i
        );
        if (payoutMatch) payout = parseCurrencyNumber(payoutMatch[1]);

        const propertyId = resolvePropertyId(combined);

        return {
            propertyId,
            bookingId,
            listing: 'Tiket.com',
            guestName,
            checkIn,
            checkOut,
            nights: calculateNights(checkIn, checkOut),
            payout,
            notes:
                payout === 0
                    ? 'Tiket: Check attached voucher for payout'
                    : 'Imported from Tiket.com Email',
        };
    } catch (e) {
        return null;
    }
}

function parseAirbnbEmail(subject, body, htmlBody, msgDate) {
    try {
        const rawHtml = htmlBody || '';
        const textFromHtml = rawHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
        const combined = (subject + '\n' + body + '\n' + textFromHtml).replace(/[ \t]+/g, ' ');

        let bookingId = '';
        const codeMatch =
            combined.match(/Confirmation code[\s:]+([A-Z0-9]{8,12})/i) ||
            combined.match(/\b(HM[A-Z0-9]{8})\b/i) ||
            subject.match(/\b(HM[A-Z0-9]{8})\b/i);
        if (codeMatch) bookingId = codeMatch[1].toUpperCase();
        if (!bookingId) return null;

        const emailYear =
            msgDate instanceof Date ? msgDate.getFullYear() : new Date().getFullYear();

        let guestName = 'Airbnb Guest';
        const subGuestMatch = subject.match(
            /Reservation confirmed\s*-\s*([A-Za-z\s]+?)\s+arrives/i
        );
        if (subGuestMatch) {
            guestName = subGuestMatch[1].trim();
        } else {
            const bodyGuest =
                combined.match(/New booking confirmed!\s*([A-Za-z\s]+?)\s+arrives/i) ||
                combined.match(/([A-Za-z\s]+)\s+Identity verified/i);
            if (bodyGuest) guestName = bodyGuest[1].trim();
        }

        // Matches with or without 4-digit year
        const dateMatches = combined.match(
            /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Sen|Sel|Rab|Kam|Jum|Sab|Min),?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:,?\s*\d{4})?)\b/gi
        );

        let checkIn = '';
        let checkOut = '';

        if (dateMatches && dateMatches.length >= 2) {
            checkIn = parseDateToISO(dateMatches[0], emailYear, msgDate);
            checkOut = parseDateToISO(dateMatches[1], emailYear, msgDate);
        } else {
            const inBlock = combined.match(
                /Check-in[\s\S]{0,60}?([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:,?\s*\d{4})?)\b/i
            );
            const outBlock = combined.match(
                /Checkout[\s\S]{0,60}?([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:,?\s*\d{4})?)\b/i
            );
            if (inBlock) checkIn = parseDateToISO(inBlock[1], emailYear, msgDate);
            if (outBlock) checkOut = parseDateToISO(outBlock[1], emailYear, msgDate);
        }

        if (!checkIn || !checkOut) return null;

        let payout = 0;
        const earnMatch =
            combined.match(/You earn[\s:]*(?:Rp|IDR)?\s*([0-9.,]+)/i) ||
            combined.match(/Total payout[\s:]*(?:Rp|IDR)?\s*([0-9.,]+)/i);
        if (earnMatch) payout = parseCurrencyNumber(earnMatch[1]);

        const propertyId = resolvePropertyId(combined);

        return {
            propertyId,
            bookingId,
            listing: 'Airbnb',
            guestName,
            checkIn,
            checkOut,
            nights: calculateNights(checkIn, checkOut),
            payout,
            notes: 'Imported from Airbnb Email',
        };
    } catch (e) {
        return null;
    }
}

function parseTripEmail(subject, body, htmlBody, msgDate) {
    try {
        const rawHtml = htmlBody || '';
        const textFromHtml = rawHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
        const combined = (subject + '\n' + body + '\n' + textFromHtml).replace(/[ \t]+/g, ' ');
        const emailYear =
            msgDate instanceof Date ? msgDate.getFullYear() : new Date().getFullYear();

        let bookingId = '';
        const idMatch =
            subject.match(/#(\d{14,18})#/i) ||
            combined.match(/Reservation\s*no\.?\s*(\d{14,18})/i) ||
            subject.match(/(\d{14,18})/);
        if (idMatch) bookingId = idMatch[1] || idMatch[0];
        if (!bookingId) return null;

        let checkIn = '';
        let checkOut = '';

        const periodMatch = combined.match(
            /(?:Staying period|Stay dates|Periode menginap)[\s:]*([A-Za-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*(?:–|-|to)\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
        );

        if (periodMatch) {
            checkIn = parseDateToISO(periodMatch[1], emailYear, msgDate);
            checkOut = parseDateToISO(periodMatch[2], emailYear, msgDate);
        }

        if (!checkIn || !checkOut) return null;

        let guestName = 'Trip.com Guest';
        const guestMatch = combined.match(
            /(?:Guest Name|Nama Tamu)[\s:]*([A-Za-z/.\s]+?)(?=\s*(?:Room Type|Tipe Kamar|Bed type|Staying period|Periode|\n|\r|<|$))/i
        );

        if (guestMatch && guestMatch[1]) {
            let rawName = guestMatch[1].replace(/\b(Mr|Mrs|Ms|Mstr|Tuan|Nyonya)\b\.?/gi, '').trim();
            if (rawName.includes('/')) rawName = rawName.replace(/\//g, ' ').trim();
            guestName = rawName
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase())
                .trim();
        }

        let payout = 0;
        const rateMatch =
            combined.match(/Your\s*payout[^0-9\n\r]*([0-9.,]+)/i) ||
            combined.match(/Final room rate[^0-9\n\r]*([0-9.,]+)/i);
        if (rateMatch) payout = parseCurrencyNumber(rateMatch[1]);

        const propertyId = resolvePropertyId(combined);

        return {
            propertyId,
            bookingId,
            listing: 'Trip.com',
            guestName,
            checkIn,
            checkOut,
            nights: calculateNights(checkIn, checkOut),
            payout,
            notes: 'Imported from Trip.com Email',
        };
    } catch (err) {
        return null;
    }
}

// ============================================================================
// 6. TWO-WAY GOOGLE CALENDAR, SHEET SYNC & CHRONOLOGICAL SORT
// ============================================================================
function blockCalendarDates(booking) {
    try {
        const propConfig = CONFIG.PROPERTIES[booking.propertyId] || CONFIG.PROPERTIES.piyungan;
        const cal =
            CalendarApp.getCalendarById(propConfig.calendarId) || CalendarApp.getDefaultCalendar();
        if (!cal) return '';

        const start = parseSheetDate(booking.checkIn);
        let end = parseSheetDate(booking.checkOut);
        if (!start || !end) return '';

        if (start.getTime() === end.getTime()) {
            end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        }

        const title = `[PENDING] ${booking.listing} - ${booking.guestName}`;
        const event = cal.createAllDayEvent(title, start, end, {
            description: `Pending review in Staging Inbox. Booking ID: ${booking.bookingId}`,
        });

        let rawId = event.getId();
        if (rawId.includes('@')) rawId = rawId.split('@')[0];
        if (rawId.includes(':')) rawId = rawId.split(':')[0];
        return rawId;
    } catch (err) {
        return '';
    }
}

/**
 * Sorts a property booking sheet chronologically:
 * Primary Sort: Column D (Check-in, 4) Ascending (Jan -> Dec, Day 1 -> 31)
 * Secondary Sort: Column E (Check-out, 5) Ascending
 */
function sortPropertySheet(sheet) {
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) return;

    const lastCol = Math.max(sheet.getLastColumn(), 12);
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);

    dataRange.sort([
        { column: 4, ascending: true }, // Col D: Check-in (Jan -> Dec)
        { column: 5, ascending: true }, // Col E: Check-out
    ]);

    console.log(`Sorted "${sheet.getName()}" chronologically by check-in date.`);
}

/**
 * Utility to sort all configured property sheets on demand
 */
function sortAllConfiguredSheets() {
    Object.keys(CONFIG.PROPERTIES).forEach(function (propKey) {
        const prop = CONFIG.PROPERTIES[propKey];
        if (!prop.sheets || !prop.sheets.length) return;

        prop.sheets.forEach(function (sheetObj) {
            if (!sheetObj.id) return;
            try {
                const ss = SpreadsheetApp.openById(sheetObj.id);
                const sheet = sheetObj.sheetName
                    ? ss.getSheetByName(sheetObj.sheetName)
                    : ss.getSheets()[0];
                if (sheet) sortPropertySheet(sheet);
            } catch (err) {
                console.warn(`Could not sort sheet ${sheetObj.id}: ${err.toString()}`);
            }
        });
    });
}

function syncManualSheetBookingsToCalendar() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.keys(CONFIG.PROPERTIES).forEach(function (propKey) {
        const prop = CONFIG.PROPERTIES[propKey];
        if (!prop.sheets || !prop.sheets.length || !prop.calendarId) return;

        prop.sheets.forEach(function (sheetObj) {
            const sheetId = sheetObj.id;
            if (!sheetId || sheetId.includes('YOUR_')) return;

            try {
                const ss = SpreadsheetApp.openById(sheetId);
                const sheet = sheetObj.sheetName
                    ? ss.getSheetByName(sheetObj.sheetName)
                    : ss.getSheets()[0];
                const calendar = CalendarApp.getCalendarById(prop.calendarId);

                if (!sheet || !calendar) return;

                const lastRow = sheet.getLastRow();
                if (lastRow < 2) return;

                // Read Columns A through L (1 to 12)
                const dataRange = sheet.getRange(2, 1, lastRow - 1, 12);
                const values = dataRange.getValues();

                for (let i = values.length - 1; i >= 0; i--) {
                    const row = values[i];
                    const rowNumber = i + 2;

                    let bookingId = String(row[0] || '').trim();
                    const listing = String(row[1] || 'Direct').trim();
                    const guestName = String(row[2] || 'Guest').trim();
                    const checkInRaw = row[3];
                    const checkOutRaw = row[4];
                    const status = String(row[8] || '')
                        .trim()
                        .toLowerCase();
                    let payout = Number(row[6]) || 0;
                    let notes = String(row[9] || '').trim();
                    const calEventId = String(row[10] || '').trim();

                    let doorCode = String(row[11] || '')
                        .trim()
                        .replace(/^'+/, '');

                    // If Booking.com payout was entered as gross without deduction in Google Sheets
                    if (
                        listing.toLowerCase() === 'booking.com' &&
                        payout > 0 &&
                        !notes.includes('[-19.2% BDC]')
                    ) {
                        const commissionPct = CONFIG.BOOKING_COM_COMMISSION_PCT || 19.2;
                        const netAmount = Math.round(payout * (1 - commissionPct / 100));
                        const formattedGross =
                            'Rp ' + String(payout).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

                        notes =
                            `[Gross: ${formattedGross} | -${commissionPct}% BDC] ${notes}`.trim();

                        // Overwrite Column G (Payout, 7) with Net, and Column J (Notes, 10) with audit note
                        sheet.getRange(rowNumber, 7).setValue(netAmount);
                        sheet.getRange(rowNumber, 10).setValue(notes);
                        payout = netAmount;
                    }

                    // Backfill doorCode if empty or containing letters (Col 12)
                    if ((!doorCode || /\D/.test(doorCode)) && status !== 'unavailable') {
                        const digits = String(bookingId).replace(/\D/g, '');
                        if (digits.length >= 4) {
                            doorCode = digits.slice(-4);
                        } else {
                            let hash = 0;
                            const seed = String(bookingId) + '_' + String(checkInRaw);
                            for (let s = 0; s < seed.length; s++) {
                                hash = (hash << 5) - hash + seed.charCodeAt(s);
                                hash |= 0;
                            }
                            doorCode = String((Math.abs(hash) % 9000) + 1000);
                        }
                        sheet.getRange(rowNumber, 12).setValue("'" + doorCode);
                    }

                    // Case 1: Cancelled
                    if (status === 'cancelled' || status === 'delete') {
                        if (calEventId) {
                            try {
                                const cleanId = calEventId.split('@')[0];
                                const existingEvent =
                                    calendar.getEventById(cleanId) ||
                                    calendar.getEventById(calEventId);
                                if (existingEvent) existingEvent.deleteEvent();
                            } catch (e) {
                                console.warn('Could not delete calendar event:', e);
                            }
                        }
                        sheet.deleteRow(rowNumber);
                        console.log(`Cancelled & deleted row ${rowNumber} (${guestName})`);
                        continue;
                    }

                    const startDate = parseSheetDate(checkInRaw);
                    let endDate = parseSheetDate(checkOutRaw);
                    if (!startDate || !endDate) continue;

                    if (startDate.getTime() === endDate.getTime()) {
                        endDate = new Date(
                            startDate.getFullYear(),
                            startDate.getMonth(),
                            startDate.getDate() + 1
                        );
                    }

                    // Case 2: New Row (Auto-fill ID and create Calendar Event)
                    if (!bookingId) {
                        const isBlocked =
                            status === 'unavailable' || listing.toLowerCase() === 'unavailable';
                        const inStr = Utilities.formatDate(startDate, 'GMT+0700', 'yyyy-MM-dd');
                        const outStr = Utilities.formatDate(endDate, 'GMT+0700', 'yyyy-MM-dd');

                        bookingId = isBlocked
                            ? 'UNAVAILABLE-' + inStr + '_' + outStr
                            : 'DIRECT-' + inStr + '_' + outStr;

                        sheet.getRange(rowNumber, 1).setValue(bookingId);
                    }

                    const isBlocked =
                        status === 'unavailable' || listing.toLowerCase() === 'unavailable';
                    const summary = isBlocked
                        ? notes || 'Unavailable'
                        : listing + ' - ' + guestName;
                    const desc = isBlocked
                        ? 'Unit blocked for maintenance / private use.\nRef: ' + bookingId
                        : 'Reservation for ' +
                          guestName +
                          ' via ' +
                          listing +
                          '.\nRef: ' +
                          bookingId;

                    if (!calEventId && status !== 'cancelled') {
                        const newEvent = calendar.createAllDayEvent(summary, startDate, endDate, {
                            description: desc,
                        });

                        const newCalId = newEvent.getId().split('@')[0];
                        sheet.getRange(rowNumber, 11).setValue(newCalId);
                        values[i][10] = newCalId; // Update in-memory so sort check knows it is generated!
                        console.log(`Created calendar event for ${guestName} on row ${rowNumber}`);
                        continue;
                    }

                    // Case 3: Existing Row Update Check
                    if (calEventId && endDate >= today) {
                        try {
                            const targetEventId = calEventId.split('@')[0];
                            const event =
                                calendar.getEventById(targetEventId) ||
                                calendar.getEventById(calEventId);

                            if (event) {
                                const currentStart = event.getAllDayStartDate();
                                const currentEnd = event.getAllDayEndDate();
                                const datesChanged =
                                    !isSameDay(currentStart, startDate) ||
                                    !isSameDay(currentEnd, endDate);
                                const titleChanged = event.getTitle() !== summary;

                                if (datesChanged || titleChanged) {
                                    if (datesChanged) event.setAllDayDates(startDate, endDate);
                                    event.setTitle(summary);
                                    event.setDescription(desc);
                                    console.log(
                                        `Updated calendar event on row ${rowNumber} (${guestName})`
                                    );
                                }
                            } else {
                                const recreated = calendar.createAllDayEvent(
                                    summary,
                                    startDate,
                                    endDate,
                                    {
                                        description: desc,
                                    }
                                );
                                const recreatedId = recreated.getId().split('@')[0];
                                sheet.getRange(rowNumber, 11).setValue(recreatedId);
                                console.log(`Recreated missing event for row ${rowNumber}`);
                            }
                        } catch (err) {
                            console.warn(`Error updating event on row ${rowNumber}:`, err);
                        }
                    }
                }

                // ==================================================================
                // CASE 4: CHRONOLOGICAL RESORT (Runs once outside the row loop)
                // ==================================================================
                const allCalendarEventsGenerated = values.every(function (r) {
                    const st = String(r[8] || '')
                        .trim()
                        .toLowerCase();
                    if (st === 'cancelled' || st === 'delete') return true;
                    const hasDates = r[3] && r[4];
                    if (!hasDates) return true; // Skip blank rows
                    const cId = String(r[10] || '').trim();
                    return cId.length > 0;
                });

                if (allCalendarEventsGenerated) {
                    sortPropertySheet(sheet);
                } else {
                    console.log(
                        `Skipped sorting "${sheet.getName()}": pending calendarEventId generation.`
                    );
                }
            } catch (err) {
                console.error(`Error syncing sheet ${sheetObj.id}:`, err);
            }
        });
    });
}

// ============================================================================
// 7. UTILITIES
// ============================================================================
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Mai House Jogja')
        .addItem('Sort Bookings Chronologically', 'sortAllConfiguredSheets')
        .addItem('Sync Calendar & Door Codes', 'syncManualSheetBookingsToCalendar')
        .addToUi();
}

function archiveEmailByBookingId(bookingId, labelName) {
    try {
        const cleanId = String(bookingId).replace(/^'+/, '').trim();
        if (!cleanId) return false;

        const threads = GmailApp.search(cleanId, 0, 3);
        if (threads.length === 0) return false;

        const label = GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
        for (let i = 0; i < threads.length; i++) {
            threads[i].addLabel(label);
            threads[i].moveToArchive();
        }
        return true;
    } catch (err) {
        return false;
    }
}

function resolvePropertyId(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('wonosari')) return 'wonosari';
    if (t.includes('banguntapan')) return 'banguntapan';
    if (t.includes('nusa dua') || t.includes('bali')) return 'nusadua';
    return 'piyungan';
}

function parseDateToISO(raw, fallbackYear, referenceDate) {
    if (!raw) return '';

    const refDate = referenceDate instanceof Date ? referenceDate : new Date();
    const defYear = Number(fallbackYear) || refDate.getFullYear();

    const months = {
        jan: '01',
        january: '01',
        januari: '01',
        feb: '02',
        february: '02',
        februari: '02',
        mar: '03',
        march: '03',
        maret: '03',
        apr: '04',
        april: '04',
        may: '05',
        mei: '05',
        jun: '06',
        june: '06',
        juni: '06',
        jul: '07',
        july: '07',
        juli: '07',
        aug: '08',
        august: '08',
        agustus: '08',
        agt: '08',
        agu: '08',
        sep: '09',
        september: '09',
        oct: '10',
        october: '10',
        oktober: '10',
        okt: '10',
        nov: '11',
        november: '11',
        nop: '11',
        dec: '12',
        december: '12',
        desember: '12',
        des: '12',
    };

    const clean = String(raw)
        .replace(
            /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Sen|Sel|Rab|Kam|Jum|Sab|Min|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)[,\s]*/i,
            ''
        )
        .replace(/,/g, ' ')
        .trim();

    const parts = clean.split(/\s+/);

    if (parts.length >= 2) {
        let day = parts[0];
        let month = parts[1];
        const hasExplicitYear = parts[2] && /^\d{4}$/.test(parts[2]);
        let year = hasExplicitYear ? Number(parts[2]) : defYear;

        if (isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
            month = parts[0];
            day = parts[1];
        }

        const mm = months[month.toLowerCase()] || '01';
        const dd = ('0' + day).slice(-2);

        // Rollover fallback if year was missing and stay month is earlier than email month
        if (!hasExplicitYear) {
            const emailMonth = refDate.getMonth() + 1;
            const stayMonth = Number(mm);
            if (stayMonth < emailMonth) {
                year = refDate.getFullYear() + 1;
            }
        }

        return `${year}-${mm}-${dd}`;
    }
    return '';
}

function parseCurrencyNumber(str) {
    if (!str) return 0;
    let clean = str.replace(/[^\d.,]/g, '').trim();
    if (/\.\d{2}$/.test(clean)) clean = clean.slice(0, -3);
    clean = clean.replace(/[,.]/g, '');
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
}

function normalizeDateStr(raw) {
    if (!raw) return '';
    if (raw instanceof Date && !isNaN(raw.getTime())) {
        const y = raw.getFullYear();
        const m = ('0' + (raw.getMonth() + 1)).slice(-2);
        const d = ('0' + raw.getDate()).slice(-2);
        return `${y}-${m}-${d}`;
    }
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    return parseDateToISO(str);
}

function parseSheetDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
        return new Date(val.getFullYear(), val.getMonth(), val.getDate());
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const parts = str.slice(0, 10).split('-');
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
    return null;
}

function isSameDay(d1, d2) {
    if (!d1 || !d2) return false;
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

function calculateNights(checkIn, checkOut) {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
}

function getExistingBookingIds(sheet) {
    const ids = new Set();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        const bId = String(data[i][2] || '')
            .trim()
            .replace(/^'+/, '');
        if (bId) ids.add(bId);
    }
    return ids;
}

function install5MinuteTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((t) => {
        if (t.getHandlerFunction() === 'processOtaEmails') ScriptApp.deleteTrigger(t);
    });

    ScriptApp.newTrigger('processOtaEmails').timeBased().everyMinutes(5).create();

    console.log('✅ Master 5-minute trigger installed.');
}
