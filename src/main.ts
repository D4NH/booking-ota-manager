import './assets/styles/vendor.css';
import './assets/styles/main.scss';

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
    faDownload,
    faFilter,
    faGear,
    faHashtag,
    faHouse,
    faHouseCircleCheck,
    faHouseUser,
    faIdCard,
    faKey,
    faListCheck,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faPenToSquare,
    faPersonDigging,
    faPlus,
    faReceipt,
    faRulerCombined,
    faRupiahSign,
    faSackDollar,
    faShower,
    faSpinner,
    faTableCellsLarge,
    faTrashCan,
    faTriangleExclamation,
    faUpload,
    faWifi,
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
    faDownload,
    faFilter,
    faGear,
    faHashtag,
    faHouse,
    faHouseCircleCheck,
    faHouseUser,
    faIdCard,
    faKey,
    faListCheck,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faPenToSquare,
    faPersonDigging,
    faPlus,
    faReceipt,
    faRulerCombined,
    faRupiahSign,
    faSackDollar,
    faShower,
    faSpinner,
    faTableCellsLarge,
    faTrashCan,
    faTriangleExclamation,
    faUpload,
    faWifi,
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
        closeOnClick: true,
        duration: 2500,
    })
);

await router.isReady();
app.mount('#app');
