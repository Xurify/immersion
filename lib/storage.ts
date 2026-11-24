import type { Board } from "./board";
import type { ActiveSession, Goals, ListenLog, Overrides, Sentence, Session, VideoMeta } from "./types";

/** Every persisted value, in browser.storage.local unless noted. */
export interface StorageShape {
  goals: Goals;
  log: ListenLog;
  sentences: Sentence[];
  sessions: Session[];
  /** videoId → metadata, so sleeping tabs and saved videos keep their details. */
  meta: Record<string, VideoMeta>;
  overrides: Overrides;
  board: Board;
  /** videoId → seconds actually played, counted the same way as the listening log. */
  watched: Record<string, number>;
}

/** Lives in browser.storage.session: gone when the browser closes. */
export interface SessionShape {
  active: ActiveSession | null;
  /** tabId → last reported playback state. */
  live: Record<string, { videoId: string; position: number; playing: boolean; at: number }>;
  /** The board card being played one tab at a time, and its tab. */
  playing: { videoId: string; tabId: number } | null;
}

export const DEFAULTS: StorageShape = {
  goals: {},
  log: {},
  sentences: [],
  sessions: [],
  meta: {},
  overrides: { videos: {}, channels: {} },
  board: { cards: {}, columns: { inbox: [], next: [], done: [], later: [] } },
  watched: {},
};

export async function load<K extends keyof StorageShape>(key: K): Promise<StorageShape[K]> {
  const got = await browser.storage.local.get(key);
  return (got[key] as StorageShape[K] | undefined) ?? structuredClone(DEFAULTS[key]);
}

export async function save<K extends keyof StorageShape>(key: K, value: StorageShape[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function loadSession<K extends keyof SessionShape>(key: K): Promise<SessionShape[K]> {
  const got = await browser.storage.session.get(key);
  const fallback: SessionShape = { active: null, live: {}, playing: null };
  return (got[key] as SessionShape[K] | undefined) ?? fallback[key];
}

export async function saveSession<K extends keyof SessionShape>(key: K, value: SessionShape[K]): Promise<void> {
  await browser.storage.session.set({ [key]: value });
}

/** Calls back whenever one of the given local keys changes, from any page. */
export function watch(keys: (keyof StorageShape)[], callback: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === "local" && keys.some((key) => key in changes)) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
