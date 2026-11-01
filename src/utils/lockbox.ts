export function generateDoorCode(bookingId?: string, checkIn?: string): string {
    const rawId = String(bookingId || '')
        .trim()
        .replace(/^'+/, '');

    const digitsOnly = rawId.replace(/\D/g, '');
    if (digitsOnly.length >= 4) {
        return digitsOnly.slice(-4);
    }

    if (rawId) {
        const seed = `${rawId}_${checkIn || ''}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
            hash |= 0;
        }
        const pin = (Math.abs(hash) % 9000) + 1000;
        return String(pin);
    }

    return String(Math.floor(1000 + Math.random() * 9000));
}

export function sanitizeDoorCode(
    existingCode: unknown,
    bookingId?: string,
    checkIn?: string
): string {
    const raw = String(existingCode ?? '')
        .trim()
        .replace(/^'+/, '');

    if (raw.length > 0 && /^\d+$/.test(raw)) {
        if (raw.length <= 4) {
            return raw.padStart(4, '0');
        }
        return raw.slice(-4);
    }

    return generateDoorCode(bookingId, checkIn);
}
