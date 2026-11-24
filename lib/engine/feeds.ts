/** One upload from a channel's public feed: https://www.youtube.com/feeds/videos.xml?channel_id=… */
export interface FeedEntry {
  videoId: string;
  title: string;
  /** Milliseconds since the epoch. */
  published: number;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

/** Uploads in a channel feed, newest first. The service worker has no DOMParser, so the Atom XML is read with patterns. */
export function parseFeed(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const [, block] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const videoId = tag(block!, "yt:videoId");
    if (!videoId) continue;
    entries.push({
      videoId,
      title: decode(tag(block!, "title") ?? "").trim(),
      published: Date.parse(tag(block!, "published") ?? "") || 0,
    });
  }
  return entries.sort((a, b) => b.published - a.published);
}

export function feedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

/**
 * Uploads to bring in from a feed: on the first check the newest `firstCount`,
 * afterwards anything published since the last check. Videos already seen are skipped.
 */
export function newUploads(entries: FeedEntry[], checkedAt: number | null, seen: Set<string>, firstCount = 3): FeedEntry[] {
  const fresh = entries.filter((entry) => !seen.has(entry.videoId));
  if (checkedAt === null) return fresh.slice(0, firstCount);
  return fresh.filter((entry) => entry.published > checkedAt);
}
