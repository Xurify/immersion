import { test, expect } from "bun:test";
import { listenedSeconds, type Beat } from "../lib/engine/listening";

const beat = (at: number, playing = true, videoId = "aaaaaaaaaaa"): Beat => ({ videoId, playing, at });

test("counts the interval since a playing report, in seconds", () => {
  expect(listenedSeconds(beat(0), beat(5_000))).toBe(5);
});

test("a pause interval counts because it began while playing", () => {
  expect(listenedSeconds(beat(0), beat(3_000, false))).toBe(3);
});

test("resuming after a pause counts nothing for the paused interval", () => {
  expect(listenedSeconds(beat(3_000, false), beat(3_100))).toBe(0);
});

test("an interval that began while muted counts nothing", () => {
  expect(listenedSeconds({ ...beat(0), muted: true }, beat(5_000))).toBe(0);
  expect(listenedSeconds({ ...beat(0), muted: false }, beat(5_000))).toBe(5);
});

test("no earlier report, or another video, counts nothing", () => {
  expect(listenedSeconds(undefined, beat(5_000))).toBe(0);
  expect(listenedSeconds(beat(0), beat(5_000, true, "bbbbbbbbbbb"))).toBe(0);
});

test("a gap over 15 s counts nothing, and a single tick is capped at 10 s", () => {
  expect(listenedSeconds(beat(0), beat(16_000))).toBe(0);
  expect(listenedSeconds(beat(0), beat(15_000))).toBe(10);
});
