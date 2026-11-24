<script lang="ts">
  import Strip from "../../ui/Strip.svelte";
  import LangName from "../../ui/LangName.svelte";
  import { clock, minutes } from "../../lib/format";
  import { columnSeconds } from "../../lib/board";
  import { data } from "../../lib/data.svelte";
  import { send } from "../../lib/messages";
  import { asPlannable } from "../../lib/board";
  import { defaultBudget, planSession } from "../../lib/plan";
  import type { OpenVideo } from "../../lib/types";
  import LangBand from "./components/LangBand.svelte";

  /** Same cut as planSession: nothing to play in a clip with under 20 seconds left. */
  const playable = (video: OpenVideo) => video.remaining > 20 && video.duration > 0;
  /** Stash is offered only from this many open tabs; fewer is not hoarding yet. */
  const STASH_FROM = 5;

  let activeTabId = $state<number | null>(null);
  let error = $state("");

  const goalRows = $derived(data.progress.filter((row) => row.goalMinutes > 0));
  const hasGoals = $derived(goalRows.length > 0);
  const allMet = $derived(hasGoals && goalRows.every((row) => row.done));
  /** Board cards (Up next, then Inbox) and open tabs not on the board yet: what the popup can plan from after tabs are stashed. */
  const sources = $derived.by(() => {
    const board = data.board;
    const tabFor = (videoId: string) => data.tabs.find((video) => video.videoId === videoId);
    const cards = [...board.columns.next, ...board.columns.inbox]
      .map((id) => board.cards[id])
      .filter((card) => card != null && card.videoId !== data.playing?.videoId)
      .map((card) => asPlannable(card!, tabFor(card!.videoId)));
    const untracked = data.tabs.filter((video) => !board.cards[video.videoId] && video.tabId !== data.playing?.tabId);
    return [...cards, ...untracked];
  });
  const plan = $derived(planSession(sources, data.progress, allMet ? 20 : defaultBudget(data.progress)));
  const leftMinutes = $derived(minutes(data.leftToday));
  const thisTab = $derived(data.tabs.find((video) => video.tabId === activeTabId));
  const planEmpty = $derived(plan.videos.length === 0);
  /** Most tabs still lack a length, so any plan built from them would be a guess. */
  const unreadCount = $derived(data.tabs.filter((video) => video.duration <= 0).length);
  const reading = $derived(data.tabs.length > 0 && unreadCount * 2 > data.tabs.length);
  const upNextCount = $derived(data.board.columns.next.length);
  const upNextMinutes = $derived(minutes(columnSeconds(data.board, "next")));
  const nowTitle = $derived.by(() => {
    if (!data.playing) return "";
    return data.board.cards[data.playing.videoId]?.title ?? data.tabs.find((video) => video.tabId === data.playing?.tabId)?.title ?? "";
  });
  /** Stashing leaves the playing tab open, so it is not counted. */
  const stashable = $derived(data.tabs.filter((video) => video.tabId !== data.playing?.tabId).length);

  /** A language's open videos: the ones in the plan first, in plan order, then the rest. */
  function tabsFor(lang: string): OpenVideo[] {
    const inPlan = plan.videos.filter((video) => video.lang === lang);
    const planned = new Set(inPlan.map((video) => video.videoId));
    const rest = sources.filter((video) => video.lang === lang && playable(video) && !planned.has(video.videoId));
    return [...inPlan, ...rest];
  }

  async function openDesk(view?: string) {
    error = "";
    try {
      await send("desk:open", { view });
      window.close();
    } catch {
      error = "Could not open the desk. Try again.";
    }
  }

  /** Puts the videos at the top of Up next in this order, then plays them through the board. */
  async function start(videos: OpenVideo[]) {
    error = "";
    try {
      const untracked = videos.filter((video) => !data.board.cards[video.videoId]).map((video) => video.videoId);
      if (untracked.length) await send("board:add", { videoIds: untracked, column: "next", index: 0 });
      for (const video of [...videos].reverse()) await send("board:move", { videoId: video.videoId, column: "next", index: 0 });
      await send("board:play", {});
      window.close();
    } catch {
      error = "Could not start the session. Try again.";
    }
  }

  async function playUpNext() {
    error = "";
    try {
      await send("board:play", {});
      window.close();
    } catch {
      error = "Could not start Up next. Try again.";
    }
  }

  async function pause() {
    error = "";
    try {
      await send("board:pause", {});
    } catch {
      error = "Could not pause. Try again.";
    }
  }

  async function skip() {
    error = "";
    try {
      await send("board:skip", {});
    } catch {
      error = "Could not skip. Try again.";
    }
  }

  async function stashTabs() {
    error = "";
    try {
      await send("board:stash", {});
    } catch {
      error = "Could not stash the tabs. Try again.";
    }
  }

  $effect(() => {
    void data.start();
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        activeTabId = tab?.id ?? null;
      })
      .catch(() => {});
  });
</script>

<main>
  <header class="head">
    <h1>Language Immersion Tracker</h1>
    <button type="button" class="text-btn" onclick={() => openDesk()}>Open desk ↗</button>
  </header>

  <div class="body" class:pending={!data.loaded}>
    {#if data.loaded}
      {#if hasGoals}
        <p class="big" class:wide={leftMinutes >= 100}>{leftMinutes}<span class="unit">min left</span></p>
      {/if}

      {#if data.playing}
        <div class="now">
          <p class="now-text"><span class="now-label">Now:</span> <span class="now-title">{nowTitle}</span></p>
          <div class="now-buttons">
            <button type="button" class="btn ghost small" onclick={pause}>Pause</button>
            <button type="button" class="btn ghost small" onclick={skip}>Skip</button>
          </div>
        </div>
      {/if}

      {#if reading}
        <p class="note" role="status">Reading details for {unreadCount} {unreadCount === 1 ? "tab" : "tabs"}…</p>
      {:else if !planEmpty}
        <div class="strip">
          <Strip videos={plan.videos} labels={false} height={12} />
        </div>
      {/if}

      {#if hasGoals && !reading}
        <ul class="bands">
          {#each goalRows as row (row.lang)}
            <LangBand {row} next={tabsFor(row.lang)} onplay={start} />
          {/each}
        </ul>
      {:else if !hasGoals}
        <div class="nogoals">
          <p class="note">Set a daily goal to plan your listening.</p>
          <button type="button" class="btn ghost" onclick={() => openDesk("board")}>Set goals</button>
        </div>
      {/if}

      {#if allMet}
        <p class="note">All goals met today</p>
      {/if}

      <div class="actions">
        {#if planEmpty && !upNextCount && !reading}
          <p class="note" id="plan-reason">Open YouTube videos in the languages you're learning to plan a session.</p>
        {/if}
        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}
        {#if upNextCount}
          <button type="button" class="btn" onclick={playUpNext}>Play Up next · {upNextMinutes} min</button>
        {:else if !reading}
          <button
            type="button"
            class="btn"
            disabled={planEmpty}
            aria-describedby={planEmpty ? "plan-reason" : undefined}
            onclick={() => start(plan.videos)}
          >
            {planEmpty ? "Start session →" : `Start ${minutes(plan.seconds)}-min session →`}
          </button>
        {/if}
        {#if data.tabs.length >= STASH_FROM}
          <button type="button" class="text-btn quiet" onclick={stashTabs}>Stash {stashable} tabs</button>
        {/if}
      </div>
    {/if}
  </div>

  {#if data.loaded && thisTab}
    <p class="this">
      <span class="this-label">This tab:</span>
      <span class="this-title">{thisTab.title}</span>
      <span class="sep" aria-hidden="true">·</span>
      <span class="this-lang"><LangName lang={thisTab.lang} /></span>
      <span class="sep" aria-hidden="true">·</span>
      <span class="this-time">{clock(thisTab.remaining)} left</span>
    </p>
  {/if}
</main>

<style>
  :global(body) {
    width: 360px;
    min-height: 0;
  }

  main {
    max-height: 600px;
    overflow-y: auto;
    color: var(--ink);
    background: var(--bg);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 0;
  }

  h1 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.2;
  }

  .text-btn {
    min-height: 2.25rem;
    padding: 0 4px;
    border: 0;
    border-radius: 6px;
    background: none;
    font-size: 14px;
    font-weight: 500;
    color: var(--dim);
  }

  .text-btn:hover {
    color: var(--ink);
    text-decoration: underline;
  }

  .body.pending {
    min-height: 400px;
  }

  .big {
    margin: 8px 16px 0;
    font-size: 92px;
  }

  .big.wide {
    font-size: 72px;
  }

  .strip {
    margin: 16px 16px 0;
  }

  .now {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 14px 16px 0;
    padding: 10px 12px;
    border-radius: var(--r-md);
    background: var(--soft);
    font-size: 14px;
  }

  .now-text {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .now-label {
    color: var(--dim);
  }

  .now-buttons {
    display: flex;
    flex: none;
    gap: 4px;
  }

  .now-buttons .btn {
    min-height: 2rem;
    padding: 0 0.7rem;
  }

  .text-btn.quiet {
    align-self: center;
    font-size: 13px;
  }

  .bands {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 16px 16px 0;
    padding: 0;
    list-style: none;
  }

  .nogoals {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin: 16px;
  }

  .note {
    margin: 16px 16px 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--ink-2);
  }

  .nogoals .note {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .actions .note {
    margin: 0;
  }

  .actions .btn {
    width: 100%;
  }

  .error {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }

  .this {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    margin: 0;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--line);
    font-size: 13px;
    color: var(--dim);
    white-space: nowrap;
  }

  .this-label,
  .this-lang,
  .this-time,
  .sep {
    flex: none;
  }

  .this-title {
    min-width: 0;
    overflow: hidden;
    color: var(--ink-2);
    text-overflow: ellipsis;
  }
</style>
