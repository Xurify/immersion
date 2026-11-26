import { dateKey } from "./format";
import { send } from "./messages";
import { progressToday, type LangProgress } from "./plan";
import { setGoalLanguages } from "./colors.svelte";
import { emptyBoard, nowPlayingOf, pruneDone, type Board, type NowPlaying } from "./board";
import { load, loadSession, watch, type SessionShape } from "./storage";
import { goalsForToday, withManual } from "./stats";
import type { Follow, GoalPeriod, Goals, ListenLog, ManualEntry, OpenVideo, Sentence, Session } from "./types";

/**
 * Live data shared by every view on a page. Call `start()` once from the page's root;
 * the fields update as tabs change and as other pages write to storage.
 */
class Data {
  tabs = $state<OpenVideo[]>([]);
  goals = $state<Goals>({});
  /** Time counted from YouTube alone. */
  youtubeLog = $state<ListenLog>({});
  logBackground = $state<ListenLog>({});
  manual = $state<ManualEntry[]>([]);
  baseline = $state<Record<string, number>>({});
  goalPeriods = $state<Record<string, GoalPeriod>>({});
  follows = $state<Record<string, Follow>>({});
  /** Everything listened: YouTube plus hand-logged entries. */
  log = $derived(withManual(this.youtubeLog, this.manual));
  sentences = $state<Sentence[]>([]);
  sessions = $state<Session[]>([]);
  /** videoId → seconds actually played. */
  watched = $state<Record<string, number>>({});
  /** Done cards from earlier days are hidden here; the background prunes them on its next write. */
  board = $state<Board>(emptyBoard());
  playing = $state<SessionShape["playing"]>(null);
  /** What is playing now: the session's card, or a video in a goal language the user started in a tab themselves. */
  nowPlaying = $derived<NowPlaying | null>(nowPlayingOf(this.playing, this.tabs, Object.keys(this.goals)));
  loaded = $state(false);

  today = $derived(this.log[dateKey()] ?? {});
  /** Minutes each goal asks for today; weekly goals spread what is left of the week. */
  todayGoals = $derived(goalsForToday(this.goals, this.goalPeriods, this.log));
  progress = $derived<LangProgress[]>(progressToday(this.todayGoals, this.today));
  /** Seconds left across all goals. */
  leftToday = $derived(this.progress.reduce((sum, row) => sum + row.leftSeconds, 0));

  #started = false;

  async refreshTabs(): Promise<void> {
    try {
      this.tabs = await send("tabs:list", {});
    } catch {
      // Background not ready yet; the next poll retries.
    }
  }

  async refreshStored(): Promise<void> {
    const [goals, log, sentences, sessions, board, playing, watched, logBackground, manual, baseline, goalPeriods, follows] = await Promise.all([
      load("goals"),
      load("log"),
      load("sentences"),
      load("sessions"),
      load("board"),
      loadSession("playing"),
      load("watched"),
      load("logBackground"),
      load("manual"),
      load("baseline"),
      load("goalPeriods"),
      load("follows"),
    ]);
    this.follows = follows;
    this.logBackground = logBackground;
    this.manual = manual;
    this.baseline = baseline;
    this.goalPeriods = goalPeriods;
    this.watched = watched;
    this.board = pruneDone(board);
    this.playing = playing;
    setGoalLanguages(Object.keys(goals));
    this.goals = goals;
    this.youtubeLog = log;
    this.sentences = sentences;
    this.sessions = sessions;
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await Promise.all([this.refreshStored(), this.refreshTabs()]);
    this.loaded = true;
    watch(["goals", "log", "sentences", "sessions", "meta", "overrides", "board", "watched", "logBackground", "manual", "baseline", "goalPeriods", "follows"], () => {
      void this.refreshStored();
      void this.refreshTabs();
    });
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "session" && "playing" in changes) void this.refreshStored();
    });
    browser.tabs.onCreated.addListener(() => void this.refreshTabs());
    browser.tabs.onRemoved.addListener(() => void this.refreshTabs());
    browser.tabs.onUpdated.addListener((_id, change) => {
      if (change.url || change.status === "complete" || change.discarded != null) void this.refreshTabs();
    });
    // Positions move while videos play.
    setInterval(() => {
      if (document.visibilityState === "visible") void this.refreshTabs();
    }, 5000);
  }
}

export const data = new Data();
