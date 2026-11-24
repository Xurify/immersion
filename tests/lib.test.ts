import { expect, test } from "bun:test";
import { interleave, planSession, progressToday } from "../lib/plan";
import { dueLabel, grade, nextDueAt } from "../lib/review";
import { dailyPace, goalsForToday, milestoneAround, onlyLangs, otherLangs, summarise, withManual } from "../lib/stats";
import type { OpenVideo, Sentence } from "../lib/types";

const video = (tabId: number, lang: string, remaining: number): OpenVideo => ({
  tabId, windowId: 1, url: "", videoId: `v${tabId}`, title: `t${tabId}`, channel: "c",
  duration: remaining, detectedLang: lang, lang, position: 0, remaining, playing: false, asleep: false, isShort: false,
});

test("goals plan covers each behind language and skips met ones", () => {
  const progress = progressToday({ es: 30, ja: 20, sk: 15 }, { es: 12 * 60, sk: 15 * 60 });
  const tabs = [video(1, "es", 600), video(2, "es", 600), video(3, "ja", 900), video(4, "ja", 900), video(5, "sk", 600), video(6, "es", 600)];
  const plan = planSession(tabs, progress, "goals");
  expect(plan.videos.map((v) => v.tabId).sort()).toEqual([1, 2, 3, 4]);
  expect(plan.videos.some((v) => v.lang === "sk")).toBe(false);
});

test("minute budgets fill roughly to the budget", () => {
  const tabs = [1, 2, 3, 4, 5].map((id) => video(id, "es", 600));
  const plan = planSession(tabs, [], 20);
  expect(plan.seconds).toBe(1200);
});

test("interleave alternates languages", () => {
  const out = interleave([video(1, "es", 1), video(2, "es", 1), video(3, "ja", 1)]);
  expect(out.map((v) => v.lang)).toEqual(["es", "ja", "es"]);
});

const sentence: Sentence = {
  id: "s", text: "", translation: "", lang: "es", videoId: "", videoTitle: "", channel: "",
  start: 0, end: 1, createdAt: 0, step: 0, dueAt: 0, reviews: 0,
};

test("grades move along the ladder", () => {
  const now = new Date(2026, 10, 24, 10).getTime();
  expect(grade(sentence, "good", now).step).toBe(1);
  expect(grade({ ...sentence, step: 3 }, "again", now).step).toBe(0);
  expect(dueLabel(nextDueAt(sentence, "again", now), now)).toBe("in 10 min");
  expect(dueLabel(nextDueAt(sentence, "hard", now), now)).toBe("later today");
  expect(dueLabel(nextDueAt(sentence, "good", now), now)).toBe("tomorrow");
  expect(dueLabel(nextDueAt({ ...sentence, step: 2 }, "good", now), now)).toBe("in 7 days");
  expect(dueLabel(nextDueAt({ ...sentence, step: 2 }, "hard", now), now)).toBe("in 3 days");
});

test("summary totals, goal days and streaks", () => {
  const now = new Date(2026, 10, 24, 10).getTime();
  const log = { "2026-11-22": { es: 1800 }, "2026-11-23": { es: 1800 }, "2026-11-24": { es: 600 } };
  const s = summarise(log, { es: 30 }, 7, now);
  expect(s.totalSeconds).toBe(4200);
  expect(s.allGoalsDays).toBe(2);
  const es = s.langs.find((l) => l.lang === "es")!;
  expect(es.daysHit).toBe(2);
  // Today isn't done yet, so the streak still counts the two days before it.
  expect(es.streak).toBe(2);
  expect(es.days.at(-1)).toBe("partly");
});

test("History keeps goal languages and lists the rest apart", () => {
  const log = { "2026-11-23": { sk: 600, en: 3120, uk: 30 }, "2026-11-24": { sk: 300, en: 60 } };
  expect(onlyLangs(log, ["sk"])).toEqual({ "2026-11-23": { sk: 600 }, "2026-11-24": { sk: 300 } });
  expect(otherLangs(log, ["sk"], ["2026-11-23", "2026-11-24"])).toEqual([{ lang: "en", seconds: 3180 }]);
  expect(otherLangs(log, ["sk"], ["2026-11-24"])).toEqual([{ lang: "en", seconds: 60 }]);
});

test("A weekly goal spreads what is left of the week over the days left", () => {
  // Thursday 2026-11-26: Monday to Wednesday are before today, so 4 days are left.
  const now = new Date(2026, 10, 26, 12).getTime();
  const log = { "2026-11-23": { et: 1800 }, "2026-11-24": { et: 1800 }, "2026-11-22": { et: 9999 } };
  const today = goalsForToday({ et: 140, sk: 20 }, { et: "week" }, log, now);
  expect(today.sk).toBe(20);
  expect(today.et).toBe(20); // (140 - 60) / 4
  expect(goalsForToday({ et: 60 }, { et: "week" }, log, now).et).toBe(0);
  expect(dailyPace({ et: 140, sk: 20 }, { et: "week" })).toEqual({ et: 20, sk: 20 });
});

test("Hand-logged time adds to the day it was logged for", () => {
  const merged = withManual({ "2026-11-24": { sk: 600 } }, [
    { id: "a", date: "2026-11-24", lang: "sk", seconds: 1200, source: "Podcast", addedAt: 0 },
    { id: "b", date: "2026-11-23", lang: "cs", seconds: 300, source: "TV", addedAt: 0 },
  ]);
  expect(merged).toEqual({ "2026-11-24": { sk: 1800 }, "2026-11-23": { cs: 300 } });
});

test("Milestones bracket the hours listened", () => {
  expect(milestoneAround(0)).toEqual({ previous: 0, next: 10 });
  expect(milestoneAround(12.5)).toEqual({ previous: 10, next: 25 });
  expect(milestoneAround(100)).toEqual({ previous: 100, next: 150 });
});
