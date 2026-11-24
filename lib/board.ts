import { dateKey } from "./format";
import type { Lang, OpenVideo, SavedVideo } from "./types";

/**
 * The board keeps videos, not tabs: a card holds everything needed to reopen a
 * video where it was left, so its tab can be closed. "Listening now" is not a
 * column; it is whichever card the background is playing (SessionShape.playing).
 */
export type Column = "inbox" | "next" | "done" | "later";
export const COLUMNS: Column[] = ["inbox", "next", "done", "later"];

export interface Card extends SavedVideo {
  /** Seconds watched, so the video reopens where it was left. */
  position: number;
  addedAt: number;
  /** Set when the card entered Done; Done only shows today's cards. */
  doneAt?: number;
}

export interface Board {
  /** Keyed by videoId. */
  cards: Record<string, Card>;
  /** Card ids per column, in display order. Each id sits in exactly one column. */
  columns: Record<Column, string[]>;
}

export function emptyBoard(): Board {
  return { cards: {}, columns: { inbox: [], next: [], done: [], later: [] } };
}

export function columnOf(board: Board, id: string): Column | null {
  return COLUMNS.find((column) => board.columns[column].includes(id)) ?? null;
}

function without(board: Board, id: string): Board["columns"] {
  const columns = { ...board.columns };
  for (const column of COLUMNS) columns[column] = columns[column].filter((other) => other !== id);
  return columns;
}

/** Moves a card to a column at an index (end when omitted). */
export function move(board: Board, id: string, column: Column, index?: number, now: number = Date.now()): Board {
  const card = board.cards[id];
  if (!card) return board;
  const columns = without(board, id);
  const list = [...columns[column]];
  list.splice(index == null ? list.length : Math.max(0, Math.min(index, list.length)), 0, id);
  columns[column] = list;
  const doneAt = column === "done" ? (card.doneAt ?? now) : undefined;
  return { cards: { ...board.cards, [id]: { ...card, doneAt } }, columns };
}

/**
 * Adds or refreshes a card. A card already on the board keeps its column and
 * gets fresher details; a new one lands in `column`.
 */
export function upsert(board: Board, video: Omit<Card, "addedAt"> & { addedAt?: number }, column: Column = "inbox", now: number = Date.now()): Board {
  const existing = board.cards[video.videoId];
  const card: Card = {
    ...existing,
    ...video,
    title: video.title || existing?.title || "",
    duration: video.duration || existing?.duration || 0,
    lang: video.lang ?? existing?.lang ?? null,
    position: Math.max(video.position, 0),
    addedAt: existing?.addedAt ?? video.addedAt ?? now,
  };
  const next = { ...board, cards: { ...board.cards, [card.videoId]: card } };
  return existing && columnOf(board, card.videoId) ? next : move(next, card.videoId, column, undefined, now);
}

export function remove(board: Board, id: string): Board {
  const cards = { ...board.cards };
  delete cards[id];
  return { cards, columns: without(board, id) };
}

export function setPosition(board: Board, id: string, position: number): Board {
  const card = board.cards[id];
  if (!card || Math.abs(card.position - position) < 1) return board;
  return { ...board, cards: { ...board.cards, [id]: { ...card, position } } };
}

/** Drops Done cards from before today. */
export function pruneDone(board: Board, now: number = Date.now()): Board {
  const today = dateKey(now);
  const stale = board.columns.done.filter((id) => {
    const doneAt = board.cards[id]?.doneAt;
    return !doneAt || dateKey(doneAt) !== today;
  });
  return stale.reduce(remove, board);
}

export function cardFromTab(video: OpenVideo, now: number = Date.now()): Card {
  return {
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    videoId: video.videoId,
    title: video.title,
    channel: video.channel,
    duration: video.duration,
    lang: video.lang,
    position: video.position,
    addedAt: now,
  };
}

export function remaining(card: Pick<Card, "duration" | "position">): number {
  return Math.max(0, card.duration - card.position);
}

/** URL that resumes the card a few seconds before where it was left. */
export function resumeUrl(card: Card): string {
  const at = Math.floor(card.position) > 10 && remaining(card) > 15 ? Math.floor(card.position) - 3 : 0;
  return `https://www.youtube.com/watch?v=${card.videoId}${at ? `&t=${at}s` : ""}`;
}

/** A card shaped for lib/plan.ts, which plans over OpenVideo. */
export function asPlannable(card: Card, tab?: OpenVideo): OpenVideo {
  return {
    tabId: tab?.tabId ?? -1,
    windowId: tab?.windowId ?? -1,
    url: card.url,
    videoId: card.videoId,
    title: card.title,
    channel: card.channel,
    duration: card.duration,
    detectedLang: card.lang,
    lang: tab?.lang ?? card.lang,
    position: tab?.position ?? card.position,
    remaining: tab ? tab.remaining : remaining(card),
    playing: tab?.playing ?? false,
    asleep: tab?.asleep ?? false,
    isShort: tab?.isShort ?? false,
  };
}

/** Seconds in a column, optionally for one language. */
export function columnSeconds(board: Board, column: Column, lang?: Lang): number {
  return board.columns[column].reduce((sum, id) => {
    const card = board.cards[id];
    return card && (!lang || card.lang === lang) ? sum + remaining(card) : sum;
  }, 0);
}
