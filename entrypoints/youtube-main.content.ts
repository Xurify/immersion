import { BRIDGE } from "../lib/engine/page";
import { metaFromPlayerResponse, type PlayerResponse } from "../lib/engine/player";

/** Runs in the page's own world, the only place the player's response is reachable. */
export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  world: "MAIN",
  main() {
    window.addEventListener("message", (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== BRIDGE || event.data.kind !== "request") return;
      const player = document.getElementById("movie_player") as (HTMLElement & { getPlayerResponse?: () => PlayerResponse }) | null;
      const meta = metaFromPlayerResponse(player?.getPlayerResponse?.());
      window.postMessage({ source: BRIDGE, kind: "meta", meta }, "*");
    });
  },
});
