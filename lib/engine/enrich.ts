import { load } from "../storage";
import type { VideoMeta } from "../types";
import { metaFromPlayerResponse, type PlayerResponse } from "./player";
import { withTextLang } from "./textLang";
import { playerResponseFromHtml } from "./watchPage";

const CONCURRENCY = 3;
const FLUSH_SIZE = 5;
const FLUSH_MS = 1000;
/** Only a failed network fetch is retried; a page without a player response is not. */
const MAX_ATTEMPTS = 2;
const ATTEMPTS_KEY = "enrichAttempts";

export interface EnrichTarget {
  videoId: string;
  /** A tab showing the video, whose page may already hold the player response. */
  tabId?: number;
}

/** Metadata is worth looking up while it lacks a length or a language. */
export function needsMeta(meta: Pick<VideoMeta, "duration" | "detectedLang"> | undefined): boolean {
  return !meta || meta.duration === 0 || meta.detectedLang === null;
}

/** Runs in the page's own world. Returns the player response for `videoId` as JSON text, or null. */
function playerResponseInPage(videoId: string): string | null {
  type Response = { videoDetails?: { videoId?: string } };
  const player = document.getElementById("movie_player") as (HTMLElement & { getPlayerResponse?: () => Response }) | null;
  const initial = (window as unknown as { ytInitialPlayerResponse?: Response }).ytInitialPlayerResponse;
  const response = [player?.getPlayerResponse?.(), initial].find((candidate) => candidate?.videoDetails?.videoId === videoId);
  return response ? JSON.stringify(response) : null;
}

/** Reads the response from an open, loaded tab. Discarded or still-loading tabs are left to the fetch. */
async function responseFromTab(tabId: number, videoId: string): Promise<PlayerResponse | null> {
  const tab = await browser.tabs.get(tabId).catch(() => undefined);
  if (!tab || tab.discarded || tab.status !== "complete") return null;
  const [result] = await browser.scripting
    .executeScript({ target: { tabId }, world: "MAIN", func: playerResponseInPage, args: [videoId] })
    .catch(() => []);
  return result?.result ? (JSON.parse(result.result) as PlayerResponse) : null;
}

async function responseFromWatchPage(videoId: string): Promise<PlayerResponse | null> {
  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`).then((response) => response.text());
  return playerResponseFromHtml(html);
}

async function lookup(target: EnrichTarget): Promise<PlayerResponse | null> {
  const awake = target.tabId === undefined ? null : await responseFromTab(target.tabId, target.videoId);
  return awake ?? responseFromWatchPage(target.videoId);
}

/**
 * Looks up metadata for videos the background has not yet seen in full. Up to
 * CONCURRENCY lookups run at once, and each video is attempted once per browser
 * session (twice when a fetch fails on the network). Finished results are handed
 * to `write` in batches, so many tabs cost a few storage writes, not one each.
 */
export function createEnrich(write: (metas: VideoMeta[]) => Promise<void>) {
  const queue: EnrichTarget[] = [];
  const queued = new Set<string>();
  const attempts = new Map<string, number>();
  let attemptsLoaded: Promise<void> | undefined;
  let found: VideoMeta[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = 0;

  function loadAttempts(): Promise<void> {
    attemptsLoaded ??= browser.storage.session.get(ATTEMPTS_KEY).then((stored) => {
      for (const [videoId, count] of Object.entries((stored[ATTEMPTS_KEY] ?? {}) as Record<string, number>)) {
        attempts.set(videoId, count);
      }
    });
    return attemptsLoaded;
  }

  async function flush(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    const batch = found;
    found = [];
    await Promise.all([
      batch.length > 0 ? write(batch) : undefined,
      browser.storage.session.set({ [ATTEMPTS_KEY]: Object.fromEntries(attempts) }),
    ]);
  }

  function schedule(): void {
    if (found.length >= FLUSH_SIZE) void flush();
    else timer ??= setTimeout(() => void flush(), FLUSH_MS);
  }

  async function work(target: EnrichTarget): Promise<void> {
    const count = (attempts.get(target.videoId) ?? 0) + 1;
    attempts.set(target.videoId, count);
    try {
      const response = await lookup(target);
      const meta = response && metaFromPlayerResponse(response);
      if (response && meta) {
        const goals = Object.keys(await load("goals"));
        found.push(withTextLang(meta, response.videoDetails?.shortDescription, goals));
      }
      attempts.set(target.videoId, MAX_ATTEMPTS);
    } catch {
      if (count < MAX_ATTEMPTS) {
        queue.push(target);
        schedule();
        return;
      }
      attempts.set(target.videoId, MAX_ATTEMPTS);
    }
    queued.delete(target.videoId);
    schedule();
  }

  function pump(): void {
    while (running < CONCURRENCY) {
      const target = queue.shift();
      if (!target) return;
      running++;
      void work(target).finally(() => {
        running--;
        pump();
      });
    }
  }

  async function enqueue(targets: EnrichTarget[]): Promise<void> {
    await loadAttempts();
    for (const target of targets) {
      if (queued.has(target.videoId) || (attempts.get(target.videoId) ?? 0) >= MAX_ATTEMPTS) continue;
      queued.add(target.videoId);
      queue.push(target);
    }
    pump();
  }

  return { enqueue };
}
