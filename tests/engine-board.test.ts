import { expect, test } from "bun:test";
import { columnOf, emptyBoard, stashKeepTabIds, upsert, type Board, type Card } from "../lib/board";
import { finishCard, refreshCard, startCard, stashTargets } from "../lib/engine/cards";
import type { OpenVideo } from "../lib/types";

const card = (videoId: string): Omit<Card, "addedAt"> => ({
  url: "", videoId, title: videoId, channel: "c", duration: 600, lang: "es", position: 0,
});

function openTab(tabId: number, videoId: string): OpenVideo {
  return {
    videoId, title: videoId, channel: "c", duration: 600, detectedLang: "es", lang: "es",
    tabId, windowId: 1, url: "", position: 0, remaining: 600, playing: false, asleep: false, isShort: false,
  };
}

function queue(ids: string[]): Board {
  return ids.reduce((board, id) => upsert(board, card(id), "next"), emptyBoard());
}

test("stash takes every tab except the playing one and the audible focused one", () => {
  const videos = [openTab(1, "a"), openTab(2, "b"), openTab(3, "c"), openTab(4, "d")];
  expect(stashTargets(videos, undefined, [2, 4]).map((video) => video.videoId)).toEqual(["a", "c"]);
});

test("stash keeps the session tab and tabs you can hear, but takes silent tabs that report playing", () => {
  const videos = [openTab(1, "a"), { ...openTab(2, "b"), playing: true }, { ...openTab(3, "c"), audible: true }, openTab(4, "d")];
  const keep = stashKeepTabIds({ videoId: "d", tabId: 4 }, videos, ["es"]);
  expect(stashTargets(videos, undefined, keep).map((video) => video.videoId)).toEqual(["a", "b"]);
});

test("with no session, stash keeps the tab playing in a goal language", () => {
  const videos = [openTab(1, "a"), { ...openTab(2, "b"), playing: true }];
  const keep = stashKeepTabIds(null, videos, ["es"]);
  expect(stashTargets(videos, undefined, keep).map((video) => video.videoId)).toEqual(["a"]);
});

test("stash with ids takes only those videos and still spares kept tabs", () => {
  const videos = [openTab(1, "a"), openTab(2, "b"), openTab(3, "c")];
  expect(stashTargets(videos, ["b", "c"], [2]).map((video) => video.videoId)).toEqual(["c"]);
});

test("an ended card goes to Done, and the top of Up next plays next", () => {
  const playing = startCard(queue(["a", "b", "c"]), "a", null);
  expect(playing.columns.next).toEqual(["b", "c"]);

  const { board, next } = finishCard(playing, "a", 1000);
  expect(next).toBe("b");
  expect(board.columns.done).toEqual(["a"]);
  expect(board.cards.a?.doneAt).toBe(1000);
  expect(board.columns.next).toEqual(["c"]);
  expect(columnOf(board, "b")).toBeNull();
});

test("an ended card with nothing left in Up next plays no next card", () => {
  const { board, next } = finishCard(startCard(queue(["a"]), "a", null), "a", 1000);
  expect(next).toBeNull();
  expect(board.columns.next).toEqual([]);
  expect(board.columns.done).toEqual(["a"]);
});

test("playing another card puts the one that was playing back at the top of Up next", () => {
  const playing = startCard(queue(["p", "x", "y"]), "p", null);
  const board = startCard(playing, "y", "p");
  expect(board.columns.next).toEqual(["p", "x"]);
  expect(columnOf(board, "y")).toBeNull();
});

test("a playing card refreshed from a tab stays out of the columns", () => {
  const playing = startCard(queue(["p"]), "p", null);
  const board = refreshCard(playing, card("p"), "inbox", 0);
  expect(columnOf(board, "p")).toBeNull();
  expect(board.columns.inbox).toEqual([]);
});

test("stash with goals takes only tabs in a goal language, but picked ids ignore language", () => {
  const videos = [openTab(1, "a"), { ...openTab(2, "b"), lang: "fr" }, { ...openTab(3, "c"), lang: null }];
  expect(stashTargets(videos, undefined, [], ["es"]).map((video) => video.videoId)).toEqual(["a"]);
  expect(stashTargets(videos, undefined, [], []).map((video) => video.videoId)).toEqual(["a", "b", "c"]);
  expect(stashTargets(videos, ["b"], [], ["es"]).map((video) => video.videoId)).toEqual(["b"]);
});
