<script lang="ts">
  import LangName from "../../ui/LangName.svelte";
  import { clock, minutes, thumbnail } from "../../lib/format";
  import { langColor } from "../../lib/colors.svelte";
  import { columnSeconds } from "../../lib/board";
  import { data } from "../../lib/data.svelte";
  import { send } from "../../lib/messages";
  import { asPlannable, stashesLang, stashKeepTabIds } from "../../lib/board";
  import { defaultBudget, planSession } from "../../lib/plan";
  import type { OpenVideo } from "../../lib/types";
  import LangBand from "./components/LangBand.svelte";
  import LanguagePicker from "../../ui/LanguagePicker.svelte";
  import { englishName } from "../../lib/languages";

  /** Same cut as planSession: nothing to play in a clip with under 20 seconds left. */
  const playable = (video: OpenVideo) => video.remaining > 20 && video.duration > 0;
  /** Stash is offered only from this many open tabs; fewer is not hoarding yet. */
  const STASH_FROM = 5;

  let activeTabId = $state<number | null>(null);
  let error = $state("");
  let retrying = $state(false);
  let tabNote = $state("");
  let pickingLang = $state(false);
  let langScope = $state<"video" | "channel">("video");

  const goalRows = $derived(data.progress.filter((row) => row.isGoal));
  const hasGoals = $derived(goalRows.length > 0);
  const allMet = $derived(hasGoals && goalRows.every((row) => row.done));
  /** Board cards (Up next, then Inbox) and open tabs not on the board yet: what the popup can plan from after tabs are stashed. */
  const sources = $derived.by(() => {
    const board = data.board;
    const tabFor = (videoId: string) => data.tabs.find((video) => video.videoId === videoId);
    const cards = [...board.columns.next, ...board.columns.inbox]
      .map((id) => board.cards[id])
      .filter((card) => card != null && card.videoId !== data.nowPlaying?.videoId)
      .map((card) => asPlannable(card!, tabFor(card!.videoId)));
    const untracked = data.tabs.filter((video) => !board.cards[video.videoId] && video.tabId !== data.nowPlaying?.tabId);
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
    const now = data.nowPlaying;
    if (!now) return "";
    return data.board.cards[now.videoId]?.title ?? data.tabs.find((video) => video.tabId === now.tabId)?.title ?? "";
  });
  /** Stashing leaves playing tabs and tabs outside the goal languages open, so they are not counted. */
  const stashable = $derived.by(() => {
    const keep = stashKeepTabIds(data.tabs, [data.playing?.tabId, data.nowPlaying?.tabId]);
    return data.tabs.filter((video) => !keep.includes(video.tabId) && stashesLang(video.lang, Object.keys(data.goals))).length;
  });

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

  async function showNow() {
    const now = data.nowPlaying;
    if (!now) return;
    error = "";
    try {
      await send("tabs:focus", { tabId: now.tabId });
      window.close();
    } catch {
      error = "Could not switch to that tab. Try again.";
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

  /** Files the current tab on the board. Inbox and Later close the tab; Up next keeps it open. */
  async function fileThisTab(column: "inbox" | "next" | "later") {
    const video = thisTab;
    if (!video) return;
    error = "";
    try {
      if (column === "inbox") await send("board:stash", { videoIds: [video.videoId] });
      else await send("board:add", { videoIds: [video.videoId], column });
      if (column === "later") await send("board:move", { videoId: video.videoId, column: "later" });
      tabNote = column === "next" ? "Added to Up next" : column === "later" ? "Saved for later, tab closed" : "Stashed to Inbox, tab closed";
    } catch {
      error = "Could not file this tab. Try again.";
    }
  }

  const followsThisTab = $derived(Boolean(thisTab && Object.values(data.follows).some((follow) => follow.name === thisTab.channel)));

  async function followThisTab() {
    const video = thisTab;
    if (!video) return;
    error = "";
    try {
      const { name, added } = await send("channels:follow", { videoId: video.videoId });
      tabNote = `Following ${name}${added ? `, ${added} new in Inbox` : ""}`;
    } catch (problem) {
      error = problem instanceof Error ? problem.message : "Could not follow this channel.";
    }
  }

  async function setThisTabLang(lang: string) {
    const video = thisTab;
    if (!video) return;
    error = "";
    try {
      await send("lang:override", { videoId: video.videoId, channel: video.channel, lang, scope: langScope });
      pickingLang = false;
      tabNote = langScope === "channel" ? `${video.channel} set to ${englishName(lang)}` : `Set to ${englishName(lang)}`;
    } catch {
      error = "Could not change the language. Try again.";
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

      {#if data.nowPlaying}
        <div class="now">
          <span class="live-dot" aria-hidden="true"></span>
          <p class="now-text"><span class="now-label">Playing</span><span class="now-title">{nowTitle}</span></p>
          <div class="now-buttons">
            {#if data.nowPlaying.session}
              <button type="button" class="btn ghost small" onclick={pause}>Pause</button>
              <button type="button" class="btn ghost small" onclick={skip}>Skip</button>
            {:else}
              <button type="button" class="btn ghost small" onclick={showNow}>Show tab</button>
            {/if}
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
        {#if stashable >= STASH_FROM}
          <button type="button" class="btn ghost stash" onclick={stashTabs}>
            Stash {stashable} {stashable === 1 ? "tab" : "tabs"} to Inbox
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if data.loaded && thisTab}
    <footer class="this-wrap">
    {#if pickingLang}
      <div class="picker">
        <div class="picker-head">
          <span class="this-label">Language for</span>
          <div class="seg" role="group" aria-label="Apply to">
            <button type="button" aria-pressed={langScope === "video"} onclick={() => (langScope = "video")}>This video</button>
            <button type="button" aria-pressed={langScope === "channel"} disabled={!thisTab.channel} onclick={() => (langScope = "channel")}>Whole channel</button>
          </div>
        </div>
        <LanguagePicker suggested={Object.keys(data.goals)} onpick={setThisTabLang} label="Language for this tab" />
      </div>
    {/if}
    <div class="this">
      <span class="thumb" style:--c={langColor(thisTab.lang)}>
        <img src={thumbnail(thisTab.videoId)} alt="" width="64" height="36" />
      </span>
      <span class="this-text">
        <span class="this-top">
          <span class="this-label">This tab</span>
          {#if thisTab.channel}
            {#if followsThisTab}
              <span class="following">Following</span>
            {:else}
              <button type="button" class="follow" onclick={followThisTab}>+ Follow channel</button>
            {/if}
          {/if}
        </span>
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
    </div>
    <div class="tab-actions" role="group" aria-label="This tab">
      {#if tabNote}
        <p class="tab-note" role="status">{tabNote}</p>
      {:else}
        <button type="button" onclick={() => fileThisTab("inbox")}>Inbox</button>
        <button type="button" onclick={() => fileThisTab("next")}>Up next</button>
        <button type="button" onclick={() => fileThisTab("later")}>Later</button>
        <button type="button" aria-expanded={pickingLang} onclick={() => (pickingLang = !pickingLang)}>Language</button>
      {/if}
    </div>
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

  .live-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    /* Sits on the inverted card: bright green on dark ink, deep green on light ink. */
    background: light-dark(#3ddc84, #15803d);
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

  .this-wrap {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--line);
    background: var(--raised);
  }

  .this {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .picker-head .seg button {
    min-height: 1.75rem;
    padding: 0 10px;
    font-size: 12px;
  }

  .tab-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .tab-actions button {
    min-height: 2rem;
    padding: 0 6px;
    border: 0;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 12.5px;
    font-weight: 600;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .tab-actions button:hover,
  .tab-actions button[aria-expanded="true"] {
    background: var(--ink);
    color: var(--on-ink);
  }

  .tab-note {
    grid-column: 1 / -1;
    margin: 0;
    min-height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 12.5px;
    font-weight: 600;
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

  .this-text {
    flex: 1;
  }

  .this-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .follow,
  .following {
    padding: 0;
    border: 0;
    background: none;
    color: var(--dim);
    font-size: 11.5px;
    font-weight: 700;
  }

  .follow:hover {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 2px;
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
