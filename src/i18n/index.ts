import en from "./en.json";
import wo from "./wo.json";
import mnk from "./mnk.json";
import reviewStatus from "./review-status.json";

export type MessageKey = keyof typeof en;
type Messages = Partial<Record<MessageKey, string>>;

const catalogues: Record<string, Messages> = { en, wo, mnk };
const reviewed = reviewStatus as unknown as Record<string, Record<string, string> | undefined>;
export const LOCALES = Object.keys(catalogues);
const STORAGE_KEY = "setsetal.locale";

let locale = "en";

function readSavedLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function detectLocale(): string {
  const preferred = [readSavedLocale(), ...navigator.languages.map((tag) => tag.split("-")[0])];
  return preferred.find((tag): tag is string => Boolean(tag && LOCALES.includes(tag))) ?? "en";
}

// Only an explicit choice (a future language picker) is saved; a locale
// detected from the browser is not.
export function setLocale(next: string, options: { save?: boolean } = {}): void {
  locale = LOCALES.includes(next) ? next : "en";
  document.documentElement.lang = locale;
  if (!options.save) return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

// A translated string is shown only once a native speaker has marked it
// "reviewed" in review-status.json and it is not blank. Everything else falls
// back to English, so drafts never appear as final and labels never go blank.
function localMessage(key: MessageKey): string | undefined {
  if (locale === "en" || reviewed[locale]?.[key] !== "reviewed") return undefined;
  const message = catalogues[locale]?.[key];
  return message?.trim() ? message : undefined;
}

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const message = localMessage(key) ?? en[key];
  if (message === undefined) {
    if (import.meta.env.DEV) console.warn("Missing translation key:", key);
    return key;
  }
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

export function plural(base: "find.count", count: number): string {
  // Intl falls back to a default rule set for locales it does not know.
  const form = new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
  return t(`${base}.${form}` as MessageKey, { count });
}

// Static markup names its text with data-i18n attributes:
//   data-i18n="key"             → textContent
//   data-i18n-aria-label="key"  → aria-label
//   data-i18n-placeholder="key" → placeholder
//   data-i18n-content="key"     → content (meta tags)
export function translatePage(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n as MessageKey);
  });
  for (const attribute of ["aria-label", "placeholder", "content"]) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach((element) => {
      const key = element.getAttribute(`data-i18n-${attribute}`) as MessageKey;
      element.setAttribute(attribute, t(key));
    });
  }
}
