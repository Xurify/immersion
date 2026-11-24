<script lang="ts">
  import Strip from "../../ui/Strip.svelte";
  import LangName from "../../ui/LangName.svelte";
  import { clock, minutes } from "../../lib/format";
  import { data } from "../../lib/data.svelte";
  import { send } from "../../lib/messages";
  import { defaultBudget, planSession } from "../../lib/plan";
  import type { OpenVideo } from "../../lib/types";
  import LangBand from "./components/LangBand.svelte";

  /** Same cut as planSession: nothing to play in a clip with under 20 seconds left. */
  const playable = (video: OpenVideo) => video.remaining > 20 && video.duration > 0;

  let activeTabId = $state<number | null>(null);
  let error = $state("");

  const goalRows = $derived(data.progress.filter((row) => row.goalMinutes > 0));
  const hasGoals = $derived(goalRows.length > 0);
  const allMet = $derived(hasGoals && goalRows.every((row) => row.done));
  const plan = $derived(planSession(data.tabs, data.progress, allMet ? 20 : defaultBudget(data.progress)));
  const leftMinutes = $derived(minutes(data.leftToday));
  const thisTab = $derived(data.tabs.find((video) => video.tabId === activeTabId));
  const planEmpty = $derived(plan.videos.length === 0);

  /** A language's open videos: the ones in the plan first, in plan order, then the rest. */
  function tabsFor(lang: string): OpenVideo[] {
    const inPlan = plan.videos.filter((video) => video.lang === lang);
    const planned = new Set(inPlan.map((video) => video.tabId));
    const rest = data.tabs.filter((video) => video.lang === lang && playable(video) && !planned.has(video.tabId));
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

  async function start(tabIds: number[]) {
    error = "";
    try {
      await send("session:start", { tabIds });
      window.close();
    } catch {
      error = "Could not start the session. Try again.";
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

      {#if !planEmpty}
        <div class="strip">
          <Strip videos={plan.videos} labels={false} height={12} />
        </div>
      {/if}

      {#if hasGoals}
        <ul class="bands">
          {#each goalRows as row (row.lang)}
            <LangBand {row} next={tabsFor(row.lang)} onplay={start} />
          {/each}
        </ul>
      {:else}
        <div class="nogoals">
          <p class="note">Set a daily goal to plan your listening.</p>
          <button type="button" class="btn ghost" onclick={() => openDesk("today")}>Set goals</button>
        </div>
      {/if}

      {#if allMet}
        <p class="note">All goals met today</p>
      {/if}

      <div class="actions">
        {#if planEmpty}
          <p class="note" id="plan-reason">Open YouTube videos in the languages you're learning to plan a session.</p>
        {/if}
        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}
        <button
          type="button"
          class="btn"
          disabled={planEmpty}
          aria-describedby={planEmpty ? "plan-reason" : undefined}
          onclick={() => start(plan.videos.map((video) => video.tabId))}
        >
          {planEmpty ? "Start session →" : `Start ${minutes(plan.seconds)}-min session →`}
        </button>
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
