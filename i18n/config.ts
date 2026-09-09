// Client-side i18next setup for the web app. Mirrors the mobile app's
// approach (Saveur/i18n/config.ts) closely enough to share a mental model,
// but namespaced differently to match this app's own component structure —
// see Saveur/constants/languages.ts for the canonical list of supported
// codes/native labels, which SUPPORTED_LANGUAGES below is kept in sync with.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/common.json";
import es from "./locales/es/common.json";
import fr from "./locales/fr/common.json";
import de from "./locales/de/common.json";
import pt from "./locales/pt/common.json";
import it from "./locales/it/common.json";
import zh from "./locales/zh/common.json";
import ja from "./locales/ja/common.json";
import ko from "./locales/ko/common.json";
import ar from "./locales/ar/common.json";
import hi from "./locales/hi/common.json";
import ru from "./locales/ru/common.json";

import webEn from "./locales/en/web.json";
import webEs from "./locales/es/web.json";
import webFr from "./locales/fr/web.json";
import webDe from "./locales/de/web.json";
import webPt from "./locales/pt/web.json";
import webIt from "./locales/it/web.json";
import webZh from "./locales/zh/web.json";
import webJa from "./locales/ja/web.json";
import webKo from "./locales/ko/web.json";
import webAr from "./locales/ar/web.json";
import webHi from "./locales/hi/web.json";
import webRu from "./locales/ru/web.json";

export interface SupportedLanguage {
  code: string;
  label: string;
  nativeLabel: string;
}

// Kept in exact sync with Saveur/constants/languages.ts's SUPPORTED_LANGUAGES
// (codes + native labels) — the mobile app's single source of truth for
// "preferred language". sttLocale isn't relevant on web (no on-device STT
// picker here), so it's omitted.
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "zh", label: "Chinese (Simplified)", nativeLabel: "中文（简体）" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
];

export const DEFAULT_LANGUAGE_CODE = "en";

export function isSupportedLanguageCode(code?: string | null): code is string {
  return !!code && SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

export function getLanguageNativeLabel(code?: string | null): string {
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return match ? match.nativeLabel : SUPPORTED_LANGUAGES[0].nativeLabel;
}

// RTL languages — only Arabic today. Used by I18nProvider to flip <html dir>.
export const RTL_LANGUAGE_CODES = new Set(["ar"]);

export const LOCALE_STORAGE_KEY = "saveur.locale";

const resources = {
  en: { common: en, web: webEn },
  es: { common: es, web: webEs },
  fr: { common: fr, web: webFr },
  de: { common: de, web: webDe },
  pt: { common: pt, web: webPt },
  it: { common: it, web: webIt },
  zh: { common: zh, web: webZh },
  ja: { common: ja, web: webJa },
  ko: { common: ko, web: webKo },
  ar: { common: ar, web: webAr },
  hi: { common: hi, web: webHi },
  ru: { common: ru, web: webRu },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE_CODE,
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "web"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
