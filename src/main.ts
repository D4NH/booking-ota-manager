import './assets/styles/vendor.css';
import './assets/styles/main.scss';

import { createApp, h } from 'vue';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { createToastflow } from 'vue-toastflow';

import App from './App.vue';
import router from './router';

import {
    faAngleDown,
    faArrowDown,
    faArrowLeft,
    faArrowRight,
    faArrowRightArrowLeft,
    faArrowRightToBracket,
    faArrowsRotate,
    faArrowTrendDown,
    faArrowTrendUp,
    faArrowUp,
    faArrowUp19,
    faArrowUpRightFromSquare,
    faBath,
    faBed,
    faBell,
    faBookmark,
    faBoxArchive,
    faBuilding,
    faBullseye,
    faCalendarCheck,
    faCalendarDays,
    faChartPie,
    faCheck,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faChevronUp,
    faCircleCheck,
    faCircleInfo,
    faClipboardCheck,
    faCoins,
    faCommentDots,
    faCopyright,
    faDownload,
    faFilter,
    faGear,
    faHardDrive,
    faHashtag,
    faHouse,
    faHouseCircleCheck,
    faHouseUser,
    faIdCard,
    faInbox,
    faKey,
    faListCheck,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faMoneyBillTransfer,
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
    faUser,
    faUsers,
    faWallet,
    faWeightHanging,
    faWifi,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';

library.add(
    faAngleDown,
    faArrowDown,
    faArrowLeft,
    faArrowRight,
    faArrowRightArrowLeft,
    faArrowRightToBracket,
    faArrowTrendDown,
    faArrowTrendUp,
    faArrowUp,
    faArrowUp19,
    faArrowsRotate,
    faArrowUpRightFromSquare,
    faBath,
    faBed,
    faBell,
    faBookmark,
    faBoxArchive,
    faBuilding,
    faBullseye,
    faCalendarCheck,
    faCalendarDays,
    faChartPie,
    faCheck,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faChevronUp,
    faCircleCheck,
    faCircleInfo,
    faClipboardCheck,
    faCoins,
    faCommentDots,
    faCopyright,
    faDownload,
    faFilter,
    faGear,
    faHardDrive,
    faHashtag,
    faHouse,
    faHouseCircleCheck,
    faHouseUser,
    faIdCard,
    faInbox,
    faKey,
    faListCheck,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faMoneyBillTransfer,
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
    faUser,
    faUsers,
    faWallet,
    faWeightHanging,
    faWifi,
    faXmark
);

const app = createApp(App);
const head = createHead();

app.use(createPinia());
app.use(router);
app.use(head);

// app.component('FaIcon', FontAwesomeIcon);

app.component('FaIcon', (props, context) => {
    return h(FontAwesomeIcon, { ...props, fixedWidth: true }, context.slots);
});

app.use(
    createToastflow({
        closeButton: false,
        closeOnClick: true,
        duration: 2500,
    })
);

await router.isReady();
app.mount('#app');
