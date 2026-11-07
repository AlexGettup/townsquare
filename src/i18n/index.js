import Vue from "vue";
import VueI18n from "vue-i18n";
import en from "./locales/en.json";
import es from "./locales/es.json";

Vue.use(VueI18n);

// Languages offered in the UI, in the order they are shown in the menu.
export const LOCALES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
];

export const DEFAULT_LOCALE = "en";

export const isSupportedLocale = (code) =>
  LOCALES.some((locale) => locale.code === code);

/**
 * Pick the best supported language from the browser settings
 * (e.g. "es-ES" -> "es"), falling back to the default language.
 */
export const detectBrowserLocale = () => {
  const preferred = navigator.languages || [navigator.language];
  for (const tag of preferred) {
    const code = (tag || "").toLowerCase().split("-")[0];
    if (isSupportedLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
};

export default new VueI18n({
  locale: DEFAULT_LOCALE,
  // any string missing in a translation is shown in English instead
  fallbackLocale: DEFAULT_LOCALE,
  silentFallbackWarn: true,
  messages: { en, es },
});
