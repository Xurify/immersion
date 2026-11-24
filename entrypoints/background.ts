import type { Browser } from "wxt/browser";
import { grade } from "../lib/review";
import { dateKey, uid, videoIdOf } from "../lib/format";
import { load, loadSession, save, saveSession } from "../lib/storage";
import type { Requests, RequestKey } from "../lib/messages";
import { listenedSeconds } from "../lib/engine/listening";
import { flushPending, focusTab, forgetTab, runInTab, type TabCommand } from "../lib/engine/play";
import { serial } from "../lib/engine/serial";
import { advanceSession, dropFromSession, startSession } from "../lib/engine/session";
import { buildOpenVideos, resolveLang } from "../lib/engine/tabs";

type Sender = Browser.runtime.MessageSender;
type Handler<K extends RequestKey> = (payload: Requests[K]["req"], sender: Sender) => Promise<Requests[K]["res"]>;

/** Sentences saved without a known language get this undetermined code. */
const UNKNOWN_LANG = "und";

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

const handlers: { [K in RequestKey]: Handler<K> } = {
  "tabs:list": async () => {
    const [tabs, meta, live, overrides] = await Promise.all([
      browser.tabs.query({}),
      load("meta"),
      loadSession("live"),
      load("overrides"),
    ]);
    return buildOpenVideos(tabs, { meta, live, overrides });
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

  "reading:list": async () => {
    const entries = await browser.readingList.query({});
    return entries
      .flatMap((entry) => {
        const videoId = videoIdOf(entry.url);
        return !entry.hasBeenRead && videoId ? [{ url: entry.url, title: entry.title, videoId, addedAt: entry.creationTime }] : [];
      })
      .sort((a, b) => b.addedAt - a.addedAt);
  },

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

  "yt:meta": (meta) =>
    serial(async () => {
      const metas = await load("meta");
      const previous = metas[meta.videoId];
      metas[meta.videoId] = { ...meta, detectedLang: meta.detectedLang ?? previous?.detectedLang ?? null };
      await save("meta", metas);
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

  "yt:ended": (_payload, sender) => serial(() => advanceSession(sender.tab?.id)),

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
    });
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === "open-desk") void openDesk();
  });
});
