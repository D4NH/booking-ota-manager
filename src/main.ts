import './assets/styles/main.scss';
import './assets/styles/vendor.css';

import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import OpenVue from 'openvue/config';
import Aura from '@openvue/themes/aura';

import App from './App.vue';
import router from './router';

import {
    faMapMarkerAlt,
    faCalendarDay,
    faArrowsRotate,
    faPenToSquare,
    faChevronLeft,
    faChevronRight,
    faAngleDown,
    faTrashCan,
    faPlus,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';

library.add(
    faMapMarkerAlt,
    faCalendarDay,
    faArrowsRotate,
    faPenToSquare,
    faChevronLeft,
    faChevronRight,
    faTrashCan,
    faAngleDown,
    faPlus,
    faXmark
);

const app = createApp(App);
const head = createHead();

app.component('FaIcon', FontAwesomeIcon);

app.use(createPinia());
app.use(router);
app.use(head);
app.use(OpenVue, {
    theme: {
        preset: Aura,
    },
});

await router.isReady();
app.mount('#app');
