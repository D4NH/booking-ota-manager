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
            meta: { isOverview: true },
            component: () => import('@/views/PropertiesView.vue'),
            children: [
                {
                    path: ':id',
                    name: 'property-detail',
                    meta: { isOverview: false },
                    component: () => import('@/views/PropertyDetailView.vue'),
                    props: true,
                },
            ],
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
            path: '/settings',
            name: 'settings',
            component: () => import('../views/SettingsView.vue'),
        },
    ],
});

export default router;
