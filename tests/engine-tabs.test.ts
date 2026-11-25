import { test, expect } from "bun:test";
import { buildOpenVideos, resolveLang, type TabInfo, type TabsState } from "../lib/engine/tabs";
import type { Overrides, VideoMeta } from "../lib/types";

const WATCH = "https://www.youtube.com/watch?v=";

const meta: Record<string, VideoMeta> = {
  aaaaaaaaaaa: { videoId: "aaaaaaaaaaa", title: "Mercado", channel: "Canal A", duration: 600, detectedLang: "es" },
  bbbbbbbbbbb: { videoId: "bbbbbbbbbbb", title: "Lesson", channel: "Canal B", duration: 300, detectedLang: "fr" },
};

const noOverrides: Overrides = { videos: {}, channels: {} };

function state(overrides: Partial<TabsState> = {}): TabsState {
  return { meta, live: {}, overrides: noOverrides, ...overrides };
}

test("keeps only YouTube watch and Shorts tabs, ordered by window then tab index", () => {
  const tabs: TabInfo[] = [
    { id: 4, windowId: 2, index: 0, url: `${WATCH}bbbbbbbbbbb`, title: "x" },
    { id: 1, windowId: 1, index: 2, url: `${WATCH}aaaaaaaaaaa`, title: "x" },
    { id: 2, windowId: 1, index: 0, url: "https://example.com/", title: "Not video" },
    { id: 3, windowId: 1, index: 1, url: "https://www.youtube.com/shorts/cccccccccccc", title: "Short (1) - YouTube" },
  ];
  const videos = buildOpenVideos(tabs, state());
  expect(videos.map((video) => video.tabId)).toEqual([3, 1, 4]);
  expect(videos[0]?.isShort).toBe(true);
  expect(videos[1]?.isShort).toBe(false);
});

test("joins meta, live playback and the video override", () => {
  const tabs: TabInfo[] = [{ id: 1, windowId: 1, index: 0, url: `${WATCH}aaaaaaaaaaa&t=50s`, title: "(3) ignored - YouTube" }];
  const [video] = buildOpenVideos(tabs, state({
    live: { 1: { videoId: "aaaaaaaaaaa", position: 120, playing: true, at: 1 } },
    overrides: { videos: { aaaaaaaaaaa: "pt" }, channels: {} },
  }));
  expect(video).toEqual({
    videoId: "aaaaaaaaaaa",
    title: "Mercado",
    channel: "Canal A",
    duration: 600,
    detectedLang: "es",
    tabId: 1,
    windowId: 1,
    url: `${WATCH}aaaaaaaaaaa&t=50s`,
    lang: "pt",
    position: 120,
    remaining: 480,
    playing: true,
    asleep: false,
    isShort: false,
  });
});

test("a tab without meta uses its cleaned title, the URL start time and the video override", () => {
  const tabs: TabInfo[] = [{ id: 7, windowId: 1, index: 0, url: `${WATCH}cccccccccccc&t=75s`, title: "(2) New thing - YouTube", discarded: true }];
  const [video] = buildOpenVideos(tabs, state({ overrides: { videos: { cccccccccccc: "ko" }, channels: {} } }));
  expect(video?.title).toBe("New thing");
  expect(video?.duration).toBe(0);
  expect(video?.position).toBe(75);
  expect(video?.remaining).toBe(0);
  expect(video?.asleep).toBe(true);
  expect(video?.lang).toBe("ko");
});

test("live playback for another video in the same tab is ignored", () => {
  const tabs: TabInfo[] = [{ id: 1, windowId: 1, index: 0, url: `${WATCH}bbbbbbbbbbb`, title: "x" }];
  const [video] = buildOpenVideos(tabs, state({ live: { 1: { videoId: "aaaaaaaaaaa", position: 99, playing: true, at: 1 } } }));
  expect(video?.position).toBe(0);
  expect(video?.playing).toBe(false);
});

test("a tab that stopped reporting is not playing", () => {
  const tabs: TabInfo[] = [{ id: 1, windowId: 1, index: 0, url: `${WATCH}bbbbbbbbbbb`, title: "x" }];
  const live = { 1: { videoId: "bbbbbbbbbbb", position: 10, playing: true, at: 1_000_000 } };
  expect(buildOpenVideos(tabs, state({ live }), 1_010_000)[0]?.playing).toBe(true);
  expect(buildOpenVideos(tabs, state({ live }), 1_200_000)[0]?.playing).toBe(false);
});

test("remaining never goes negative", () => {
  const tabs: TabInfo[] = [{ id: 1, windowId: 1, index: 0, url: `${WATCH}bbbbbbbbbbb`, title: "x" }];
  const [video] = buildOpenVideos(tabs, state({ live: { 1: { videoId: "bbbbbbbbbbb", position: 999, playing: false, at: 1 } } }));
  expect(video?.remaining).toBe(0);
});

test("resolveLang prefers video, then channel, then detected", () => {
  const overrides: Overrides = { videos: { v1: "de" }, channels: { Chan: "it" } };
  expect(resolveLang("v1", "Chan", "es", overrides)).toBe("de");
  expect(resolveLang("v2", "Chan", "es", overrides)).toBe("it");
  expect(resolveLang("v2", "Other", "es", overrides)).toBe("es");
  expect(resolveLang("v2", "Other", null, overrides)).toBeNull();
});
