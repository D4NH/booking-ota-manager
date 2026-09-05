import './assets/styles/main.scss';
import './assets/styles/vendor.css';

import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import App from './App.vue';
import router from './router';

import {
    faMapMarkerAlt,
    faCalendarDays,
    faArrowsRotate,
    faPenToSquare,
    faChevronLeft,
    faChevronRight,
    faAngleDown,
    faTrashCan,
    faPlus,
    faXmark,
    faFilter,
    faBell,
    faBed,
    faShower,
    faHouse,
    faRulerCombined,
    faMagnifyingGlass,
    faHashtag,
    faIdCard,
    faRupiahSign,
} from '@fortawesome/free-solid-svg-icons';

library.add(
    faMapMarkerAlt,
    faCalendarDays,
    faArrowsRotate,
    faPenToSquare,
    faChevronLeft,
    faChevronRight,
    faTrashCan,
    faAngleDown,
    faPlus,
    faXmark,
    faFilter,
    faBell,
    faBed,
    faShower,
    faHouse,
    faRulerCombined,
    faMagnifyingGlass,
    faHashtag,
    faIdCard,
    faRupiahSign
);

const app = createApp(App);
const head = createHead();

app.component('FaIcon', FontAwesomeIcon);

app.use(createPinia());
app.use(router);
app.use(head);

await router.isReady();
app.mount('#app');
