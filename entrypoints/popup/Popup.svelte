<script lang="ts">
  import LangName from "../../ui/LangName.svelte";
  import { clock, minutes, thumbnail } from "../../lib/format";
  import { langColor } from "../../lib/colors.svelte";
  import { asPlannable, columnSeconds, stashesLang, stashKeepTabIds } from "../../lib/board";
  import { data } from "../../lib/data.svelte";
  import { send } from "../../lib/messages";
  import { defaultBudget, planSession } from "../../lib/plan";
  import type { OpenVideo } from "../../lib/types";
  import { englishName } from "../../lib/languages";
  import LanguagePicker from "../../ui/LanguagePicker.svelte";
  import GoalRing, { type RingSegment } from "../../ui/GoalRing.svelte";
  import LangBand from "./components/LangBand.svelte";
  import DoneChip from "./components/DoneChip.svelte";

  const playable = (video: OpenVideo): boolean => video.remaining > 20 && video.duration > 0;
  const STASH_FROM = 5;

  let activeTabId = $state<number | null>(null);
  let error = $state("");
  let retrying = $state(false);
  let tabNote = $state("");
  let pickingLang = $state(false);
  let langScope = $state<"video" | "channel">("video");

  const goalRows = $derived(data.progress.filter((progressRow) => progressRow.isGoal));
  const activeRows = $derived(goalRows.filter((progressRow) => !progressRow.done));
  const doneRows = $derived(goalRows.filter((progressRow) => progressRow.done));
  const hasGoals = $derived(goalRows.length > 0);
  const allMet = $derived(hasGoals && activeRows.length === 0);

  const sources = $derived.by((): OpenVideo[] => {
    const board = data.board;
    const tabFor = (videoId: string): OpenVideo | undefined => data.tabs.find((video) => video.videoId === videoId);
    const cards = [...board.columns.next, ...board.columns.inbox]
      .map((cardId) => board.cards[cardId])
      .filter((card) => card != null && card.videoId !== data.nowPlaying?.videoId)
      .map((card) => asPlannable(card!, tabFor(card!.videoId)));
    const untracked = data.tabs.filter((video) => !board.cards[video.videoId] && video.tabId !== data.nowPlaying?.tabId);
    return [...cards, ...untracked];
  });

  const plan = $derived(planSession(sources, data.progress, allMet ? 20 : defaultBudget(data.progress)));
  const leftMinutes = $derived(minutes(data.leftToday));
  const totalListenedMinutes = $derived(
    Math.floor(goalRows.reduce((accumulator, progressRow) => accumulator + progressRow.listenedSeconds, 0) / 60),
  );
  const totalGoalMinutes = $derived(
    goalRows.reduce((accumulator, progressRow) => accumulator + progressRow.goalMinutes, 0),
  );
  const overallPercent = $derived.by((): number => {
    if (!hasGoals) return 0;
    if (allMet) return 100;
    if (totalGoalMinutes <= 0) return Math.round((doneRows.length / goalRows.length) * 100);
    const cappedSeconds = goalRows.reduce(
      (accumulator, progressRow) => accumulator + Math.min(progressRow.listenedSeconds, progressRow.goalMinutes * 60),
      0,
    );
    return Math.min(100, Math.round((cappedSeconds / (totalGoalMinutes * 60)) * 100));
  });

  const thisTab = $derived(data.tabs.find((video) => video.tabId === activeTabId));
  const planEmpty = $derived(plan.videos.length === 0);
  const unreadCount = $derived(data.tabs.filter((video) => video.duration <= 0).length);
  const reading = $derived(unreadCount > 0);

  const ringSegments = $derived<RingSegment[]>(
    goalRows.map((progressRow) => ({
      lang: progressRow.lang,
      weight: Math.max(progressRow.goalMinutes, 1),
      percent:
        progressRow.goalMinutes > 0
          ? Math.min(100, (progressRow.listenedSeconds / (progressRow.goalMinutes * 60)) * 100)
          : 100,
    })),
  );

  const thisTabKnown = $derived(Boolean(thisTab && thisTab.duration > 0));
  const upNextCount = $derived(data.board.columns.next.length);
  const upNextMinutes = $derived(minutes(columnSeconds(data.board, "next")));

  const nowTitle = $derived.by((): string => {
    const current = data.nowPlaying;
    if (!current) return "";
    return data.board.cards[current.videoId]?.title ?? data.tabs.find((video) => video.tabId === current.tabId)?.title ?? "";
  });

  const nowLang = $derived.by((): string | null => {
    const current = data.nowPlaying;
    if (!current) return null;
    return data.tabs.find((video) => video.tabId === current.tabId)?.lang ?? data.board.cards[current.videoId]?.lang ?? null;
  });

  const isThisTabPlaying = $derived(
    Boolean(data.nowPlaying && !data.nowPlaying.session && thisTab && data.nowPlaying.tabId === thisTab.tabId),
  );
  const showNowBar = $derived(Boolean(data.nowPlaying && !isThisTabPlaying));

  const stashable = $derived.by((): number => {
    const goalLangs = Object.keys(data.goals);
    const keep = stashKeepTabIds(data.playing, data.tabs, goalLangs);
    return data.tabs.filter((video) => !keep.includes(video.tabId) && stashesLang(video.lang, goalLangs)).length;
  });

  const showPrimaryPlay = $derived(!data.playing && (upNextCount > 0 || !planEmpty));
  const showHeroActions = $derived(showPrimaryPlay || stashable >= STASH_FROM);

  const followsThisTab = $derived(
    Boolean(thisTab && Object.values(data.follows).some((follow) => follow.name === thisTab.channel)),
  );

  function tabsFor(lang: string): OpenVideo[] {
    const resume = sources.find(
      (video) => video.lang === lang && playable(video) && data.board.columns.next.includes(video.videoId),
    );
    const isOther = (video: OpenVideo): boolean => video.videoId !== resume?.videoId;
    const inPlan = plan.videos.filter((video) => video.lang === lang && isOther(video));
    const planned = new Set(inPlan.map((video) => video.videoId));
    const rest = sources.filter(
      (video) => video.lang === lang && playable(video) && !planned.has(video.videoId) && isOther(video),
    );
    return [...(resume ? [resume] : []), ...inPlan, ...rest];
  }

  async function handleOpenDesk(view?: string): Promise<void> {
    error = "";
    try {
      await send("desk:open", { view });
      window.close();
    } catch {
      error = "Could not open the desk. Try again.";
    }
  }

  async function handleStart(videos: OpenVideo[]): Promise<void> {
    error = "";
    try {
      const untracked = videos.filter((video) => !data.board.cards[video.videoId]).map((video) => video.videoId);
      if (untracked.length) await send("board:add", { videoIds: untracked, column: "next", index: 0 });
      for (const video of [...videos].reverse()) {
        await send("board:move", { videoId: video.videoId, column: "next", index: 0 });
      }
      await send("board:play", {});
      window.close();
    } catch {
      error = "Could not start the session. Try again.";
    }
  }

  async function handlePlayUpNext(): Promise<void> {
    error = "";
    try {
      await send("board:play", {});
      window.close();
    } catch {
      error = "Could not start Up next. Try again.";
    }
  }

  async function handlePause(): Promise<void> {
    error = "";
    try {
      await send("board:pause", {});
    } catch {
      error = "Could not pause. Try again.";
    }
  }

  async function handleShowNow(): Promise<void> {
    const current = data.nowPlaying;
    if (!current) return;
    error = "";
    try {
      await send("tabs:focus", { tabId: current.tabId });
      window.close();
    } catch {
      error = "Could not switch to that tab. Try again.";
    }
  }

  async function handleSkip(): Promise<void> {
    error = "";
    try {
      await send("board:skip", {});
    } catch {
      error = "Could not skip. Try again.";
    }
  }

  async function handleFileThisTab(column: "inbox" | "next" | "later"): Promise<void> {
    const video = thisTab;
    if (!video) return;
    error = "";
    try {
      if (column === "inbox") await send("board:stash", { videoIds: [video.videoId] });
      else await send("board:add", { videoIds: [video.videoId], column });
      if (column === "later") await send("board:move", { videoId: video.videoId, column: "later" });
      tabNote =
        column === "next"
          ? "Added to Up next"
          : column === "later"
            ? "Saved for later, tab closed"
            : "Stashed to Inbox, tab closed";
    } catch {
      error = "Could not file this tab. Try again.";
    }
  }

  async function handleFollowThisTab(): Promise<void> {
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

  async function handleSetThisTabLang(lang: string): Promise<void> {
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

  async function handleRetryDetails(): Promise<void> {
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

  async function handleStashTabs(): Promise<void> {
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
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="2" y="9" width="4" height="6" rx="2" fill="currentColor" opacity="0.45" />
        <rect x="8" y="4" width="4" height="16" rx="2" fill="currentColor" />
        <rect x="14" y="7" width="4" height="10" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
      <h1>Immersion</h1>
    </span>

    <button type="button" class="desk" onclick={() => handleOpenDesk()}>
      Open desk
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </header>

  <div class={["body", !data.loaded && "pending"]}>
    {#if data.loaded}
      {#if hasGoals}
        <section class={["hero-card", allMet && "celebrating"]}>
          <div class="hero-top">
            <div class="hero-copy">
              <p class="hero-eyebrow">{allMet ? "Every goal met today" : "Left today"}</p>
              <p class="big hero-figure">
                {allMet ? totalListenedMinutes : leftMinutes}<span class="unit">min</span>
              </p>
              <p class="hero-meta">
                {#if allMet}
                  <span>{goalRows.length} of {goalRows.length} languages completed</span>
                {:else}
                  <span class="num">{totalListenedMinutes} min listened</span>
                  <span aria-hidden="true">·</span>
                  <span class="num">{doneRows.length} of {goalRows.length} done</span>
                {/if}
              </p>
            </div>

            <GoalRing
              segments={ringSegments}
              {overallPercent}
              doneCount={doneRows.length}
              totalCount={goalRows.length}
              {allMet}
            />
          </div>

          {#if showHeroActions}
            <div class="hero-actions">
              {#if !data.playing && upNextCount > 0}
                <button type="button" class="cta-primary" onclick={handlePlayUpNext}>
                  <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
                  <span>{upNextMinutes ? `Play Up next · ${upNextMinutes} min` : "Play Up next"}</span>
                </button>
              {:else if !data.playing && !planEmpty}
                <button type="button" class="cta-primary" onclick={() => handleStart(plan.videos)}>
                  <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
                  <span>Start {minutes(plan.seconds)}-min session</span>
                </button>
              {/if}

              {#if stashable >= STASH_FROM}
                <button type="button" class={["cta-stash", !showPrimaryPlay && "full"]} onclick={handleStashTabs}>
                  Stash {stashable} {stashable === 1 ? "tab" : "tabs"}
                </button>
              {/if}
            </div>
          {/if}

          {#if reading}
            <p class="status" role="status">
              <span class="spinner" aria-hidden="true"></span>
              <span>Reading {unreadCount} of {data.tabs.length} tabs…</span>
              <button type="button" class="retry" disabled={retrying} onclick={handleRetryDetails}>
                {retrying ? "Retrying" : "Retry"}
              </button>
            </p>
          {/if}
        </section>
      {/if}

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      {#if showNowBar && data.nowPlaying}
        <div class="now-bar" style:--now-c={langColor(nowLang)}>
          <span class="now-thumb">
            <img src={thumbnail(data.nowPlaying.videoId)} alt="" width="48" height="27" />
            <span class="now-eq" aria-hidden="true"><i></i><i></i><i></i></span>
          </span>
          <p class="now-text">
            <span class="now-label">{data.nowPlaying.session ? "Session playing" : "Playing in another tab"}</span>
            <span class="now-title">{nowTitle}</span>
          </p>
          <div class="now-buttons">
            {#if data.nowPlaying.session}
              <button type="button" class="now-btn" onclick={handlePause}>Pause</button>
              <button type="button" class="now-btn ghost" onclick={handleSkip}>Skip</button>
            {:else}
              <button type="button" class="now-btn" onclick={handleShowNow}>Show tab</button>
            {/if}
          </div>
        </div>
      {/if}

      {#if hasGoals}
        {#if activeRows.length > 0}
          <section class="group" aria-label="Remaining goals">
            <ul class="bento">
              {#each activeRows as progressRow, index (progressRow.lang)}
                {@const isOddLast = activeRows.length % 2 === 1 && index === activeRows.length - 1}
                <LangBand
                  row={progressRow}
                  next={tabsFor(progressRow.lang)}
                  {reading}
                  playing={nowLang === progressRow.lang}
                  wide={isOddLast}
                  onplay={handleStart}
                  onshow={handleShowNow}
                />
              {/each}
            </ul>
          </section>
        {/if}

        {#if doneRows.length > 0}
          <section class="group" aria-label="Completed today">
            {#if activeRows.length > 0}
              <div class="section-head">
                <span class="section-label">Completed today</span>
                <span class="section-rule" aria-hidden="true"></span>
              </div>
            {/if}
            <ul class="done-grid">
              {#each doneRows as progressRow (progressRow.lang)}
                <DoneChip row={progressRow} playing={nowLang === progressRow.lang} expanded={allMet} />
              {/each}
            </ul>
          </section>
        {/if}

        {#if !data.playing && !upNextCount && planEmpty && !allMet}
          <p class="hint">
            {reading
              ? "A session can start once your open tabs finish loading."
              : "Open YouTube videos in your goal languages to build a session."}
          </p>
        {/if}
      {:else}
        <section class="nogoals">
          <div class="nogoals-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <rect x="2" y="9" width="4" height="6" rx="2" fill="currentColor" opacity="0.45" />
              <rect x="8" y="4" width="4" height="16" rx="2" fill="currentColor" />
              <rect x="14" y="7" width="4" height="10" rx="2" fill="currentColor" opacity="0.7" />
              <rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor" opacity="0.35" />
            </svg>
          </div>
          <p class="title">Set a daily goal</p>
          <p class="note">Pick the languages you're learning and how many minutes a day. Immersion will track progress and queue sessions automatically.</p>
          <button type="button" class="btn small" onclick={() => handleOpenDesk("board")}>Set goals</button>
        </section>
      {/if}
    {:else}
      <div class="skeleton" aria-hidden="true">
        <div class="skel-hero"></div>
        <div class="skel-grid">
          <div class="skel-tile"></div>
          <div class="skel-tile"></div>
        </div>
      </div>
    {/if}
  </div>

  {#if data.loaded && thisTab}
    <footer class="this-dock">
      {#if pickingLang}
        <div class="picker">
          <div class="picker-head">
            <span class="this-label">Language for</span>
            <div class="picker-controls">
              <div class="seg" role="group" aria-label="Apply to">
                <button type="button" aria-pressed={langScope === "video"} onclick={() => (langScope = "video")}>This video</button>
                <button type="button" aria-pressed={langScope === "channel"} disabled={!thisTab.channel} onclick={() => (langScope = "channel")}>Channel</button>
              </div>
              <button type="button" class="picker-close" onclick={() => (pickingLang = false)} aria-label="Close language picker">
                <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
                  <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <LanguagePicker suggested={Object.keys(data.goals)} onpick={handleSetThisTabLang} label="Language for this tab" />
        </div>
      {/if}

      <div class="this-media">
        <span class="thumb" style:--c={langColor(thisTab.lang)}>
          <img src={thumbnail(thisTab.videoId)} alt="" width="72" height="40" />
          <span class="thumb-bar" aria-hidden="true"></span>
          {#if isThisTabPlaying}
            <span class="thumb-live" aria-hidden="true"><i></i><i></i><i></i></span>
          {/if}
        </span>

        <div class="this-text">
          <div class="this-top">
            {#if isThisTabPlaying}
              <span class="live-tag"><i aria-hidden="true"></i>Playing · This tab</span>
            {:else}
              <span class="this-label">This tab</span>
            {/if}

            {#if thisTab.channel}
              {#if followsThisTab}
                <span class="following">Following</span>
              {:else}
                <button type="button" class="follow" onclick={handleFollowThisTab}>+ Follow</button>
              {/if}
            {/if}
          </div>

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
        </div>
      </div>

      <div class="tab-actions" role="group" aria-label="This tab">
        {#if tabNote}
          <p class="tab-note" role="status">
            <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
              <path d="M2.5 7.3 5.5 10.3 11.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{tabNote}</span>
          </p>
        {:else}
          <button type="button" onclick={() => handleFileThisTab("inbox")}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M2.5 9.5 4.2 3.5h7.6l1.7 6v3.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V9.5Zm0 0h3.3l1 1.6h2.4l1-1.6h3.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Inbox</span>
          </button>
          <button type="button" onclick={() => handleFileThisTab("next")}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M3 4.5h6M3 8h4.5M3 11.5h6M11 6.5l3 2-3 2v-4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Up next</span>
          </button>
          <button type="button" onclick={() => handleFileThisTab("later")}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path d="M8 5v3.2l2.1 1.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Later</span>
          </button>
          <button type="button" aria-expanded={pickingLang} onclick={() => (pickingLang = !pickingLang)}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path d="M2.8 8h10.4M8 2.5c1.7 1.7 1.7 9.3 0 11M8 2.5c-1.7 1.7-1.7 9.3 0 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
            <span>Language</span>
          </button>
        {/if}
      </div>
    </footer>
  {/if}
</main>

<style>
  :global(body) {
    width: 428px;
    min-height: 0;
  }

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
    height: 46px;
    padding-inline: 16px 14px;
    background: color-mix(in srgb, var(--bg) 90%, transparent);
    backdrop-filter: blur(10px);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  h1 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .desk {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 28px;
    padding-inline: 10px;
    border: 0;
    border-radius: 8px;
    background: light-dark(var(--raised), var(--soft));
    box-shadow: inset 0 0 0 1px var(--line-2);
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 650;
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease;
  }

  .desk:hover {
    background: var(--ink);
    box-shadow: inset 0 0 0 1px var(--ink);
    color: var(--on-ink);
  }

  .desk:active {
    transform: scale(0.96);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 2px 14px 14px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--line-2) transparent;
  }

  .body::-webkit-scrollbar {
    width: 5px;
  }

  .body::-webkit-scrollbar-track {
    background: transparent;
  }

  .body::-webkit-scrollbar-thumb {
    border-radius: var(--pill);
    background: var(--line-2);
  }

  .body.pending {
    min-height: 280px;
  }

  .hero-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
    background: var(--raised);
    box-shadow: var(--lift);
  }

  .hero-card.celebrating {
    box-shadow: 0 0 0 1px light-dark(color-mix(in srgb, #15803d 32%, var(--line)), color-mix(in srgb, #4ade80 30%, var(--line))), 0 1px 2px light-dark(rgba(22, 21, 19, 0.04), rgba(0, 0, 0, 0.28));
  }

  .hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .hero-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .hero-eyebrow {
    margin: 0;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--dim);
  }

  .hero-card.celebrating .hero-eyebrow {
    color: light-dark(#15803d, #4ade80);
  }

  .hero-figure {
    margin: 1px 0 0;
    font-size: 48px;
    line-height: 0.88;
  }

  .hero-figure .unit {
    margin-inline-start: 0.1em;
    font-size: 0.34em;
    color: var(--ink-2);
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--dim);
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cta-primary {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 36px;
    padding-inline: 14px;
    border: 0;
    border-radius: 9px;
    background: var(--ink);
    color: var(--on-ink);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    transition: opacity 0.14s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .cta-primary:hover {
    opacity: 0.9;
  }

  .cta-primary:active {
    transform: scale(0.96);
  }

  .cta-stash {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding-inline: 12px;
    border: 0;
    border-radius: 9px;
    background: light-dark(var(--raised), var(--soft));
    box-shadow: inset 0 0 0 1px var(--line-2);
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 650;
    white-space: nowrap;
    transition: background-color 0.14s ease, color 0.14s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .cta-stash.full {
    flex: 1;
  }

  .cta-stash:hover {
    background: var(--line);
    color: var(--ink);
  }

  .cta-stash:active {
    transform: scale(0.96);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    color: var(--dim);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .retry {
    margin-inline-start: auto;
    padding: 3px 9px;
    border: 0;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 11.5px;
    font-weight: 700;
    transition: background-color 0.14s ease, color 0.14s ease;
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

  .now-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 8px;
    border-radius: 12px;
    background: var(--raised);
    box-shadow: var(--lift);
    color: var(--ink);
  }

  .now-thumb {
    position: relative;
    flex: none;
    width: 48px;
    aspect-ratio: 16 / 9;
    border-radius: 7px;
    overflow: hidden;
    background: var(--now-c);
    outline: 1px solid light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.12));
    outline-offset: -1px;
  }

  .now-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .now-eq,
  .thumb-live {
    position: absolute;
    inset-inline-end: 3px;
    bottom: 3px;
    display: inline-flex;
    align-items: flex-end;
    gap: 1.5px;
    height: 12px;
    padding: 2px 3px;
    border-radius: 4px;
    background: rgb(14 13 12 / 0.78);
  }

  .now-eq i,
  .thumb-live i {
    display: block;
    width: 2px;
    border-radius: 1px;
    background: #4ade80;
    animation: bar-wave 0.85s ease-in-out infinite alternate;
  }

  .now-eq i:nth-child(1),
  .thumb-live i:nth-child(1) {
    height: 4px;
    animation-delay: 0s;
  }

  .now-eq i:nth-child(2),
  .thumb-live i:nth-child(2) {
    height: 8px;
    animation-delay: 0.2s;
  }

  .now-eq i:nth-child(3),
  .thumb-live i:nth-child(3) {
    height: 6px;
    animation-delay: 0.4s;
  }

  @keyframes bar-wave {
    from {
      transform: scaleY(0.4);
    }
    to {
      transform: scaleY(1);
    }
  }

  .now-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 0;
  }

  .now-label {
    font-size: 10.5px;
    font-weight: 700;
    color: light-dark(
      color-mix(in srgb, var(--now-c) 84%, var(--ink)),
      color-mix(in srgb, var(--now-c) 44%, var(--ink))
    );
  }

  .now-title {
    overflow: hidden;
    font-size: 12.5px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .now-buttons {
    flex: none;
    display: flex;
    gap: 5px;
  }

  .now-btn {
    min-height: 28px;
    padding-inline: 10px;
    border: 0;
    border-radius: var(--pill);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    transition: opacity 0.14s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .now-btn.ghost {
    background: transparent;
    color: var(--ink);
    box-shadow: inset 0 0 0 1.25px color-mix(in srgb, var(--ink) 35%, transparent);
  }

  .now-btn:hover {
    opacity: 0.88;
  }

  .now-btn:active {
    transform: scale(0.96);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bento {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-inline: 2px;
  }

  .section-label {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    color: var(--dim);
  }

  .section-rule {
    flex: 1;
    height: 1px;
    background: var(--line);
  }

  .done-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .done-grid > :global(:last-child:nth-child(odd)) {
    grid-column: 1 / -1;
  }

  .hint {
    margin: 0;
    padding-inline: 2px;
    color: var(--dim);
    font-size: 12.5px;
    line-height: 1.45;
  }

  .nogoals {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 20px;
    border-radius: 20px;
    background: var(--raised);
    box-shadow: var(--lift);
  }

  .nogoals-mark {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: 2px;
    border-radius: 12px;
    background: var(--soft);
    color: var(--ink);
  }

  .nogoals .title {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.025em;
  }

  .nogoals .note {
    margin: 0 0 4px;
    color: var(--dim);
    font-size: 13px;
    line-height: 1.45;
  }

  .error {
    margin: 0;
    padding: 8px 12px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--danger) 12%, var(--raised));
    color: var(--danger);
    font-size: 12.5px;
    font-weight: 650;
  }

  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skel-hero {
    height: 112px;
    border-radius: 20px;
    background: var(--soft);
  }

  .skel-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .skel-tile {
    height: 116px;
    border-radius: 16px;
    background: var(--soft);
  }

  .this-dock {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px 13px;
    border-top: 1px solid var(--line);
    background: var(--raised);
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }

  .picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .picker-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .picker-head .seg button {
    min-height: 1.7rem;
    padding-inline: 10px;
    font-size: 12px;
  }

  .picker-close {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: var(--soft);
    color: var(--dim);
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .picker-close:hover {
    background: var(--line);
    color: var(--ink);
  }

  .this-media {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .thumb {
    position: relative;
    flex: none;
    width: 72px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 8px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
    outline: 1px solid light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.12));
    outline-offset: -1px;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-bar {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 3px;
    background: var(--c);
  }

  .this-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .this-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .this-label {
    color: var(--dim);
    font-size: 11px;
    font-weight: 700;
  }

  .live-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: light-dark(#15803d, #4ade80);
    font-size: 11px;
    font-weight: 700;
  }

  .live-tag i {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .follow,
  .following {
    padding: 2px 8px;
    border: 0;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 11px;
    font-weight: 700;
    transition: background-color 0.14s ease, color 0.14s ease, transform 0.12s ease;
  }

  .follow:hover {
    background: var(--ink);
    color: var(--on-ink);
  }

  .follow:active {
    transform: scale(0.96);
  }

  .following {
    background: transparent;
    padding-inline: 0;
    color: var(--dim);
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
    font-size: 11.5px;
  }

  .this-meta :global(.native) {
    color: var(--ink-2);
    font-size: 12.5px;
  }

  .this-meta .dot {
    width: 7px;
    height: 7px;
    border-radius: 2.5px;
  }

  .tab-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .tab-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 31px;
    padding-inline: 6px;
    border: 0;
    border-radius: 8px;
    background: light-dark(var(--bg), var(--soft));
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
    transition: background-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .tab-actions button:hover,
  .tab-actions button[aria-expanded="true"] {
    background: var(--ink);
    box-shadow: inset 0 0 0 1px var(--ink);
    color: var(--on-ink);
  }

  .tab-actions button:active {
    transform: scale(0.96);
  }

  .tab-note {
    grid-column: 1 / -1;
    margin: 0;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 10px;
    background: var(--soft);
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--ink);
    font-size: 12px;
    font-weight: 650;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }
</style>
