import { expect, test } from "bun:test";
import { ankiTsv, clozemasterCsv } from "../lib/export";
import type { Sentence } from "../lib/types";

const sentence = (text: string, translation: string): Sentence => ({
  id: text, text, translation, lang: "cs", videoId: "abc", videoTitle: "Vaříme\ts Petrem", channel: "c",
  start: 75.4, end: 78, createdAt: 0, step: 0, dueAt: 0, reviews: 0,
});

test("Anki export is tab-separated with a link to the moment", () => {
  const tsv = ankiTsv([sentence("To je \"dobrý\" nápad.", "That's a good idea.")]);
  const lines = tsv.trim().split("\n");
  expect(lines[0]).toBe("#separator:tab");
  expect(lines[3]).toBe('To je "dobrý" nápad.\tThat\'s a good idea.\tVaříme s Petrem (1:15)\thttps://www.youtube.com/watch?v=abc&t=75s');
});

test("Clozemaster export quotes fields and skips sentences without a translation", () => {
  const { csv, skipped } = clozemasterCsv([sentence('Řekl "ahoj", pak odešel.', "He said hi, then left."), sentence("Bez překladu.", " ")]);
  expect(csv).toBe('"Řekl ""ahoj"", pak odešel.","He said hi, then left."\n');
  expect(skipped).toBe(1);
});
