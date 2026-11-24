import { dateKey, lastDays } from "./format";
import type { GoalPeriod, Goals, Lang, ListenLog, ManualEntry } from "./types";

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

/** The log with only the given languages kept. */
export function onlyLangs(log: ListenLog, langs: Lang[]): ListenLog {
  const keep = new Set(langs);
  const out: ListenLog = {};
  for (const [key, day] of Object.entries(log)) {
    out[key] = Object.fromEntries(Object.entries(day).filter(([lang]) => keep.has(lang)));
  }
  return out;
}

/** Time on the given days in languages outside `langs`, a minute or more, most first. */
export function otherLangs(log: ListenLog, langs: Lang[], keys: string[]): { lang: Lang; seconds: number }[] {
  const skip = new Set(langs);
  const totals = new Map<Lang, number>();
  for (const key of keys) {
    for (const [lang, seconds] of Object.entries(log[key] ?? {})) {
      if (!skip.has(lang)) totals.set(lang, (totals.get(lang) ?? 0) + seconds);
    }
  }
  return [...totals]
    .filter(([, seconds]) => seconds >= 60)
    .map(([lang, seconds]) => ({ lang, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

/** The YouTube log with hand-logged entries added in. */
export function withManual(log: ListenLog, manual: ManualEntry[]): ListenLog {
  if (!manual.length) return log;
  const out: ListenLog = {};
  for (const [key, day] of Object.entries(log)) out[key] = { ...day };
  for (const entry of manual) {
    const day = (out[entry.date] ??= {});
    day[entry.lang] = (day[entry.lang] ?? 0) + entry.seconds;
  }
  return out;
}

/** Date keys from this week's Monday through today. */
export function weekSoFar(now: number = Date.now()): string[] {
  const sinceMonday = (new Date(now).getDay() + 6) % 7;
  return lastDays(sinceMonday + 1, now);
}

/**
 * Minutes each goal asks for today. A weekly goal spreads what is still left
 * this week over the days left, today included; once the week is covered it asks for 0.
 */
export function goalsForToday(goals: Goals, periods: Record<Lang, GoalPeriod>, log: ListenLog, now: number = Date.now()): Goals {
  const week = weekSoFar(now);
  const earlier = week.slice(0, -1);
  const daysLeft = 7 - earlier.length;
  const out: Goals = {};
  for (const [lang, minutes] of Object.entries(goals)) {
    if (periods[lang] !== "week") {
      out[lang] = minutes;
      continue;
    }
    const before = earlier.reduce((sum, key) => sum + (log[key]?.[lang] ?? 0), 0);
    const leftMinutes = Math.max(0, minutes - before / 60);
    out[lang] = Math.ceil(leftMinutes / daysLeft);
  }
  return out;
}

/** Goals as an even daily pace, for history: a weekly goal counts a seventh each day. */
export function dailyPace(goals: Goals, periods: Record<Lang, GoalPeriod>): Goals {
  const out: Goals = {};
  for (const [lang, minutes] of Object.entries(goals)) out[lang] = periods[lang] === "week" ? Math.round(minutes / 7) : minutes;
  return out;
}

/** Hours of input worth marking, Dreaming Spanish style. */
export const MILESTONE_HOURS = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];

/** The milestones on either side of `hours` (previous is 0 before the first). */
export function milestoneAround(hours: number): { previous: number; next: number } {
  const next = MILESTONE_HOURS.find((mark) => mark > hours) ?? Math.ceil((hours + 1) / 500) * 500;
  const previous = [...MILESTONE_HOURS].reverse().find((mark) => mark <= hours) ?? 0;
  return { previous, next };
}

/** Today's key, re-exported for callers that only need stats. */
export const todayKey = (now: number = Date.now()) => dateKey(now);
