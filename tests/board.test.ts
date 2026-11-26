import { expect, test } from "bun:test";
import { emptyBoard, move, nowPlayingOf, pruneDone, remove, resumeUrl, upsert, type Card } from "../lib/board";
import type { OpenVideo } from "../lib/types";

const card = (videoId: string, extra: Partial<Card> = {}): Card => ({
  url: "", videoId, title: videoId, channel: "c", duration: 600, lang: "es", position: 0, addedAt: 0, ...extra,
});

test("upsert adds to inbox and keeps an existing card's column", () => {
  let board = upsert(emptyBoard(), card("a"));
  board = move(board, "a", "next");
  board = upsert(board, card("a", { position: 120, title: "" }));
  expect(board.columns.next).toEqual(["a"]);
  expect(board.columns.inbox).toEqual([]);
  expect(board.cards.a!.position).toBe(120);
  expect(board.cards.a!.title).toBe("a");
});

test("move reorders within and across columns", () => {
  let board = ["a", "b", "c"].reduce((b, id) => upsert(b, card(id), "next"), emptyBoard());
  board = move(board, "c", "next", 0);
  expect(board.columns.next).toEqual(["c", "a", "b"]);
  board = move(board, "a", "later");
  expect(board.columns.next).toEqual(["c", "b"]);
  expect(board.columns.later).toEqual(["a"]);
});

test("done stamps a time and old done cards are pruned", () => {
  const yesterday = new Date(2026, 10, 23, 20).getTime();
  const today = new Date(2026, 10, 24, 9).getTime();
  let board = upsert(upsert(emptyBoard(), card("a")), card("b"));
  board = move(board, "a", "done", undefined, yesterday);
  board = move(board, "b", "done", undefined, today);
  board = pruneDone(board, today);
  expect(board.columns.done).toEqual(["b"]);
  expect(board.cards.a).toBeUndefined();
  expect(remove(board, "b").columns.done).toEqual([]);
});

test("resume URL backs up a few seconds", () => {
  expect(resumeUrl(card("x", { position: 100 }))).toBe("https://www.youtube.com/watch?v=x&t=97s");
  expect(resumeUrl(card("x", { position: 5 }))).toBe("https://www.youtube.com/watch?v=x");
});

function tab(tabId: number, videoId: string, extra: Partial<OpenVideo> = {}): OpenVideo {
  return {
    videoId, title: videoId, channel: "c", duration: 600, detectedLang: "sk", lang: "sk",
    tabId, windowId: 1, url: "", position: 0, remaining: 600, playing: false, asleep: false, isShort: false, ...extra,
  };
}

test("now playing prefers the tab you can hear over an earlier tab still flagged playing", () => {
  const tabs = [tab(1, "podcast", { lang: "et", playing: true }), tab(2, "vlog", { playing: true, audible: true })];
  expect(nowPlayingOf(null, tabs, ["et", "sk"])).toEqual({ videoId: "vlog", tabId: 2, session: false });
});

test("now playing finds an audible goal tab even when its script is not reporting", () => {
  const tabs = [tab(1, "a", { lang: "et", playing: true }), tab(2, "b", { audible: true })];
  expect(nowPlayingOf(null, tabs, ["et", "sk"])?.videoId).toBe("b");
});

test("a quiet session gives way to a video you started yourself, and holds otherwise", () => {
  const session = { videoId: "podcast", tabId: 1 };
  const quiet = [tab(1, "podcast", { lang: "et" }), tab(2, "vlog", { playing: true, audible: true })];
  expect(nowPlayingOf(session, quiet, ["et", "sk"])?.videoId).toBe("vlog");
  expect(nowPlayingOf(session, [tab(1, "podcast", { lang: "et" })], ["et"])).toEqual({ ...session, session: true });
  const heard = [tab(1, "podcast", { lang: "et", audible: true }), tab(2, "vlog", { playing: true, audible: true })];
  expect(nowPlayingOf(session, heard, ["et", "sk"])?.session).toBe(true);
});

test("now playing ignores tabs outside the goal languages", () => {
  expect(nowPlayingOf(null, [tab(1, "x", { lang: "uk", playing: true, audible: true })], ["sk"])).toBeNull();
});
