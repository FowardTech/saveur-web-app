"use client";

import React from "react";
import { I18nextProvider } from "react-i18next";
import i18n, {
  DEFAULT_LANGUAGE_CODE,
  isSupportedLanguageCode,
  LOCALE_STORAGE_KEY,
  RTL_LANGUAGE_CODES,
} from "@/i18n/config";
import { useAuth } from "@/app/providers/AuthProvider";

function applyDocumentDirection(code: string) {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGUAGE_CODES.has(code) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = code;
}

/** Resolves the language to boot with for a signed-out visitor: last pick in
 * localStorage, then the browser's own language, then English. Mirrors
 * mobile's own signed-out fallback chain (see Saveur/i18n/language-detector.ts)
 * adapted for the web's localStorage instead of AsyncStorage. */
function resolveInitialLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE_CODE;

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLanguageCode(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through.
  }

  const browserLang = window.navigator?.language?.split("-")[0];
  if (isSupportedLanguageCode(browserLang)) return browserLang;

  return DEFAULT_LANGUAGE_CODE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const appliedProfileLocale = React.useRef<string | null>(null);
  const bootedRef = React.useRef(false);

  // Boot: pick the best guess for a signed-out visitor immediately, so the
  // very first paint isn't stuck in English for e.g. a French-locale browser.
  React.useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const initial = resolveInitialLanguage();
    if (initial !== i18n.language) {
      i18n.changeLanguage(initial);
    }
    applyDocumentDirection(initial);
  }, []);

  // Once the signed-in user's profile loads, their saved `locale` (synced
  // from mobile/backend, PATCH /api/users/me) takes priority over whatever
  // guess we booted with — matching mobile's own "profile locale wins" rule.
  React.useEffect(() => {
    const locale = profile?.locale;
    if (!locale || !isSupportedLanguageCode(locale)) return;
    if (appliedProfileLocale.current === locale) return;
    appliedProfileLocale.current = locale;
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [profile?.locale]);

  React.useEffect(() => {
    applyDocumentDirection(i18n.language);
    const onChange = (lng: string) => applyDocumentDirection(lng);
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
