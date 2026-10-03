import type { i18n as I18n } from "i18next";
import apiClient from "./apiClient";

// Runtime auto-translation (product request: "auto-translate the whole web
// + mobile app; no untranslated content left"). Bundled locale JSON files
// only cover part of the UI -- ~1000 strings exist solely as English
// `defaultValue`s in code, and some keys exist only in en. This layer fills
// both gaps on demand:
//   1. a key missing from every bundle  -> i18next's missingKeyHandler fires
//      with the English defaultValue
//   2. a key in en but not in the active language -> diffed on language change
// Both are batched to POST /api/v1/i18n/translate (server caches every
// (language, text) pair forever), injected back with addResource so
// react-i18next re-renders, and cached in localStorage so repeat visits are
// instant and offline-safe. Placeholders ({{x}}) are preserved server-side.
const CACHE_PREFIX = "saveur.i18n.rt.v1.";
const BATCH = 60;
const RETRY_AFTER_MS = 60_000;

type Entry = [string, string]; // [sourceHash, translated]
const caches: Record<string, Record<string, Entry>> = {};
const pending = new Map<string, { lang: string; ns: string; key: string; text: string }>();
const inflight = new Set<string>();
const failedAt = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let i18nRef: I18n | null = null;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function cacheFor(lang: string): Record<string, Entry> {
  if (caches[lang]) return caches[lang];
  try {
    caches[lang] = JSON.parse(localStorage.getItem(CACHE_PREFIX + lang) || "{}");
  } catch {
    caches[lang] = {};
  }
  return caches[lang];
}

function persist(lang: string) {
  try {
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(caches[lang] ?? {}));
  } catch {
    // storage full/unavailable — translations still work for this session
  }
}

function apply(lang: string, ns: string, key: string, text: string) {
  i18nRef?.addResource(lang, ns, key, text);
}

function enqueue(lang: string, ns: string, key: string, text: string) {
  if (!text || lang === "en") return;
  const id = `${lang}|${ns}|${key}`;
  if (pending.has(id) || inflight.has(id)) return;
  const failed = failedAt.get(id);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) return;
  const hit = cacheFor(lang)[`${ns}|${key}`];
  if (hit && hit[0] === hash(text)) {
    // Deferred: enqueue() runs from inside t() during a React render, and
    // addResource() synchronously notifies subscribed components.
    setTimeout(() => apply(lang, ns, key, hit[1]), 0);
    return;
  }
  pending.set(id, { lang, ns, key, text });
  if (!timer) timer = setTimeout(flush, 250);
}

async function flush() {
  timer = null;
  const all = Array.from(pending.entries());
  if (!all.length) return;
  // one language at a time (the active one); stale-language items are dropped
  const lang = i18nRef?.language?.split("-")[0] ?? "en";
  const batch = all.filter(([, v]) => v.lang === lang).slice(0, BATCH);
  for (const [id] of all) if (!batch.find(([b]) => b === id) && pending.get(id)?.lang !== lang) pending.delete(id);
  if (!batch.length) return;
  const strings: Record<string, string> = {};
  for (const [id, v] of batch) {
    pending.delete(id);
    inflight.add(id);
    strings[id] = v.text;
  }
  try {
    const res = await apiClient.post<{ translations: Record<string, string> }>("/api/v1/i18n/translate", { lang, strings });
    const cache = cacheFor(lang);
    for (const [id, v] of batch) {
      const out = res.translations?.[id];
      if (out) {
        apply(lang, v.ns, v.key, out);
        cache[`${v.ns}|${v.key}`] = [hash(v.text), out];
      } else {
        failedAt.set(id, Date.now());
      }
    }
    persist(lang);
  } catch {
    for (const [id] of batch) failedAt.set(id, Date.now());
  } finally {
    for (const [id] of batch) inflight.delete(id);
    if (pending.size && !timer) timer = setTimeout(flush, 250);
  }
}

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out[p] = v;
      else flatten(v, p, out);
    }
  }
  return out;
}

/** Queue every English string the active language's bundle doesn't have. */
function enqueueBundleGaps(lang: string) {
  if (!i18nRef || lang === "en") return;
  for (const ns of ["common", "web"]) {
    const en = flatten(i18nRef.getResourceBundle("en", ns));
    const cur = flatten(i18nRef.getResourceBundle(lang, ns));
    for (const [key, text] of Object.entries(en)) {
      if (!(key in cur)) enqueue(lang, ns, key, text);
    }
  }
}

/** Options to merge into i18n.init(): saveMissing + handler. */
export function runtimeTranslationInitOptions() {
  return {
    saveMissing: true,
    saveMissingTo: "current" as const,
    missingKeyHandler: (lngs: readonly string[], ns: string, key: string, fallbackValue: string) => {
      const lang = (lngs[0] || "en").split("-")[0];
      if (lang === "en" || typeof window === "undefined") return;
      // fallbackValue is the English defaultValue (still containing {{placeholders}})
      enqueue(lang, ns, key, fallbackValue);
    },
  };
}

export function installRuntimeTranslation(instance: I18n) {
  if (typeof window === "undefined" || i18nRef) return;
  i18nRef = instance;
  const run = (lng: string) => enqueueBundleGaps((lng || "en").split("-")[0]);
  instance.on("languageChanged", run);
  run(instance.language);
}
