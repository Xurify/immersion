import { expect, test } from "bun:test";
import { newUploads, parseFeed } from "../lib/engine/feeds";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <title>Kanál</title>
 <entry>
  <id>yt:video:aaa</id>
  <yt:videoId>aaa</yt:videoId>
  <title>Starší diel &amp; &quot;otázky&quot;</title>
  <published>2026-11-20T10:00:00+00:00</published>
 </entry>
 <entry>
  <id>yt:video:bbb</id>
  <yt:videoId>bbb</yt:videoId>
  <title>Nový diel &#233;</title>
  <published>2026-11-23T10:00:00+00:00</published>
 </entry>
</feed>`;

test("A channel feed reads as uploads, newest first, with entities decoded", () => {
  const entries = parseFeed(xml);
  expect(entries.map((entry) => entry.videoId)).toEqual(["bbb", "aaa"]);
  expect(entries[1]!.title).toBe('Starší diel & "otázky"');
  expect(entries[0]!.title).toBe("Nový diel é");
});

test("The first check brings the newest few; later ones only what is new", () => {
  const entries = parseFeed(xml);
  expect(newUploads(entries, null, new Set(), 1).map((entry) => entry.videoId)).toEqual(["bbb"]);
  expect(newUploads(entries, Date.parse("2026-11-21T00:00:00Z"), new Set()).map((entry) => entry.videoId)).toEqual(["bbb"]);
  expect(newUploads(entries, Date.parse("2026-11-21T00:00:00Z"), new Set(["bbb"]))).toEqual([]);
});
