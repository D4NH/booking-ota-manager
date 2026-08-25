import './assets/styles/main.scss';
import './assets/styles/vendor.css';

import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

// import {
//     faGithub,
//     faInstagram,
//     faGithubSquare
// } from '@fortawesome/free-brands-svg-icons';
import {
    faMapMarkerAlt,
    faCalendarDay,
    faArrowsRotate,
    faPenToSquare,
    faChevronLeft,
} from '@fortawesome/free-solid-svg-icons';
// import { faCalendar, faFilePdf } from '@fortawesome/free-regular-svg-icons';

library.add(faMapMarkerAlt, faCalendarDay, faArrowsRotate, faPenToSquare, faChevronLeft);

const app = createApp(App);
const head = createHead();

app.component('FaIcon', FontAwesomeIcon);

app.use(createPinia());
app.use(router);
app.use(head);

await router.isReady();
app.mount('#app');
