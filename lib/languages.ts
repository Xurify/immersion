import type { Lang } from "./types";

/**
 * Panel colours. Each keeps white text at 4.5:1 or better, so a language
 * colour can fill a whole panel in light and dark themes alike.
 */
export const PALETTE = ["#c93a1e", "#2f45d8", "#1d7a4c", "#8a2d7a", "#0d6b76", "#985400", "#b0174f", "#5a3cc4"] as const;

/** Languages often studied together sit on different colours. */
const FIXED: Record<string, number> = {
  es: 0, ja: 1, sk: 2, fr: 3, de: 4, it: 5, ko: 6, zh: 7,
  pt: 4, ru: 3, cs: 0, pl: 6, et: 5, en: 7, nl: 2, sv: 1, fi: 4, uk: 5, hu: 3, tr: 6,
};

export const UNKNOWN_COLOR = "#6f6a60";

export function langColor(lang: Lang | null | undefined): string {
  if (!lang) return UNKNOWN_COLOR;
  const slot = FIXED[lang];
  if (slot != null) return PALETTE[slot]!;
  let hash = 0;
  for (const char of lang) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

function capitalise(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** "Español", "日本語", "Slovenčina": the language's name for itself. */
export function nativeName(lang: Lang | null | undefined): string {
  if (!lang) return "Unknown";
  try {
    const name = new Intl.DisplayNames([lang], { type: "language" }).of(lang);
    return name ? capitalise(name, lang) : lang;
  } catch {
    return lang;
  }
}

/** "Spanish", "Japanese". */
export function englishName(lang: Lang | null | undefined): string {
  if (!lang) return "Unknown language";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

/** CJK names need a font with those glyphs; the display serif has none. */
export function isCjk(lang: Lang | null | undefined): boolean {
  return lang === "ja" || lang === "zh" || lang === "ko";
}

/** Normalises "es-419", "pt-BR", "zh-Hans" to a base code. */
export function baseLang(code: string | null | undefined): Lang | null {
  if (!code) return null;
  const base = code.toLowerCase().split(/[-_]/)[0];
  return base && /^[a-z]{2,3}$/.test(base) ? base : null;
}

/** A starter list for the goal picker. */
export const COMMON_LANGS: Lang[] = ["es", "fr", "de", "it", "pt", "ja", "ko", "zh", "ru", "sk", "cs", "pl", "nl", "sv", "et", "fi", "uk", "tr", "ar", "hi", "en"];

/** ISO 639-1 codes the pickers offer; names come from Intl.DisplayNames. */
export const ALL_LANGS: Lang[] = [
  "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "eo", "es", "et", "eu", "fa",
  "fi", "fil", "fr", "ga", "gl", "gu", "he", "hi", "hr", "ht", "hu", "hy", "id", "is", "it", "ja", "jv", "ka", "kk", "km",
  "kn", "ko", "ku", "ky", "la", "lb", "lo", "lt", "lv", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl", "no",
  "pa", "pl", "ps", "pt", "ro", "ru", "si", "sk", "sl", "so", "sq", "sr", "sv", "sw", "ta", "te", "tg", "th", "tk", "tr",
  "uk", "ur", "uz", "vi", "yi", "yo", "zh", "zu",
];
