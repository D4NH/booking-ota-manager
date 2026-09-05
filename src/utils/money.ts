const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

/**
 * Formats a number to Indonesian Rupiah (e.g., 7460057 -> "Rp 7.460.057")
 */
export function formatIDR(value: number): string {
    // \u00A0 is the non-breaking space Intl outputs between "Rp" and the digits;
    // replacing it with standard space ensures consistent CSS font rendering.
    return rupiahFormatter.format(value).replace(/\u00A0/, ' ');
}

/**
 * Formats numbers specifically for compact chart axes and labels.
 * Examples:
 *   0          -> "0"
 *   500_000    -> "500rb"
 *   1_000_000  -> "1jt"
 *   1_500_000  -> "1.5jt"
 *   10_000_000 -> "10jt"
 */
export function formatChartCurrency(value: number): string {
    if (value === 0) return '0';

    // Millions (Juta)
    if (Math.abs(value) >= 1_000_000) {
        const formatted = (value / 1_000_000).toFixed(1);
        // Replace .0 with nothing (e.g. "10.0" -> "10")
        return `${formatted.replace(/\.0$/, '')}jt`;
    }

    // Thousands (Ribu)
    if (Math.abs(value) >= 1_000) {
        const formatted = (value / 1_000).toFixed(1);
        return `${formatted.replace(/\.0$/, '')}rb`;
    }

    return value.toString();
}
