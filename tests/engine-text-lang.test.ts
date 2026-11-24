import { test, expect } from "bun:test";
import { detectTextLang, withTextLang } from "../lib/engine/textLang";
import type { VideoMeta } from "../lib/types";

const GOALS = ["et", "sk", "uk", "ru"];

test.each([
  ["DenimDream Podcast #41 Kelly Sildaru - maailma parimaks saamise hind ja uus algus tundega", "et"],
  ["Na káve s | Veľký rozhovor so Sabinou z Ruže: Opísala, prečo chce, aby bol Adrian otec jej detí", "sk"],
  ["ЛЮКС ПРОТИ БЮДЖЕТУ! Знайшли косметику, яка не гірша за Dior, Rhode і Chanel", "uk"],
  ["Тебе внушили неправду об отношениях", "ru"],
  ["Silvia Ilves ja poeg Stefan panevad teineteist proovile noorte slängis ja vanakooli väljendites", "et"],
  ["How to cook pasta at home in ten minutes", "en"],
])("%s is detected as %s", (title, lang) => {
  expect(detectTextLang(title, undefined, GOALS)).toBe(lang);
});

test("a title with too few letters gives no language", () => {
  expect(detectTextLang("Short", undefined, GOALS)).toBeNull();
});

test("a short title is guessed with the description's opening", () => {
  expect(detectTextLang("Ahoj", "Dnes sa pozrieme na nové video o tom, ako sa učiť slovenčinu doma.", GOALS)).toBe("sk");
});

test("withTextLang marks a guess as text and leaves a known language alone", () => {
  const untitled: VideoMeta = { videoId: "abc", title: "Silvia Ilves ja poeg Stefan panevad teineteist", channel: "", duration: 60, detectedLang: null };
  expect(withTextLang(untitled, undefined, GOALS)).toEqual({ ...untitled, detectedLang: "et", langSource: "text" });
  const known: VideoMeta = { ...untitled, detectedLang: "fr", langSource: "captions" };
  expect(withTextLang(known, undefined, GOALS)).toBe(known);
});
