import type { Column } from "./board";
import type { Grade, OpenVideo, ReadingItem, Sentence, VideoMeta } from "./types";

/**
 * Every message the background answers: request payload and response.
 * Pages call `send`; the background registers one handler per key.
 */
export interface Requests {
  /** All open YouTube watch/shorts tabs, in window then tab order. */
  "tabs:list": { req: {}; res: OpenVideo[] };
  "tabs:focus": { req: { tabId: number }; res: void };
  "tabs:close": { req: { tabIds: number[] }; res: void };
  /** Focus the first tab and play the list in order, advancing when each video ends. */
  "session:start": { req: { tabIds: number[] }; res: void };
  "session:stop": { req: {}; res: void };
  /** Open a saved session's videos in a new window. */
  "session:open": { req: { sessionId: string }; res: void };
  "reading:list": { req: {}; res: ReadingItem[] };
  "reading:remove": { req: { url: string }; res: void };
  /** Play a sentence's clip in a tab showing that video, opening one if needed. */
  "clip:play": { req: { sentenceId: string }; res: void };
  "review:grade": { req: { sentenceId: string; grade: Grade }; res: Sentence };
  "lang:override": { req: { videoId: string; channel: string; lang: string; scope: "video" | "channel" }; res: void };
  "desk:open": { req: { view?: string }; res: void };
  /** Looks up details again for every open tab and board card still missing them, even ones tried before. */
  "meta:retry": { req: {}; res: { queued: number } };

  /**
   * Board. The background is the only writer of storage "board", so a card's
   * position (updated from ticks) and moves from the page never overwrite each other.
   */
  /** Puts open tabs on the board (keeping cards' columns, new ones in Inbox) and closes them. Without ids: every YouTube tab except the one playing. */
  "board:stash": { req: { videoIds?: string[] }; res: { stashed: number } };
  /** Adds open tabs to the board without closing them. */
  "board:add": { req: { videoIds: string[]; column: Column; index?: number }; res: void };
  /** Moves a card; to Later or Done also closes its tab. */
  "board:move": { req: { videoId: string; column: Column; index?: number }; res: void };
  "board:remove": { req: { videoId: string; closeTab: boolean }; res: void };
  /** Plays a card (default: first of Up next) in one tab at its saved position, then Up next in order. */
  "board:play": { req: { videoId?: string }; res: void };
  /** Stops after the current video; the current card goes back to the top of Up next. */
  "board:pause": { req: {}; res: void };
  /** Skips the current card to Done and plays the next. */
  "board:skip": { req: {}; res: void };
  /** Moves YouTube items from Chrome's reading list into Inbox and marks them read. */
  "board:import-reading": { req: {}; res: { added: number } };

  /** From the content script: page metadata after load or navigation. */
  "yt:meta": { req: VideoMeta; res: void };
  /** From the content script every few seconds while on a watch page. */
  /** `watching` is false while the tab is hidden and not in picture-in-picture: background listening. */
  "yt:tick": { req: { videoId: string; position: number; playing: boolean; watching?: boolean }; res: void };
  "yt:ended": { req: { videoId: string }; res: void };
  /** From the content script when the viewer saves the current caption. */
  "yt:save-sentence": { req: Omit<Sentence, "id" | "createdAt" | "step" | "dueAt" | "reviews" | "lang"> & { lang: string | null }; res: { saved: boolean } };
}

/** Messages the background sends into a YouTube tab. */
export interface TabCommands {
  "clip:play": { start: number; end: number };
  "video:play": {};
}

export type RequestKey = keyof Requests;

export async function send<K extends RequestKey>(type: K, payload: Requests[K]["req"]): Promise<Requests[K]["res"]> {
  const reply = (await browser.runtime.sendMessage({ type, payload })) as { ok: true; value: Requests[K]["res"] } | { ok: false; error: string } | undefined;
  if (!reply) throw new Error(`No reply to ${type}`);
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

export function sendToTab<K extends keyof TabCommands>(tabId: number, type: K, payload: TabCommands[K]): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, { type, payload });
}
