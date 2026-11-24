import { lastDays } from "./format";
import type { Goals, Lang, ListenLog } from "./types";

export type DayStatus = "hit" | "partly" | "missed" | "none";

/** How a language did on a day: goal hit, some listening, nothing. "none" when there is no goal and no listening. */
export function dayStatus(seconds: number, goalMinutes: number | undefined): DayStatus {
  if (goalMinutes && seconds >= goalMinutes * 60) return "hit";
  if (seconds >= 60) return goalMinutes ? "partly" : "hit";
  return goalMinutes ? "missed" : "none";
}

/** Days in a row, ending today (or yesterday, if today isn't done yet), where the language met its goal or, without a goal, had a minute of listening. */
export function streak(log: ListenLog, lang: Lang, goalMinutes: number | undefined, now: number = Date.now()): number {
  const keys = lastDays(400, now).reverse();
  let count = 0;
  for (const [i, key] of keys.entries()) {
    const ok = dayStatus(log[key]?.[lang] ?? 0, goalMinutes) === "hit";
    if (ok) count++;
    else if (i === 0) continue;
    else break;
  }
  return count;
}

export interface LangSummary {
  lang: Lang;
  /** Seconds in the range. */
  seconds: number;
  allTime: number;
  daysHit: number;
  streak: number;
  /** One status per day in the range, oldest first. */
  days: DayStatus[];
}

export interface RangeSummary {
  keys: string[];
  /** Per day: language → seconds. */
  perDay: Record<Lang, number>[];
  totalSeconds: number;
  previousSeconds: number;
  /** Days where every goal was met. */
  allGoalsDays: number;
  langs: LangSummary[];
}

export function summarise(log: ListenLog, goals: Goals, days: number, now: number = Date.now()): RangeSummary {
  const keys = lastDays(days, now);
  const previousKeys = lastDays(days * 2, now).slice(0, days);
  const perDay = keys.map((key) => log[key] ?? {});
  const sum = (day: Record<Lang, number>) => Object.values(day).reduce((a, b) => a + b, 0);

  const langSet = new Set<Lang>(Object.keys(goals));
  for (const day of perDay) for (const [lang, s] of Object.entries(day)) if (s >= 60) langSet.add(lang);

  const langs = [...langSet].map((lang): LangSummary => {
    const statuses = perDay.map((day) => dayStatus(day[lang] ?? 0, goals[lang]));
    return {
      lang,
      seconds: perDay.reduce((total, day) => total + (day[lang] ?? 0), 0),
      allTime: Object.values(log).reduce((total, day) => total + (day[lang] ?? 0), 0),
      daysHit: statuses.filter((s) => s === "hit").length,
      streak: streak(log, lang, goals[lang], now),
      days: statuses,
    };
  });
  langs.sort((a, b) => (b.lang in goals ? 1 : 0) - (a.lang in goals ? 1 : 0) || b.seconds - a.seconds);

  const goalLangs = Object.keys(goals);
  return {
    keys,
    perDay,
    totalSeconds: perDay.reduce((total, day) => total + sum(day), 0),
    previousSeconds: previousKeys.reduce((total, key) => total + sum(log[key] ?? {}), 0),
    allGoalsDays: goalLangs.length ? perDay.filter((day) => goalLangs.every((lang) => (day[lang] ?? 0) >= goals[lang]! * 60)).length : 0,
    langs,
  };
}
