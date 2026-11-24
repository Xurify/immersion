import { videoIdOf } from "../../lib/format";
import { send, type RequestKey, type Requests, type TabCommands } from "../../lib/messages";
import { BRIDGE, LIVE_FLAG, captionLine, isTypingTarget } from "../../lib/engine/page";
import { showToast } from "../../lib/engine/toast";
import { cleanTitle } from "../../lib/engine/title";
import type { VideoMeta } from "../../lib/types";

const TICK_MS = 5_000;
/** The page swaps videos without a reload, so the player can report the old one for a while. */
const META_RETRY_MS = 500;
const META_TRIES = 20;
const WAIT_FOR_PLAYER_MS = 250;
const WAIT_FOR_PLAYER_TRIES = 40;
/** With no caption line seen, a saved sentence starts this far back. */
const CAPTION_LEAD_S = 3;
/** Captions often end a moment after the last word is spoken. */
const CLIP_PAD_S = 0.5;
/** A seek can land on a keyframe a little before its target. */
const CLIP_SEEK_SLACK_S = 2;
/** Shorts loop instead of ending: a jump from this close to the end back to this close to the start is one full watch. */
const LOOP_EDGE_S = 1.5;

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  main() {
    const live = window as unknown as Record<string, (() => void) | undefined>;
    live[LIVE_FLAG]?.();

    let alive = true;
    let video: HTMLVideoElement | null = null;
    let meta: VideoMeta | null = null;
    let reportedFor: string | null = null;
    let clip: { start: number; end: number } | null = null;
    let captionText = "";
    let captionStart: number | null = null;
    let endedFor: string | null = null;
    let lastTime = 0;

    const currentVideoId = () => videoIdOf(location.href);

    function stop() {
      alive = false;
      clip = null;
      window.clearInterval(timer);
      captions.disconnect();
    }
    live[LIVE_FLAG] = stop;

    function guard(error: unknown) {
      if (String(error).includes("invalidated") || !browser.runtime?.id) stop();
    }

    function report<K extends RequestKey>(type: K, payload: Requests[K]["req"]) {
      if (alive) send(type, payload).catch(guard);
    }

    function attachVideo() {
      const found = document.querySelector("video");
      if (!found || found === video) return;
      video = found;
      found.addEventListener("play", tick);
      found.addEventListener("pause", tick);
      found.addEventListener("ended", onEnded);
      found.addEventListener("timeupdate", endClipIfDone);
      found.addEventListener("timeupdate", catchLoop);
      found.addEventListener("seeked", dropClipIfSeekAway);
    }

    function tick() {
      attachVideo();
      const videoId = currentVideoId();
      if (!alive || !videoId || !video) return;
      const watching = document.visibilityState === "visible" || Boolean(document.pictureInPictureElement);
      report("yt:tick", { videoId, position: video.currentTime, playing: !video.paused && !video.ended, watching });
    }

    /** Reported once per video, whether it ended or looped. */
    function onEnded() {
      const videoId = currentVideoId();
      if (!videoId || endedFor === videoId) return;
      endedFor = videoId;
      report("yt:ended", { videoId });
    }

    function catchLoop() {
      if (!video) return;
      const now = video.currentTime;
      const length = video.duration;
      if (Number.isFinite(length) && length > LOOP_EDGE_S * 2 && lastTime >= length - LOOP_EDGE_S && now <= LOOP_EDGE_S) onEnded();
      lastTime = now;
    }

    function readMeta(videoId: string, tries = 0) {
      window.postMessage({ source: BRIDGE, kind: "request" }, "*");
      if (tries >= META_TRIES) return;
      window.setTimeout(() => {
        if (alive && reportedFor !== videoId && currentVideoId() === videoId) readMeta(videoId, tries + 1);
      }, META_RETRY_MS);
    }

    function onNavigate() {
      if (!alive) return;
      meta = null;
      reportedFor = null;
      lastTime = 0;
      attachVideo();
      const videoId = currentVideoId();
      if (videoId) readMeta(videoId);
    }

    function whenPlayerReady(run: (player: HTMLVideoElement) => void, tries = 0) {
      const player = document.querySelector("video");
      if (player && player.readyState >= HTMLMediaElement.HAVE_METADATA) {
        attachVideo();
        run(player);
        return;
      }
      if (alive && tries < WAIT_FOR_PLAYER_TRIES) {
        window.setTimeout(() => whenPlayerReady(run, tries + 1), WAIT_FOR_PLAYER_MS);
      }
    }

    function playClip(start: number, end: number) {
      clip = { start, end };
      whenPlayerReady((player) => {
        player.currentTime = start;
        player.play().catch(() => {});
      });
    }

    function endClipIfDone() {
      if (clip && video && video.currentTime >= clip.end) {
        video.pause();
        clip = null;
      }
    }

    function dropClipIfSeekAway() {
      if (clip && video && (video.currentTime < clip.start - CLIP_SEEK_SLACK_S || video.currentTime > clip.end)) clip = null;
    }

    function onTabCommand(message: unknown) {
      const command = message as { type?: string; payload?: TabCommands["clip:play"] } | undefined;
      if (!alive) return false;
      if (command?.type === "video:play") {
        clip = null;
        whenPlayerReady((player) => {
          player.play().catch(() => {});
        });
      } else if (command?.type === "video:pause") {
        video?.pause();
      } else if (command?.type === "clip:play" && command.payload) {
        playClip(command.payload.start, command.payload.end);
      }
      return false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "s" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      const videoId = currentVideoId();
      if (!videoId || !video || !alive) return;

      const text = captionLine([...document.querySelectorAll(".ytp-caption-segment")].map((segment) => segment.textContent));
      if (!text) {
        showToast("Turn on captions to save a sentence");
        return;
      }
      const known = meta?.videoId === videoId ? meta : null;
      const now = video.currentTime;
      const start = text === captionText && captionStart !== null ? captionStart : now - CAPTION_LEAD_S;
      send("yt:save-sentence", {
        text,
        translation: "",
        lang: known?.detectedLang ?? null,
        videoId,
        videoTitle: known?.title ?? cleanTitle(document.title),
        channel: known?.channel ?? "",
        start,
        end: now + CLIP_PAD_S,
      }).then(
        (reply) => showToast(reply.saved ? "Saved to Review" : "Already saved"),
        (error: unknown) => {
          guard(error);
          showToast("Could not save");
        },
      );
    }

    // The page's caption window rewrites its text as lines change; a line's start is when its text first appeared.
    const captions = new MutationObserver(() => {
      const text = captionLine([...document.querySelectorAll(".ytp-caption-segment")].map((segment) => segment.textContent));
      if (text === captionText) return;
      captionText = text;
      captionStart = text && video ? video.currentTime : null;
    });
    captions.observe(document.body, { childList: true, subtree: true, characterData: true });

    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data as { source?: string; kind?: string; meta?: VideoMeta | null } | null;
      if (!alive || event.source !== window || data?.source !== BRIDGE || data.kind !== "meta") return;
      const videoId = currentVideoId();
      if (!data.meta || data.meta.videoId !== videoId || reportedFor === videoId) return;
      reportedFor = videoId;
      meta = data.meta;
      report("yt:meta", data.meta);
    });

    browser.runtime.onMessage.addListener(onTabCommand);
    document.addEventListener("yt-navigate-finish", onNavigate);
    window.addEventListener("keydown", onKeyDown, true);
    const timer = window.setInterval(tick, TICK_MS);
    onNavigate();
  },
});
