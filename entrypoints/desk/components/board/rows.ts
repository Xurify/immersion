import { COLUMNS, cardFromTab, columnOf, remaining, type Board, type Card, type Column } from "../../../../lib/board";
import type { Lang, OpenVideo } from "../../../../lib/types";

/** "playing" is a lane of its own: the card the background is playing, wherever it is stored. */
export type LaneKey = Column | "playing";
export const LANES: LaneKey[] = ["inbox", "next", "playing", "done", "later"];

export const LANE_NAME: Record<LaneKey, string> = {
  inbox: "Inbox",
  next: "Up next",
  playing: "Listening now",
  done: "Done today",
  later: "Later",
};

/** Menu labels; "Done" rather than "Done today" because it reads as an action. */
export const MOVE_LABEL: Record<Column, string> = { inbox: "Inbox", next: "Up next", done: "Done", later: "Later" };

export interface Row {
  videoId: string;
  title: string;
  lang: Lang | null;
  card: Card;
  /** The open tab for this video, if any. */
  tab: OpenVideo | null;
  /** Column the card is stored in; null for an open tab with no card yet. */
  source: Column | null;
  /** Lane the row is shown in. */
  lane: LaneKey;
  /** Seconds left, from the live tab when there is one. */
  left: number;
  position: number;
  duration: number;
}

export interface CardActions {
  open: (row: Row) => void;
  play: (row: Row) => void;
  move: (row: Row, column: Column) => void;
  remove: (row: Row) => void;
  menu: (row: Row) => void;
  key: (event: KeyboardEvent, row: Row) => void;
  focus: (row: Row) => void;
  dragstart: (event: DragEvent, row: Row) => void;
  dragend: () => void;
}

/** Done cards keep their watched time out of the total, so they show the full length. */
export function timeOf(row: Row): number {
  return row.lane === "done" ? row.duration : row.left;
}

function rowOf(card: Card, tab: OpenVideo | null, source: Column | null, lane: LaneKey): Row {
  return {
    videoId: card.videoId,
    title: card.title || tab?.title || "Untitled video",
    lang: tab?.lang ?? card.lang,
    card,
    tab,
    source,
    lane,
    left: tab ? tab.remaining : remaining(card),
    position: tab ? tab.position : card.position,
    duration: tab?.duration || card.duration,
  };
}

/** Splits the board and open tabs into lanes. Open tabs without a card show in Inbox. */
export function buildLanes(board: Board, tabs: OpenVideo[], playingId: string | null): Record<LaneKey, Row[]> {
  const tabByVideo = new Map<string, OpenVideo>();
  for (const tab of tabs) if (!tabByVideo.has(tab.videoId)) tabByVideo.set(tab.videoId, tab);

  const lanes: Record<LaneKey, Row[]> = { inbox: [], next: [], playing: [], done: [], later: [] };
  const stored = new Set<string>();
  for (const column of COLUMNS) {
    for (const videoId of board.columns[column]) {
      const card = board.cards[videoId];
      if (!card) continue;
      stored.add(videoId);
      if (videoId === playingId) continue;
      lanes[column].push(rowOf(card, tabByVideo.get(videoId) ?? null, column, column));
    }
  }

  if (playingId) {
    const tab = tabByVideo.get(playingId) ?? null;
    const card = board.cards[playingId] ?? (tab ? cardFromTab(tab) : null);
    if (card) lanes.playing.push(rowOf(card, tab, columnOf(board, playingId), "playing"));
  }

  for (const tab of tabByVideo.values()) {
    if (stored.has(tab.videoId) || tab.videoId === playingId) continue;
    lanes.inbox.push(rowOf(cardFromTab(tab), tab, null, "inbox"));
  }
  return lanes;
}
