const SHOW_MS = 2500;

let host: HTMLElement | null = null;
let hideTimer: number | undefined;

/**
 * Shown inside the player, not on body: a fullscreen element hides everything outside itself.
 * A shadow root keeps YouTube's styles away from the pill.
 */
export function showToast(message: string): void {
  const player = document.getElementById("movie_player") ?? document.body;
  if (!host) {
    host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:2147483647";
    host.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        .pill {
          position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%);
          padding: 8px 16px; border-radius: 999px; white-space: nowrap;
          background: rgba(17, 17, 17, 0.9); color: #fff;
          font: 500 15px/1.3 system-ui, sans-serif;
        }
      </style>
      <div class="pill"></div>`;
  }
  const pill = host.shadowRoot?.querySelector(".pill");
  if (pill) pill.textContent = message;
  player.append(host);
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => host?.remove(), SHOW_MS);
}
