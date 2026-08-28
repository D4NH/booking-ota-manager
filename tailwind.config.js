/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                mist: {
                    950: '#0a0e14', // Page background
                    900: '#121820', // Card background
                    800: '#1e2632', // Borders
                    400: '#8b9bb0', // Subtitles / Muted text
                    100: '#e6edf8', // Headings
                },
            },
        },
    },
    plugins: [],
};
