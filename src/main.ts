import './assets/styles/main.scss';
import './assets/styles/vendor.css';

import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { createToastflow } from 'vue-toastflow';

import App from './App.vue';
import router from './router';

import {
    faAngleDown,
    faArrowLeft,
    faArrowsRotate,
    faArrowUpRightFromSquare,
    faBath,
    faBed,
    faBell,
    faBookmark,
    faCalendarCheck,
    faCalendarDays,
    faChartPie,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faCircleCheck,
    faCircleInfo,
    faClipboardCheck,
    faCoins,
    faCommentDots,
    faCopyright,
    faFilter,
    faHashtag,
    faHouse,
    faHouseCircleCheck,
    faHouseUser,
    faIdCard,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faPenToSquare,
    faPersonDigging,
    faPlus,
    faReceipt,
    faRulerCombined,
    faRupiahSign,
    faShower,
    faSpinner,
    faTableCellsLarge,
    faTrashCan,
    faTriangleExclamation,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';

library.add(
    faAngleDown,
    faArrowLeft,
    faArrowsRotate,
    faArrowUpRightFromSquare,
    faBath,
    faBed,
    faBell,
    faBookmark,
    faCalendarCheck,
    faCalendarDays,
    faChartPie,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faCircleCheck,
    faCircleInfo,
    faClipboardCheck,
    faCoins,
    faCommentDots,
    faCopyright,
    faFilter,
    faHashtag,
    faHouse,
    faHouseCircleCheck,
    faHouseUser,
    faIdCard,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faPenToSquare,
    faPersonDigging,
    faPlus,
    faReceipt,
    faRulerCombined,
    faRupiahSign,
    faShower,
    faSpinner,
    faTableCellsLarge,
    faTrashCan,
    faTriangleExclamation,
    faXmark
);

const app = createApp(App);
const head = createHead();

app.use(createPinia());
app.use(router);
app.use(head);

app.component('FaIcon', FontAwesomeIcon);
app.use(
    createToastflow({
        closeButton: false,
        pauseOnHover: false,
    })
);

await router.isReady();
app.mount('#app');
