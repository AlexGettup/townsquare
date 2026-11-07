import Vue from "vue";
import App from "./App";
import store from "./store";
import i18n from "./i18n";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

const faIcons = [
  "AddressCard",
  "Bed",
  "Beer",
  "Bell",
  "Bullhorn",
  "BookOpen",
  "BookDead",
  "BroadcastTower",
  "Chair",
  "CheckSquare",
  "CloudMoon",
  "Cog",
  "Copy",
  "Clipboard",
  "Church",
  "Comments",
  "Cross",
  "Dice",
  "Dragon",
  "ExchangeAlt",
  "Eye",
  "ExclamationTriangle",
  "FileCode",
  "FileUpload",
  "HandPaper",
  "HandPointRight",
  "Headset",
  "Heartbeat",
  "Image",
  "Link",
  "Microphone",
  "MicrophoneSlash",
  "MinusCircle",
  "PeopleArrows",
  "PlusCircle",
  "Question",
  "Random",
  "RedoAlt",
  "Search",
  "SearchMinus",
  "SearchPlus",
  "Seedling",
  "SignLanguage",
  "SignOutAlt",
  "Skull",
  "Square",
  "TheaterMasks",
  "Times",
  "TimesCircle",
  "Tools",
  "TrashAlt",
  "Undo",
  "User",
  "UserEdit",
  "UserPlus",
  "UserFriends",
  "Users",
  "VenusMars",
  "VolumeUp",
  "VolumeMute",
  "VoteYea",
  "WindowMaximize",
  "WindowMinimize",
  "YinYang",
];
const fabIcons = ["Github", "Discord"];
library.add(
  ...faIcons.map((i) => fas["fa" + i]),
  ...fabIcons.map((i) => fab["fa" + i]),
);
Vue.component("font-awesome-icon", FontAwesomeIcon);
Vue.config.productionTip = false;

// the store owns the chosen language; keep vue-i18n and <html lang> in sync
store.watch(
  (state) => state.grimoire.locale,
  (locale) => {
    i18n.locale = locale;
    document.documentElement.lang = locale;
  },
  { immediate: true },
);

new Vue({
  render: (h) => h(App),
  store,
  i18n,
}).$mount("#app");
