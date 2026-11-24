import { dateKey } from "./format";
import { send } from "./messages";
import { progressToday, type LangProgress } from "./plan";
import { load, watch } from "./storage";
import type { Goals, ListenLog, OpenVideo, Sentence, Session } from "./types";

/**
 * Live data shared by every view on a page. Call `start()` once from the page's root;
 * the fields update as tabs change and as other pages write to storage.
 */
class Data {
  tabs = $state<OpenVideo[]>([]);
  goals = $state<Goals>({});
  log = $state<ListenLog>({});
  sentences = $state<Sentence[]>([]);
  sessions = $state<Session[]>([]);
  loaded = $state(false);

  today = $derived(this.log[dateKey()] ?? {});
  progress = $derived<LangProgress[]>(progressToday(this.goals, this.today));
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
    const [goals, log, sentences, sessions] = await Promise.all([load("goals"), load("log"), load("sentences"), load("sessions")]);
    this.goals = goals;
    this.log = log;
    this.sentences = sentences;
    this.sessions = sessions;
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await Promise.all([this.refreshStored(), this.refreshTabs()]);
    this.loaded = true;
    watch(["goals", "log", "sentences", "sessions", "meta", "overrides"], () => {
      void this.refreshStored();
      void this.refreshTabs();
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
