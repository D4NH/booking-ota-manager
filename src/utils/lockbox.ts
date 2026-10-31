export function generateDoorCode(bookingId?: string, checkIn?: string): string {
    const rawId = String(bookingId || '')
        .trim()
        .replace(/^'+/, '');

    const trailingDigitsMatch = rawId.match(/\d{4}$/);
    if (trailingDigitsMatch) {
        return trailingDigitsMatch[0];
    }

    if (rawId) {
        const seedStr = `${rawId}_${checkIn || ''}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const pin = (Math.abs(hash) % 9000) + 1000;
        return String(pin);
    }

    return String(Math.floor(1000 + Math.random() * 9000));
}
