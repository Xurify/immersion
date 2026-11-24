import { test, expect } from "bun:test";
import { jsonObjectAt, playerResponseFromHtml } from "../lib/engine/watchPage";

test("jsonObjectAt ends the object at its matching brace, skipping braces inside strings", () => {
  const text = 'var x = {"a":"}{","b":{"c":"\\"}"}} trailing }';
  expect(jsonObjectAt(text, text.indexOf("{"))).toBe('{"a":"}{","b":{"c":"\\"}"}}');
});

test("jsonObjectAt returns null when the object never closes", () => {
  expect(jsonObjectAt('{"a":"unterminated', 0)).toBeNull();
});

test("playerResponseFromHtml reads ytInitialPlayerResponse even when its strings hold braces", () => {
  const response = { videoDetails: { videoId: "abc", shortDescription: "Use {braces} and \"quotes\" }" } };
  const html = `<script>var ytInitialData = {"x":1};</script><script nonce="n">var ytInitialPlayerResponse = ${JSON.stringify(response)};var meta = {};</script>`;
  expect(playerResponseFromHtml(html)).toEqual(response);
});

test("playerResponseFromHtml skips a look-alike assignment that is not JSON", () => {
  const response = { videoDetails: { videoId: "abc" } };
  const html = `ytInitialPlayerResponse = {not json}; ytInitialPlayerResponse = ${JSON.stringify(response)};`;
  expect(playerResponseFromHtml(html)).toEqual(response);
});

test("playerResponseFromHtml gives null for a consent or blocked page", () => {
  expect(playerResponseFromHtml("<html><body>Before you continue to YouTube</body></html>")).toBeNull();
  expect(playerResponseFromHtml("var ytInitialPlayerResponse = null;")).toBeNull();
});
