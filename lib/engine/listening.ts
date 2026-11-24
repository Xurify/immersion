/** One playback report from a tab. */
export interface Beat {
  videoId: string;
  playing: boolean;
  at: number;
}

/** Longer gaps mean the tab was asleep or the page was gone, so no listening happened. */
const MAX_GAP_MS = 15_000;
/** A single tick never credits more than this, even after a long stall. */
const MAX_CREDIT_MS = 10_000;

/**
 * Seconds of listening between two reports from one tab. The interval counts only when the
 * earlier report was playing: play and pause are reported at once, so that report marks
 * where the interval started.
 */
export function listenedSeconds(previous: Beat | undefined, current: Beat): number {
  if (!previous || previous.videoId !== current.videoId || !previous.playing) return 0;
  const gap = current.at - previous.at;
  if (gap > MAX_GAP_MS) return 0;
  return Math.min(gap, MAX_CREDIT_MS) / 1000;
}
