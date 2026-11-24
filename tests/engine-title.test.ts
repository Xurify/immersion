import { test, expect } from "bun:test";
import { cleanTitle } from "../lib/engine/title";

test("cleanTitle drops the unread count and the YouTube suffix", () => {
  expect(cleanTitle("(3) Un día en Madrid - YouTube")).toBe("Un día en Madrid");
  expect(cleanTitle("Plain title")).toBe("Plain title");
  expect(cleanTitle("(12)   Spaced out   -  YouTube")).toBe("Spaced out");
});

test("cleanTitle leaves a title alone when only part of the suffix matches", () => {
  expect(cleanTitle("YouTube tips - part 2")).toBe("YouTube tips - part 2");
});
