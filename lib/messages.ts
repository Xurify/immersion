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

  /** From the content script: page metadata after load or navigation. */
  "yt:meta": { req: VideoMeta; res: void };
  /** From the content script every few seconds while on a watch page. */
  "yt:tick": { req: { videoId: string; position: number; playing: boolean }; res: void };
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
