/** ISO 639-1 code such as "es", or null while unknown. */
export type Lang = string;

/** What the YouTube content script reads from a watch page. */
export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  /** Seconds; 0 for live streams or while unknown. */
  duration: number;
  /** Detected spoken language, before any override. */
  detectedLang: Lang | null;
  /** "text" is a guess from the title, so captions or audio data can replace it. */
  langSource?: "captions" | "text";
  /** YouTube's id for the uploader, used to follow the channel. */
  channelId?: string;
}

/** An open YouTube tab as the pages see it. */
export interface OpenVideo extends VideoMeta {
  tabId: number;
  windowId: number;
  url: string;
  /** Override if set, else detected. */
  lang: Lang | null;
  position: number;
  /** duration - position, never negative. */
  remaining: number;
  playing: boolean;
  /** Chrome hears sound from the tab. Unlike `playing`, it cannot go stale or miss a tab whose script is not reporting. */
  audible?: boolean;
  /** Tab was discarded by the browser, so position may be stale. */
  asleep: boolean;
  isShort: boolean;
}

/** Daily goal in minutes, keyed by language. */
export type Goals = Record<Lang, number>;

/** dateKey ("2026-11-24", local time) → language → seconds listened. */
export type ListenLog = Record<string, Record<Lang, number>>;

export interface Sentence {
  id: string;
  text: string;
  translation: string;
  lang: Lang;
  videoId: string;
  videoTitle: string;
  channel: string;
  start: number;
  end: number;
  createdAt: number;
  /** Index into REVIEW_LADDER_DAYS; at or past its length means learned. */
  step: number;
  dueAt: number;
  reviews: number;
}

export type Grade = "again" | "hard" | "good";

export interface SavedVideo {
  url: string;
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  lang: Lang | null;
}

export interface Session {
  id: string;
  name: string;
  savedAt: number;
  videos: SavedVideo[];
}

export interface ReadingItem {
  url: string;
  title: string;
  videoId: string | null;
  addedAt: number;
}

/** A session being played tab by tab. */
export interface ActiveSession {
  tabIds: number[];
  index: number;
  startedAt: number;
}

export type ThemePref = "system" | "light" | "dark";

export interface Overrides {
  videos: Record<string, Lang>;
  channels: Record<string, Lang>;
}

/** A daily goal counts minutes each day; a weekly one, minutes from Monday to Sunday. */
export type GoalPeriod = "day" | "week";

/** Listening logged by hand: podcasts, audiobooks, a tutor, anything off YouTube. */
export interface ManualEntry {
  id: string;
  /** dateKey of the day it counts for. */
  date: string;
  lang: Lang;
  seconds: number;
  /** "Podcast", "Audiobook", "TV", "Tutor" or "Other". */
  source: string;
  addedAt: number;
}

/** A channel whose new uploads land in Inbox. */
export interface Follow {
  channelId: string;
  name: string;
  /** Language given to its uploads until their own is detected. */
  lang: Lang | null;
  followedAt: number;
  /** When its feed was last read; null before the first check. */
  checkedAt: number | null;
  /** Uploads already brought in, newest last, so a removed card does not come back. */
  seen: string[];
}
