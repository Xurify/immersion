<script lang="ts">
  import LangName from "../../ui/LangName.svelte";
  import { clock, minutes, thumbnail } from "../../lib/format";
  import { langColor } from "../../lib/colors.svelte";
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
  let retrying = $state(false);

  const goalRows = $derived(data.progress.filter((row) => row.isGoal));
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
  const reading = $derived(unreadCount > 0);
  /** Each goal's share of the meter, and how much of it is filled. */
  const meter = $derived(
    goalRows.map((row) => ({
      lang: row.lang,
      weight: Math.max(row.goalMinutes, 1),
      percent: row.goalMinutes > 0 ? Math.min(100, (row.listenedSeconds / (row.goalMinutes * 60)) * 100) : 100,
    })),
  );
  const thisTabKnown = $derived(Boolean(thisTab && thisTab.duration > 0));
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

  /** Clears earlier failed lookups and asks the background to fetch every missing video again. */
  async function retryDetails() {
    error = "";
    retrying = true;
    try {
      await send("meta:retry", {});
    } catch {
      error = "Could not retry. Try again.";
    } finally {
      setTimeout(() => (retrying = false), 4000);
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
    <span class="brand">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="9" width="4" height="6" rx="2" fill="currentColor" opacity="0.45" />
        <rect x="8" y="4" width="4" height="16" rx="2" fill="currentColor" />
        <rect x="14" y="7" width="4" height="10" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
      <h1>Immersion</h1>
    </span>
    <button type="button" class="desk" onclick={() => openDesk()}>
      Open desk
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
  </header>

  <div class="body" class:pending={!data.loaded}>
    {#if data.loaded}
      {#if hasGoals}
        <section class="hero">
          <p class="eyebrow">{allMet ? "Every goal met today" : "Left today"}</p>
          <p class="big">{leftMinutes}<span class="unit">min</span></p>
          <div class="meter" role="img" aria-label="Progress toward today's goals">
            {#each meter as part (part.lang)}
              <span class="meter-part" style:flex-grow={part.weight} style:--c={langColor(part.lang)}>
                <i style:width="{part.percent}%"></i>
              </span>
            {/each}
          </div>
          {#if reading}
            <p class="status" role="status">
              <span class="spinner" aria-hidden="true"></span>
              <span>Loading details for {unreadCount} of {data.tabs.length} tabs…</span>
              <button type="button" class="retry" disabled={retrying} onclick={retryDetails}>{retrying ? "Retrying" : "Retry"}</button>
            </p>
          {/if}
        </section>
      {/if}

      {#if data.playing}
        <div class="now">
          <span class="pulse" aria-hidden="true"></span>
          <p class="now-text"><span class="now-label">Playing</span><span class="now-title">{nowTitle}</span></p>
          <div class="now-buttons">
            <button type="button" class="btn ghost small" onclick={pause}>Pause</button>
            <button type="button" class="btn ghost small" onclick={skip}>Skip</button>
          </div>
        </div>
      {/if}

      {#if hasGoals}
        <ul class="bands">
          {#each goalRows as row (row.lang)}
            <LangBand {row} next={tabsFor(row.lang)} {reading} onplay={start} />
          {/each}
        </ul>
      {:else}
        <div class="nogoals">
          <p class="title">Set a daily goal</p>
          <p class="note">Pick the languages you're learning and how many minutes a day. The popup then plans what to play.</p>
          <button type="button" class="btn" onclick={() => openDesk("board")}>Set goals</button>
        </div>
      {/if}

      <div class="actions">
        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}
        {#if data.playing}
          <!-- Pause and Skip in the Playing card are the controls while a session runs. -->
        {:else if upNextCount}
          <button type="button" class="btn primary" onclick={playUpNext}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
            {upNextMinutes ? `Play Up next · ${upNextMinutes} min` : "Play Up next"}
          </button>
        {:else if !planEmpty}
          <button type="button" class="btn primary" onclick={() => start(plan.videos)}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
            Start a {minutes(plan.seconds)}-min session
          </button>
        {:else if hasGoals && reading}
          <p class="note">A session can start once your open tabs finish loading.</p>
        {:else if hasGoals && !allMet}
          <p class="note">Open YouTube videos in the languages you're learning to plan a session.</p>
        {/if}
        {#if data.tabs.length >= STASH_FROM}
          <button type="button" class="btn ghost stash" onclick={stashTabs}>
            Stash {stashable} {stashable === 1 ? "tab" : "tabs"} to Inbox
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if data.loaded && thisTab}
    <footer class="this">
      <span class="thumb" style:--c={langColor(thisTab.lang)}>
        <img src={thumbnail(thisTab.videoId)} alt="" width="64" height="36" />
      </span>
      <span class="this-text">
        <span class="this-label">This tab</span>
        <span class="this-title">{thisTab.title}</span>
        <span class="this-meta">
          {#if thisTabKnown}
            {#if thisTab.lang}
              <i class="dot" style:background={langColor(thisTab.lang)} aria-hidden="true"></i>
              <LangName lang={thisTab.lang} />
            {:else}
              Language not detected
            {/if}
            <span aria-hidden="true">·</span>
            <span class="num">{clock(thisTab.remaining)} left</span>
          {:else}
            Reading video details…
          {/if}
        </span>
      </span>
    </footer>
  {/if}
</main>

<style>
  :global(body) {
    width: 360px;
    min-height: 0;
  }

  /* The body scrolls between a fixed header and footer, so Stash and This tab never fall below the fold. */
  main {
    display: flex;
    flex-direction: column;
    max-height: 600px;
    overflow: hidden;
    color: var(--ink);
    background: var(--bg);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 52px;
    padding: 0 12px 0 16px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .desk {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 2rem;
    padding: 0 12px;
    border: 0;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 13px;
    font-weight: 600;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .desk:hover {
    background: var(--ink);
    color: var(--on-ink);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 16px 16px;
    overflow-y: auto;
  }

  .body.pending {
    min-height: 280px;
  }

  .hero {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .big {
    margin: 2px 0 0;
    font-size: 60px;
  }

  .big .unit {
    margin-left: 0.1em;
    font-size: 0.3em;
  }

  .meter {
    display: flex;
    gap: 3px;
    height: 8px;
  }

  .meter-part {
    flex-basis: 0;
    min-width: 6px;
    border-radius: var(--pill);
    background: color-mix(in srgb, var(--c) 24%, var(--soft));
    overflow: hidden;
  }

  .meter-part i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 0 0;
    color: var(--dim);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  .retry {
    margin-left: auto;
    padding: 2px 8px;
    border: 0;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 700;
  }

  .retry:hover:not(:disabled) {
    background: var(--ink);
    color: var(--on-ink);
  }

  .retry:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .spinner {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--line-2);
    border-top-color: var(--ink-2);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .now {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 14px;
    border-radius: 16px;
    background: var(--ink);
    color: var(--on-ink);
  }

  .now :focus-visible {
    outline-color: var(--on-ink);
  }

  .pulse {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    /* Sits on the inverted card: bright green on dark ink, deep green on light ink. */
    --p: light-dark(#3ddc84, #15803d);
    background: var(--p);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--p) 60%, transparent);
    animation: pulse 1.6s ease-out infinite;
  }

  @keyframes pulse {
    to {
      box-shadow: 0 0 0 8px color-mix(in srgb, var(--p) 0%, transparent);
    }
  }

  .now-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    margin: 0;
  }

  .now-label {
    font-size: 11px;
    font-weight: 600;
    opacity: 0.7;
  }

  .now-title {
    overflow: hidden;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .now-buttons {
    display: flex;
    gap: 6px;
  }

  .now-buttons .btn {
    min-height: 2rem;
    padding: 0 12px;
    font-size: 13px;
  }

  .bands {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .nogoals {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 20px;
    border-radius: 18px;
    background: var(--raised);
    box-shadow: var(--lift);
  }

  .nogoals .title {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .nogoals .btn {
    margin-top: 4px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .actions .btn {
    width: 100%;
  }

  .primary {
    min-height: 3rem;
    font-size: 15px;
  }

  .stash {
    min-height: 2.5rem;
    font-size: 14px;
  }

  .note {
    margin: 0;
    color: var(--dim);
    font-size: 13px;
    line-height: 1.45;
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 13px;
    font-weight: 600;
  }

  .this {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--line);
    background: var(--raised);
  }

  .thumb {
    flex: none;
    width: 64px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 6px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .this-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .this-label {
    color: var(--dim);
    font-size: 11px;
    font-weight: 600;
  }

  .this-title {
    overflow: hidden;
    font-size: 13px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .this-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--dim);
    font-size: 12px;
  }

  .this-meta :global(.native) {
    color: var(--ink-2);
    font-size: 13px;
  }

  .this-meta .dot {
    width: 8px;
    height: 8px;
    border-radius: 2.5px;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }
</style>
