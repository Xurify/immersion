import { videoIdOf } from "../format";
import type { SessionShape } from "../storage";
import type { Lang, OpenVideo, Overrides, VideoMeta } from "../types";
import { cleanTitle } from "./title";

export interface TabInfo {
  id?: number;
  windowId: number;
  index: number;
  url?: string;
  title?: string;
  discarded?: boolean;
}

export interface TabsState {
  meta: Record<string, VideoMeta>;
  live: SessionShape["live"];
  overrides: Overrides;
}

export function resolveLang(videoId: string, channel: string, detected: Lang | null, overrides: Overrides): Lang | null {
  return overrides.videos[videoId] ?? overrides.channels[channel] ?? detected;
}

/** Start time from a watch URL's `t=83` or `t=83s`, in seconds. */
export function urlStart(url: string): number {
  const match = /^(\d+)s?$/.exec(new URL(url).searchParams.get("t") ?? "");
  return match ? Number(match[1]) : 0;
}

/**
 * A tab ticks every 5 s, but Chrome can slow a hidden tab's timers to once a minute; a report
 * older than this comes from a tab that stopped reporting, such as one the extension reloaded under.
 */
const LIVE_FRESH_MS = 75_000;

/** Without `now`, every report counts as fresh. */
export function buildOpenVideos(tabs: TabInfo[], state: TabsState, now?: number): OpenVideo[] {
  const videos: OpenVideo[] = [];
  const ordered = [...tabs].sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  for (const tab of ordered) {
    const url = tab.url ?? "";
    const videoId = videoIdOf(url);
    if (tab.id === undefined || !videoId) continue;

    const meta = state.meta[videoId];
    const beat = state.live[tab.id];
    const live = beat?.videoId === videoId ? beat : undefined;
    const channel = meta?.channel ?? "";
    const detectedLang = meta?.detectedLang ?? null;
    const duration = meta?.duration ?? 0;
    const position = live?.position ?? urlStart(url);

    videos.push({
      videoId,
      title: meta?.title ?? cleanTitle(tab.title ?? ""),
      channel,
      duration,
      detectedLang,
      tabId: tab.id,
      windowId: tab.windowId,
      url,
      lang: resolveLang(videoId, channel, detectedLang, state.overrides),
      position,
      remaining: Math.max(0, duration - position),
      playing: Boolean(live?.playing && (now === undefined || now - live.at < LIVE_FRESH_MS)),
      asleep: tab.discarded ?? false,
      isShort: new URL(url).pathname.startsWith("/shorts/"),
    });
  }
  return videos;
}
