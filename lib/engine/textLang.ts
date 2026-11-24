import { francAll } from "franc";
import { ALL_LANGS } from "../languages";
import type { Lang, VideoMeta } from "../types";

/** franc's ISO 639-3 codes for each language. franc has no model for some of ALL_LANGS, so those are absent. */
const FRANC_CODES: Record<string, string[]> = {
  af: ["afr"], am: ["amh"], ar: ["arb"], az: ["azj"], be: ["bel"], bg: ["bul"], bn: ["ben"], bs: ["bos"],
  ca: ["cat"], cs: ["ces"], da: ["dan"], de: ["deu"], el: ["ell"], en: ["eng"], eo: ["epo"], es: ["spa"],
  et: ["ekk"], fa: ["pes"], fi: ["fin"], fil: ["tgl"], fr: ["fra"], gl: ["glg"], he: ["heb"], hi: ["hin"],
  hr: ["hrv"], ht: ["hat"], hu: ["hun"], hy: ["hye"], id: ["ind"], it: ["ita"], ja: ["jpn"], jv: ["jav"],
  ka: ["kat"], kk: ["kaz"], km: ["khm"], kn: ["kan"], ko: ["kor"], ku: ["ckb"], ky: ["kir"], lo: ["lao"],
  lt: ["lit"], lv: ["lvs"], mk: ["mkd"], ml: ["mal"], mn: ["khk"], mr: ["mar"], ms: ["zlm"], my: ["mya"],
  ne: ["npi"], nl: ["nld"], no: ["nob", "nno"], pa: ["pan"], pl: ["pol"], ps: ["pbu"], pt: ["por"], ro: ["ron"],
  ru: ["rus"], si: ["sin"], sk: ["slk"], sl: ["slv"], so: ["som"], sq: ["als"], sr: ["srp"], sv: ["swe"],
  sw: ["swh"], ta: ["tam"], te: ["tel"], tg: ["tgk"], th: ["tha"], tk: ["tuk"], tr: ["tur"], uk: ["ukr"],
  ur: ["urd"], uz: ["uzn"], vi: ["vie"], yi: ["ydd"], yo: ["yor"], zh: ["cmn"], zu: ["zul"],
};

const LANG_OF_CODE = new Map<string, Lang>(
  Object.entries(FRANC_CODES).flatMap(([lang, codes]) => codes.map((code): [string, Lang] => [code, lang])),
);

/** Titles this long are guessed from alone; shorter ones get the description's opening too. */
const TITLE_ALONE_MIN = 20;
const DESCRIPTION_CHARS = 300;
/** Fewer letters than this is too little text to guess from. */
const MIN_LETTERS = 12;
/** franc scores run from 0 to 1; a weaker top guess is treated as no guess. */
const MIN_SCORE = 0.9;
/**
 * A goal language this close to franc's top score wins over it. Wider than the
 * usual margin because Ukrainian scores about 0.11 under Serbian on Cyrillic titles.
 */
const GOAL_MARGIN = 0.15;
/** franc takes short English titles for Galician; these words are rare in the other candidates. */
const ENGLISH_WORDS = /\b(the|and|with|you|your|how|what|why|this|that|from|are|have|will|about|when|which|they|of|at|in|for)\b/gi;

function guess(text: string, only: string[], goals: Lang[]): Lang | null {
  if ((text.match(/\p{L}/gu) ?? []).length < MIN_LETTERS) return null;
  const ranked = francAll(text.toLowerCase(), { only });
  const top = ranked[0];
  if (!top || top[1] < MIN_SCORE) return null;
  const pick = ranked.find(([code, score]) => {
    const lang = LANG_OF_CODE.get(code);
    return lang !== undefined && goals.includes(lang) && score >= top[1] - GOAL_MARGIN;
  });
  const lang = LANG_OF_CODE.get((pick ?? top)[0]);
  if (!lang) return null;
  const englishHits = new Set((text.match(ENGLISH_WORDS) ?? []).map((word) => word.toLowerCase())).size;
  return !goals.includes(lang) && englishHits >= 2 ? "en" : lang;
}

/**
 * Guesses a video's spoken language from its text. Only the user's goal languages
 * and the picker's languages are candidates, and a goal language near the top wins.
 */
export function detectTextLang(title: string, description: string | undefined, goals: Lang[]): Lang | null {
  const only = [...new Set([...goals, ...ALL_LANGS].flatMap((lang) => FRANC_CODES[lang] ?? []))];
  if (title.length >= TITLE_ALONE_MIN) {
    const fromTitle = guess(title, only, goals);
    if (fromTitle) return fromTitle;
  }
  return guess(`${title} ${description?.slice(0, DESCRIPTION_CHARS) ?? ""}`, only, goals);
}

/** Fills in a language from the text when YouTube's data gave none. */
export function withTextLang(meta: VideoMeta, description: string | undefined, goals: Lang[]): VideoMeta {
  if (meta.detectedLang) return meta;
  const detectedLang = detectTextLang(meta.title, description, goals);
  return detectedLang ? { ...meta, detectedLang, langSource: "text" } : meta;
}
