/** @type {import('tailwindcss').Config} */

import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
    content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Noto Sans Variable"', '"Noto Sans"', ...fontFamily.sans],
            },
        },
    },
    plugins: [],
};
