import { columnOf, move, stashesLang, upsert, type Board, type Card, type Column } from "../board";
import type { SessionShape } from "../storage";
import type { Lang, OpenVideo, Overrides, VideoMeta } from "../types";
import { resolveLang } from "./tabs";

export type Playing = NonNullable<SessionShape["playing"]>;

/** A card on the board but in no column is the one playing: "Listening now" is not a column. */
function isPlaying(board: Board, videoId: string): boolean {
  return board.cards[videoId] !== undefined && columnOf(board, videoId) === null;
}

/** Takes a card out of every column, leaving it on the board with no column. */
function takeOut(board: Board, videoId: string): Board {
  const without = (list: string[]) => list.filter((id) => id !== videoId);
  return {
    ...board,
    columns: {
      inbox: without(board.columns.inbox),
      next: without(board.columns.next),
      done: without(board.columns.done),
      later: without(board.columns.later),
    },
  };
}

export function backToNext(board: Board, videoId: string): Board {
  return move(board, videoId, "next", 0);
}

/** A card starts playing: the card that was playing before goes back to the top of Up next. */
export function startCard(board: Board, videoId: string, previous: string | null): Board {
  const back = previous && previous !== videoId ? backToNext(board, previous) : board;
  return takeOut(back, videoId);
}

/** The playing card is finished: it goes to Done, and the top of Up next (if any) is taken out to play. */
export function finishCard(board: Board, videoId: string, now: number): { board: Board; next: string | null } {
  const done = move(board, videoId, "done", undefined, now);
  const next = done.columns.next[0] ?? null;
  return { board: next ? takeOut(done, next) : done, next };
}

/** Upserts a card. A card that is playing stays out of the columns; any other keeps its column. */
export function refreshCard(board: Board, video: Omit<Card, "addedAt">, column: Column, now: number): Board {
  const next = upsert(board, video, column, now);
  return isPlaying(board, video.videoId) ? { ...board, cards: next.cards } : next;
}

/** Puts a card in a column at an index, refreshing its details. A card that is playing stays out of the columns. */
export function placeCard(board: Board, video: Omit<Card, "addedAt">, column: Column, index: number | undefined, now: number): Board {
  const refreshed = refreshCard(board, video, column, now);
  return isPlaying(board, video.videoId) ? refreshed : move(refreshed, video.videoId, column, index, now);
}

/** Fills a card's language and length from the page or an override, where the card lacks them. */
export function fillCard(board: Board, videoId: string, meta: VideoMeta | undefined, overrides: Overrides): Board {
  const card = board.cards[videoId];
  if (!card) return board;
  const lang = card.lang ?? resolveLang(videoId, meta?.channel ?? card.channel, meta?.detectedLang ?? null, overrides);
  const duration = card.duration || meta?.duration || 0;
  const title = card.title || meta?.title || "";
  const channel = card.channel || meta?.channel || "";
  if (lang === card.lang && duration === card.duration && title === card.title && channel === card.channel) return board;
  return { ...board, cards: { ...board.cards, [videoId]: { ...card, lang, duration, title, channel } } };
}

/** The open videos a stash closes: the given ones, or else every tab in a goal language, minus the tabs that must stay open. */
export function stashTargets(videos: OpenVideo[], videoIds: string[] | undefined, keepTabIds: number[], goalLangs: Lang[] = []): OpenVideo[] {
  return videos.filter(
    (video) => (videoIds ? videoIds.includes(video.videoId) : stashesLang(video.lang, goalLangs)) && !keepTabIds.includes(video.tabId),
  );
}
