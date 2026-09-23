import { useSyncExternalStore } from "react";

export type Locale = "ru" | "kk";
export const localeStorageKey = "tubi.locale";
const listeners = new Set<() => void>();
const isLocale = (value: unknown): value is Locale =>
  value === "ru" || value === "kk";

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(localeStorageKey);
    return isLocale(stored) ? stored : "ru";
  } catch {
    return "ru";
  }
}

let currentLocale = readLocale();
export const getLocale = () => currentLocale;
export const getApiLocale = (): Locale => currentLocale;

export function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  try { localStorage.setItem(localeStorageKey, locale); } catch { /* Memory fallback. */ }
  if (locale === currentLocale) return;
  currentLocale = locale;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== localeStorageKey && event.key !== null) return;
    currentLocale = readLocale();
    listeners.forEach((notify) => notify());
  });
}

// No provider is required. Changing locale never remounts a form.
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => "ru" as Locale);
  return { locale, setLocale };
}
