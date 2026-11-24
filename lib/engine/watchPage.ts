import type { PlayerResponse } from "./player";

const START = /ytInitialPlayerResponse\s*=\s*\{/g;

/** The JSON object that opens at `start` (a "{"), or null when it never closes. Braces inside strings don't count. */
export function jsonObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** The player response a watch page embeds as `ytInitialPlayerResponse = {...}`, or null (consent and blocked pages have none). */
export function playerResponseFromHtml(html: string): PlayerResponse | null {
  for (const match of html.matchAll(START)) {
    const json = jsonObjectAt(html, match.index + match[0].length - 1);
    if (!json) continue;
    try {
      return JSON.parse(json) as PlayerResponse;
    } catch {
      // A look-alike assignment that isn't JSON; the next match may be the real one.
    }
  }
  return null;
}
