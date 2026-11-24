import type { Grade, Sentence } from "./types";

/** Days until the next review at each step. Past the end, a sentence is learned. */
export const REVIEW_LADDER_DAYS = [1, 3, 7, 16, 35] as const;

const DAY = 86_400_000;

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isLearned(sentence: Sentence): boolean {
  return sentence.step >= REVIEW_LADDER_DAYS.length;
}

export function isDue(sentence: Sentence, now: number = Date.now()): boolean {
  return !isLearned(sentence) && sentence.dueAt <= now;
}

export function dueSentences(sentences: Sentence[], now: number = Date.now()): Sentence[] {
  return sentences.filter((s) => isDue(s, now)).sort((a, b) => a.dueAt - b.dueAt);
}

/** When each grade would bring the sentence back, for the button hints. */
export function nextDueAt(sentence: Sentence, grade: Grade, now: number = Date.now()): number {
  if (grade === "again") return now + 10 * 60_000;
  const step = grade === "good" ? sentence.step : Math.max(0, sentence.step - 1);
  const days = REVIEW_LADDER_DAYS[Math.min(step, REVIEW_LADDER_DAYS.length - 1)]!;
  return startOfDay(now) + days * DAY;
}

/**
 * again: back to the start, shown again in 10 minutes.
 * hard: same step, shorter wait.
 * good: one step up the ladder.
 */
export function grade(sentence: Sentence, grade: Grade, now: number = Date.now()): Sentence {
  const step = grade === "again" ? 0 : grade === "good" ? sentence.step + 1 : sentence.step;
  return { ...sentence, step, dueAt: nextDueAt(sentence, grade, now), reviews: sentence.reviews + 1 };
}

/** "in 10 min", "tomorrow", "in 7 days". */
export function dueLabel(dueAt: number, now: number = Date.now()): string {
  const minutesAway = Math.round((dueAt - now) / 60_000);
  if (minutesAway < 60) return `in ${Math.max(1, minutesAway)} min`;
  const days = Math.round((startOfDay(dueAt) - startOfDay(now)) / DAY);
  if (days <= 0) return "later today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
