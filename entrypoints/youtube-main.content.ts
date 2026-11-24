import { BRIDGE, LIVE_FLAG } from "../lib/engine/page";
import { metaFromPlayerResponse, type PlayerResponse } from "../lib/engine/player";

/** Runs in the page's own world, the only place the player's response is reachable. */
export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  world: "MAIN",
  main() {
    const live = window as unknown as Record<string, (() => void) | undefined>;
    live[LIVE_FLAG]?.();

    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== BRIDGE || event.data.kind !== "request") return;
      const player = document.getElementById("movie_player") as (HTMLElement & { getPlayerResponse?: () => PlayerResponse }) | null;
      const meta = metaFromPlayerResponse(player?.getPlayerResponse?.());
      window.postMessage({ source: BRIDGE, kind: "meta", meta }, "*");
    };
    window.addEventListener("message", listener);
    live[LIVE_FLAG] = () => window.removeEventListener("message", listener);
  },
});
