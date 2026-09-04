export const formatIDR = (val: number): string => {
    return `Rp ${val.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};
