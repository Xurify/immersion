import type { Browser } from "wxt/browser";
import { grade } from "../lib/review";
import { dateKey, uid, videoIdOf } from "../lib/format";
import { load, loadSession, save, saveSession } from "../lib/storage";
import type { Requests, RequestKey } from "../lib/messages";
import { cardFromTab, move, pruneDone, remove, resumeUrl, setPosition, upsert, type Board, type Card } from "../lib/board";
import { listenedSeconds } from "../lib/engine/listening";
import { createEnrich, needsMeta } from "../lib/engine/enrich";
import { injectIntoYouTubeTabs } from "../lib/engine/inject";
import { mergeMeta } from "../lib/engine/player";
import { withTextLang } from "../lib/engine/textLang";
import { flushPending, focusTab, forgetTab, runInTab, type TabCommand } from "../lib/engine/play";
import { serial } from "../lib/engine/serial";
import { advanceSession, dropFromSession, startSession } from "../lib/engine/session";
import { backToNext, fillCard, finishCard, placeCard, refreshCard, startCard, stashTargets, type Playing } from "../lib/engine/cards";
import { buildOpenVideos, resolveLang } from "../lib/engine/tabs";
import type { OpenVideo, ReadingItem, VideoMeta } from "../lib/types";

type Sender = Browser.runtime.MessageSender;
type Handler<K extends RequestKey> = (payload: Requests[K]["req"], sender: Sender) => Promise<Requests[K]["res"]>;

/** Sentences saved without a known language get this undetermined code. */
const UNKNOWN_LANG = "und";
const PLAY: TabCommand = { type: "video:play", payload: {} };
/** Not in TabCommands: only the background sends it, and the YouTube content script handles it. */
const PAUSE = { type: "video:pause", payload: {} };

async function openDesk(view?: string): Promise<void> {
  const base = browser.runtime.getURL("/desk.html");
  const target = view ? `${base}#${view}` : base;
  const existing = (await browser.tabs.query({})).find((tab) => tab.id !== undefined && tab.url?.startsWith(base));
  if (existing?.id !== undefined) {
    await focusTab(existing.id);
    if (view && existing.url !== target) await browser.tabs.update(existing.id, { url: target });
  } else {
    await browser.tabs.create({ url: target });
  }
}

/** Every board write goes through here, so Done never keeps cards from earlier days. */
function writeBoard(board: Board): Promise<void> {
  return save("board", pruneDone(board));
}

async function openVideos(): Promise<OpenVideo[]> {
  const [tabs, meta, live, overrides] = await Promise.all([
    browser.tabs.query({}),
    load("meta"),
    loadSession("live"),
    load("overrides"),
  ]);
  return buildOpenVideos(tabs, { meta, live, overrides });
}

/** Enrichment results: one serial write for the batch's metadata, then the board cards that still lack a language or length. */
async function saveFound(found: VideoMeta[]): Promise<void> {
  await serial(async () => {
    const metas = await load("meta");
    for (const meta of found) metas[meta.videoId] = mergeMeta(metas[meta.videoId], meta);
    await save("meta", metas);
    const [overrides, board] = await Promise.all([load("overrides"), load("board")]);
    let updated = board;
    for (const meta of found) updated = fillCard(updated, meta.videoId, metas[meta.videoId], overrides);
    if (updated !== board) await writeBoard(updated);
  });
}

const enrich = createEnrich(saveFound);
let injected = false;

async function audibleFocusedTabIds(): Promise<number[]> {
  const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true, audible: true });
  return tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]));
}

/** Unread YouTube items from Chrome's reading list, newest first. */
async function unreadVideos(): Promise<(ReadingItem & { videoId: string })[]> {
  const entries = await browser.readingList.query({});
  return entries
    .flatMap((entry) => {
      const videoId = videoIdOf(entry.url);
      return !entry.hasBeenRead && videoId ? [{ url: entry.url, title: entry.title, videoId, addedAt: entry.creationTime }] : [];
    })
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** The tab already showing a card's video, or a new one at its resume point in the last focused window. */
async function tabFor(card: Card, open: OpenVideo[]): Promise<number> {
  const existing = open.find((video) => video.videoId === card.videoId);
  if (existing) return existing.tabId;
  const last = await browser.windows.getLastFocused({ windowTypes: ["normal"] });
  const tab = await browser.tabs.create({ url: resumeUrl(card), windowId: last.id });
  if (tab.id === undefined) throw new Error("Could not open the video");
  return tab.id;
}

async function closeTabsFor(videoId: string): Promise<void> {
  const tabIds = (await openVideos()).filter((video) => video.videoId === videoId).map((video) => video.tabId);
  if (tabIds.length > 0) await browser.tabs.remove(tabIds);
}

/** A tab may have no content script (closed or discarded), so a failed pause is ignored. */
async function pauseTab(tabId: number): Promise<void> {
  await browser.tabs.sendMessage(tabId, PAUSE).catch(() => {});
}

/** The playing card stops being "Listening now": its tab pauses and stays open. */
async function stopPlaying(playing: Playing): Promise<void> {
  await saveSession("playing", null);
  await pauseTab(playing.tabId);
}

/** Plays a card (default: top of Up next). The card that was playing goes back to the top of Up next. */
async function play(videoId: string | undefined): Promise<void> {
  const board = await load("board");
  const id = videoId ?? board.columns.next[0];
  const card = id ? board.cards[id] : undefined;
  if (!card) {
    if (videoId) throw new Error("That video is not on the board");
    return;
  }
  const playing = await loadSession("playing");
  const tabId = await tabFor(card, await openVideos());
  if (playing && playing.tabId !== tabId) await pauseTab(playing.tabId);
  await saveSession("playing", { videoId: card.videoId, tabId });
  await writeBoard(startCard(board, card.videoId, playing?.videoId ?? null));
  await runInTab(tabId, PLAY);
}

/**
 * The playing card is finished: it goes to Done and the next card plays in its own tab.
 * The finished tab closes last, so the window never closes.
 */
async function advance(playing: Playing): Promise<void> {
  const { board, next } = finishCard(await load("board"), playing.videoId, Date.now());
  const card = next ? board.cards[next] : undefined;
  const tabId = card ? await tabFor(card, await openVideos()) : undefined;
  await saveSession("playing", card && tabId !== undefined ? { videoId: card.videoId, tabId } : null);
  await writeBoard(board);
  if (tabId !== undefined) await runInTab(tabId, PLAY);
  // The tab may already be gone, which leaves nothing to close.
  await browser.tabs.remove(playing.tabId).catch(() => {});
}

const handlers: { [K in RequestKey]: Handler<K> } = {
  "tabs:list": async () => {
    if (!injected) {
      injected = true;
      void injectIntoYouTubeTabs(false);
    }
    const [videos, board, meta] = await Promise.all([openVideos(), load("board"), load("meta")]);
    void enrich.enqueue([
      ...videos.filter((video) => needsMeta(video)).map((video) => ({ videoId: video.videoId, tabId: video.tabId })),
      ...Object.values(board.cards)
        .filter((card) => (!card.lang || !card.duration) && needsMeta(meta[card.videoId]))
        .map((card) => ({ videoId: card.videoId })),
    ]);
    return videos;
  },

  "tabs:focus": ({ tabId }) => focusTab(tabId),

  "tabs:close": async ({ tabIds }) => {
    await browser.tabs.remove(tabIds);
    await serial(() => dropFromSession(tabIds));
  },

  "session:start": ({ tabIds }) => serial(() => startSession(tabIds)),

  "session:stop": () => serial(() => saveSession("active", null)),

  "session:open": async ({ sessionId }) => {
    const session = (await load("sessions")).find((item) => item.id === sessionId);
    if (!session) throw new Error("Session not found");
    await browser.windows.create({ url: session.videos.map((video) => video.url) });
  },

  "reading:list": () => unreadVideos(),

  "reading:remove": ({ url }) => browser.readingList.removeEntry({ url }),

  "clip:play": async ({ sentenceId }) => {
    const sentence = (await load("sentences")).find((item) => item.id === sentenceId);
    if (!sentence) throw new Error("Sentence not found");
    const command: TabCommand = { type: "clip:play", payload: { start: sentence.start, end: sentence.end } };
    const open = (await browser.tabs.query({})).find((tab) => tab.id !== undefined && videoIdOf(tab.url ?? "") === sentence.videoId);
    if (open?.id !== undefined) return runInTab(open.id, command);
    const tab = await browser.tabs.create({
      url: `https://www.youtube.com/watch?v=${sentence.videoId}&t=${Math.floor(sentence.start)}s`,
      active: true,
    });
    if (tab.id !== undefined) await runInTab(tab.id, command);
  },

  "review:grade": ({ sentenceId, grade: rating }) =>
    serial(async () => {
      const sentences = await load("sentences");
      const index = sentences.findIndex((item) => item.id === sentenceId);
      const current = sentences[index];
      if (!current) throw new Error("Sentence not found");
      const updated = grade(current, rating);
      sentences[index] = updated;
      await save("sentences", sentences);
      return updated;
    }),

  "lang:override": ({ videoId, channel, lang, scope }) =>
    serial(async () => {
      const overrides = await load("overrides");
      const map = scope === "video" ? overrides.videos : overrides.channels;
      const key = scope === "video" ? videoId : channel;
      if (lang) map[key] = lang;
      else delete map[key];
      await save("overrides", overrides);
    }),

  "desk:open": ({ view }) => openDesk(view),

  "board:stash": ({ videoIds }) =>
    serial(async () => {
      const [videos, playing, audible] = await Promise.all([openVideos(), loadSession("playing"), audibleFocusedTabIds()]);
      const targets = stashTargets(videos, videoIds, [...(playing ? [playing.tabId] : []), ...audible]);
      if (targets.length === 0) return { stashed: 0 };
      const now = Date.now();
      let board = await load("board");
      for (const video of targets) board = refreshCard(board, cardFromTab(video, now), "inbox", now);
      await writeBoard(board);
      await browser.tabs.remove(targets.map((video) => video.tabId));
      return { stashed: targets.length };
    }),

  "board:add": ({ videoIds, column, index }) =>
    serial(async () => {
      const [open, playing] = await Promise.all([openVideos(), loadSession("playing")]);
      const now = Date.now();
      const seen = new Set<string>();
      let board = await load("board");
      let at = index;
      for (const video of open) {
        if (!videoIds.includes(video.videoId) || video.videoId === playing?.videoId || seen.has(video.videoId)) continue;
        seen.add(video.videoId);
        board = placeCard(board, cardFromTab(video, now), column, at, now);
        if (at !== undefined) at++;
      }
      await writeBoard(board);
    }),

  "board:move": ({ videoId, column, index }) =>
    serial(async () => {
      const playing = await loadSession("playing");
      const current = playing?.videoId === videoId ? playing : null;
      if (current && column === "done") return advance(current);
      const board = await load("board");
      if (!board.cards[videoId]) return;
      if (current) await stopPlaying(current);
      await writeBoard(move(board, videoId, column, index));
      if (column === "later" || column === "done") await closeTabsFor(videoId);
    }),

  "board:remove": ({ videoId, closeTab }) =>
    serial(async () => {
      const playing = await loadSession("playing");
      if (playing?.videoId === videoId) await stopPlaying(playing);
      await writeBoard(remove(await load("board"), videoId));
      if (closeTab) await closeTabsFor(videoId);
    }),

  "board:play": ({ videoId }) => serial(() => play(videoId)),

  "board:pause": () =>
    serial(async () => {
      const playing = await loadSession("playing");
      if (!playing) return;
      await stopPlaying(playing);
      await writeBoard(backToNext(await load("board"), playing.videoId));
    }),

  "board:skip": () =>
    serial(async () => {
      const playing = await loadSession("playing");
      if (playing) await advance(playing);
    }),

  "board:import-reading": () =>
    serial(async () => {
      const unread = await unreadVideos();
      const [before, metas, overrides] = await Promise.all([load("board"), load("meta"), load("overrides")]);
      const now = Date.now();
      let board = before;
      let added = 0;
      for (const item of unread) {
        if (board.cards[item.videoId]) continue;
        added++;
        const meta = metas[item.videoId];
        const channel = meta?.channel ?? "";
        board = upsert(
          board,
          {
            url: `https://www.youtube.com/watch?v=${item.videoId}`,
            videoId: item.videoId,
            title: item.title,
            channel,
            duration: meta?.duration ?? 0,
            lang: resolveLang(item.videoId, channel, meta?.detectedLang ?? null, overrides),
            position: 0,
          },
          "inbox",
          now,
        );
      }
      if (added > 0) await writeBoard(board);
      void enrich.enqueue(unread.filter((item) => needsMeta(metas[item.videoId])).map((item) => ({ videoId: item.videoId })));
      for (const item of unread) await browser.readingList.updateEntry({ url: item.url, hasBeenRead: true });
      return { added };
    }),

  "yt:meta": (meta, sender) =>
    serial(async () => {
      const [metas, goals] = await Promise.all([load("meta"), load("goals")]);
      metas[meta.videoId] = mergeMeta(metas[meta.videoId], withTextLang(meta, undefined, Object.keys(goals)));
      await save("meta", metas);

      const board = await load("board");
      let updated = fillCard(board, meta.videoId, metas[meta.videoId], await load("overrides"));
      const playing = await loadSession("playing");
      // The playing tab navigated to another video, so the card it was playing is no longer on screen.
      if (playing && playing.tabId === sender.tab?.id && playing.videoId !== meta.videoId) {
        await saveSession("playing", null);
        updated = backToNext(updated, playing.videoId);
      }
      if (updated !== board) await writeBoard(updated);
    }),

  "yt:tick": ({ videoId, position, playing }, sender) =>
    serial(async () => {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return;
      const at = Date.now();
      const live = await loadSession("live");
      const previous = live[tabId];
      live[tabId] = { videoId, position, playing, at };
      await saveSession("live", live);

      const board = await load("board");
      if (board.cards[videoId]) {
        const [metas, overrides] = await Promise.all([load("meta"), load("overrides")]);
        const updated = fillCard(setPosition(board, videoId, position), videoId, metas[videoId], overrides);
        if (updated !== board) await writeBoard(updated);
      }

      const seconds = listenedSeconds(previous, { videoId, playing, at });
      if (seconds <= 0) return;
      const [meta, overrides] = await Promise.all([load("meta"), load("overrides")]);
      const lang = resolveLang(videoId, meta[videoId]?.channel ?? "", meta[videoId]?.detectedLang ?? null, overrides);
      if (!lang) return;
      const log = await load("log");
      const day = log[dateKey()] ?? {};
      day[lang] = (day[lang] ?? 0) + seconds;
      log[dateKey()] = day;
      await save("log", log);
    }),

  "yt:ended": ({ videoId }, sender) =>
    serial(async () => {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return;
      await advanceSession(tabId);
      const playing = await loadSession("playing");
      if (playing && playing.tabId === tabId && playing.videoId === videoId) return advance(playing);
      const video = (await openVideos()).find((open) => open.tabId === tabId && open.videoId === videoId);
      if (!video) return;
      const now = Date.now();
      await writeBoard(placeCard(await load("board"), cardFromTab(video, now), "done", undefined, now));
    }),

  "yt:save-sentence": (payload) =>
    serial(async () => {
      const [sentences, metas, overrides] = await Promise.all([load("sentences"), load("meta"), load("overrides")]);
      const duplicate = sentences.some((item) => item.videoId === payload.videoId && Math.abs(item.start - payload.start) < 1);
      if (duplicate) return { saved: false };
      const lang = resolveLang(payload.videoId, payload.channel, metas[payload.videoId]?.detectedLang ?? payload.lang, overrides);
      const now = Date.now();
      sentences.push({
        id: uid(),
        text: payload.text,
        translation: payload.translation,
        lang: lang ?? UNKNOWN_LANG,
        videoId: payload.videoId,
        videoTitle: payload.videoTitle,
        channel: payload.channel,
        start: payload.start,
        end: payload.end,
        createdAt: now,
        step: 0,
        dueAt: now,
        reviews: 0,
      });
      await save("sentences", sentences);
      return { saved: true };
    }),
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void injectIntoYouTubeTabs(true);
  });
  browser.runtime.onStartup.addListener(() => {
    void injectIntoYouTubeTabs(false);
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const { type, payload } = (message ?? {}) as { type?: unknown; payload?: unknown };
    if (typeof type !== "string" || !Object.hasOwn(handlers, type)) return false;

    if (sender.tab?.id !== undefined) void flushPending(sender.tab.id);
    const handler = handlers[type as RequestKey] as (payload: unknown, sender: Sender) => Promise<unknown>;
    handler(payload, sender).then(
      (value) => sendResponse({ ok: true, value }),
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
    return true;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    forgetTab(tabId);
    void serial(async () => {
      const live = await loadSession("live");
      if (tabId in live) {
        delete live[tabId];
        await saveSession("live", live);
      }
      await dropFromSession([tabId]);
      const playing = await loadSession("playing");
      if (playing?.tabId === tabId) {
        await saveSession("playing", null);
        await writeBoard(backToNext(await load("board"), playing.videoId));
      }
    });
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === "open-desk") void openDesk();
  });
});
