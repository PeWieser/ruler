// ── MaßWerk · Lokalisierung (P5) ────────────────────────────────────────────
// Gettext-Prinzip: Der deutsche Quelltext ist der Schlüssel. `t("Distanz")`
// liefert im Deutschen exakt den Schlüssel zurück, in anderen Sprachen die
// Übersetzung aus dem Wörterbuch – fehlt ein Eintrag, fällt er höflich auf
// Deutsch zurück (keine nackten Keys im UI, niemals).
//
// Komponenten nutzen `useT()` (re-rendert bei Sprachwechsel), Code außerhalb
// von React (Store, Export) nutzt `t()` direkt – beide lesen die Locale zur
// Aufrufzeit, nicht zur Importzeit.

import { create } from "zustand";
import { EN } from "./en";

export type Locale = "de" | "en";

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

function readStored(): Locale {
  try {
    return localStorage.getItem("mw-locale") === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleState>()((set) => ({
  locale: readStored(),
  setLocale: (l) => {
    try {
      localStorage.setItem("mw-locale", l);
    } catch {
      // privater Modus: ohne Persistenz weiterarbeiten
    }
    if (typeof document !== "undefined") document.documentElement.lang = l;
    set({ locale: l });
  },
}));

function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** Übersetzt zur Aufrufzeit – für Code außerhalb von React. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const { locale } = useLocale.getState();
  if (locale === "de") return fill(key, vars);
  return fill(EN[key] ?? key, vars);
}

/** Übersetzungsfunktion für Komponenten: re-rendert bei Sprachwechsel. */
export function useT(): TFn {
  useLocale((s) => s.locale);
  return t;
}
