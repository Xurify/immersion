import type { Goals, Lang, OpenVideo } from "./types";

export interface LangProgress {
  lang: Lang;
  /** A goal language; false for other languages heard today. */
  isGoal: boolean;
  goalMinutes: number;
  listenedSeconds: number;
  /** Seconds still needed for the goal, 0 when met or without a goal. */
  leftSeconds: number;
  done: boolean;
}

/** Goal languages first (in goal order), then any other language listened to today. */
export function progressToday(goals: Goals, today: Record<Lang, number> | undefined): LangProgress[] {
  const listened = today ?? {};
  const rows: LangProgress[] = Object.entries(goals).map(([lang, goalMinutes]) => {
    const listenedSeconds = listened[lang] ?? 0;
    const leftSeconds = Math.max(0, goalMinutes * 60 - listenedSeconds);
    return { lang, isGoal: true, goalMinutes, listenedSeconds, leftSeconds, done: leftSeconds === 0 };
  });
  for (const [lang, listenedSeconds] of Object.entries(listened)) {
    if (lang in goals || listenedSeconds < 60) continue;
    rows.push({ lang, isGoal: false, goalMinutes: 0, listenedSeconds, leftSeconds: 0, done: false });
  }
  return rows;
}

export type Budget = "goals" | 20 | 45 | 90;

export interface Plan {
  videos: OpenVideo[];
  seconds: number;
}

const playable = (video: OpenVideo) => video.remaining > 20 && video.duration > 0;

/**
 * Builds a listening session from open tabs.
 * "goals": enough videos in each behind language to cover what is left, behind languages in goal order.
 * Minutes: behind languages first, then the rest in tab order, until the budget is roughly filled.
 */
export function planSession(videos: OpenVideo[], progress: LangProgress[], budget: Budget): Plan {
  const pool = videos.filter(playable);
  const behind = progress.filter((row) => row.isGoal && !row.done);
  const picked: OpenVideo[] = [];
  const take = (video: OpenVideo) => {
    if (!picked.includes(video)) picked.push(video);
  };

  if (budget === "goals") {
    for (const row of behind) {
      let covered = 0;
      for (const video of pool) {
        if (covered >= row.leftSeconds) break;
        if (video.lang !== row.lang) continue;
        take(video);
        covered += video.remaining;
      }
    }
  } else {
    const limit = budget * 60;
    // A video may overrun the budget by a fifth rather than leave a big gap.
    const fits = (video: OpenVideo) => total(picked) + video.remaining <= limit * 1.2;
    const ordered = [
      ...pool.filter((video) => behind.some((row) => row.lang === video.lang)),
      ...pool.filter((video) => !behind.some((row) => row.lang === video.lang)),
    ];
    for (const video of ordered) {
      if (total(picked) >= limit) break;
      if (fits(video)) take(video);
    }
  }
  return { videos: interleave(picked), seconds: total(picked) };
}

function total(videos: OpenVideo[]): number {
  return videos.reduce((sum, video) => sum + video.remaining, 0);
}

/** Alternates languages (A B A B) so a long session doesn't sit in one language for an hour. */
export function interleave(videos: OpenVideo[]): OpenVideo[] {
  const queues = new Map<string, OpenVideo[]>();
  for (const video of videos) {
    const key = video.lang ?? "?";
    queues.set(key, [...(queues.get(key) ?? []), video]);
  }
  const out: OpenVideo[] = [];
  while (out.length < videos.length) {
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (next) out.push(next);
    }
  }
  return out;
}

export function defaultBudget(progress: LangProgress[]): Budget {
  return progress.some((row) => row.isGoal && !row.done) ? "goals" : 45;
}
