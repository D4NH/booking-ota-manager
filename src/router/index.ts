import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/DashboardView.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/properties',
            name: 'properties',
            component: () => import('@/views/PropertiesView.vue'),
        },
        {
            path: '/properties/:id',
            name: 'property-detail',
            component: () => import('@/views/PropertyDetailView.vue'),
            props: true,
        },
        {
            path: '/calendar',
            name: 'calendar',
            component: () => import('../views/CalendarView.vue'),
        },
        {
            path: '/bookings',
            name: 'bookings',
            component: () => import('../views/BookingsView.vue'),
        },
        {
            path: '/finance',
            name: 'finance',
            component: () => import('../views/FinanceView.vue'),
        },
        {
            path: '/finance/personal',
            name: 'finance-personal',
            component: () => import('@/views/FinancePersonalView.vue'),
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('../views/SettingsView.vue'),
        },
    ],
    scrollBehavior() {
        return { top: 0 };
    },
});

export default router;
