<script lang="ts">
  import { data } from "../../../lib/data.svelte";
  import { duration, endsAt, minutes } from "../../../lib/format";
  import { englishName, nativeName } from "../../../lib/languages";
  import { send } from "../../../lib/messages";
  import { defaultBudget, planSession, type Budget } from "../../../lib/plan";
  import type { OpenVideo } from "../../../lib/types";
  import Strip from "../../../ui/Strip.svelte";
  import LanguagePanel from "../components/today/LanguagePanel.svelte";
  import LengthPills from "../components/today/LengthPills.svelte";

  interface Props {
    onnavigate: (id: "today" | "videos" | "review" | "history") => void;
    onsettings: () => void;
  }

  let { onnavigate, onsettings }: Props = $props();

  const BUDGET_KEY = "today-budget";
  const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

  function readBudget(): Budget | null {
    try {
      const raw = localStorage.getItem(BUDGET_KEY);
      if (raw === "goals") return "goals";
      if (raw === "20") return 20;
      if (raw === "45") return 45;
      if (raw === "90") return 90;
      return null;
    } catch {
      // Storage can be blocked; the choice then lasts only as long as this page.
      return null;
    }
  }

  let stored = $state<Budget | null>(readBudget());
  let problem = $state("");
  let now = $state(Date.now());

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const goals = $derived(data.progress.filter((row) => row.goalMinutes > 0));
  const behind = $derived(goals.filter((row) => !row.done));
  const done = $derived(goals.filter((row) => row.done));
  const allMet = $derived(goals.length > 0 && behind.length === 0);
  // "Finish goals" only makes sense while a goal is open, so fall back to 45 otherwise.
  const budget = $derived(stored === "goals" && behind.length === 0 ? 45 : (stored ?? defaultBudget(data.progress)));

  const plan = $derived(planSession(data.tabs, data.progress, budget));
  const ready = $derived(plan.videos.length > 0);
  const planMinutes = $derived(Math.round(plan.seconds / 60));
  const leftMinutes = $derived(minutes(data.leftToday));

  const sentence = $derived.by(() => {
    const names = behind.map((row) => englishName(row.lang));
    const behindText = names.map((name, i) => (i === 0 ? `${name} first` : name)).join(", then ");
    const doneText = done.length
      ? ` ${list.format(done.map((row) => englishName(row.lang)))} ${done.length === 1 ? "is" : "are"} already done.`
      : "";
    const short = budget === "goals" && plan.seconds > 0 && plan.seconds < data.leftToday - 60;
    const cover = short ? ` Your open tabs cover ${minutes(plan.seconds)} min of it.` : "";
    return `left today. ${behindText}.${doneText}${cover}`;
  });

  const panels = $derived(
    goals.map((row) => ({
      row,
      next: plan.videos.find((video) => video.lang === row.lang) ?? data.tabs.find((video) => video.lang === row.lang) ?? null,
      own: planSession(data.tabs, [row], "goals"),
    })),
  );

  const alsoToday = $derived(data.progress.filter((row) => row.goalMinutes === 0));

  const emptyText = $derived(
    data.tabs.length === 0
      ? "Open a few YouTube videos in the languages you're learning, then come back to plan a session."
      : "None of the open videos can be planned yet. Live streams and videos still loading their length are left out.",
  );

  function setBudget(next: Budget) {
    stored = next;
    try {
      localStorage.setItem(BUDGET_KEY, String(next));
    } catch {
      // Blocked storage only means the choice is not remembered next time.
    }
  }

  async function call(action: Promise<unknown>) {
    problem = "";
    try {
      await action;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
  }

  function focusTab(video: OpenVideo) {
    void call(send("tabs:focus", { tabId: video.tabId }));
  }

  function start(tabIds: number[]) {
    if (tabIds.length) void call(send("session:start", { tabIds }));
  }

  function startPlan() {
    start(plan.videos.map((video) => video.tabId));
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "p" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], dialog")) return;
    if (!ready) return;
    event.preventDefault();
    startPlan();
  }
</script>

<svelte:window {onkeydown} />

<section class="today" aria-busy={!data.loaded}>
  {#if data.loaded}
    <h1 class="sr-only">Today</h1>

    <div class="hero">
      <div class="lead">
        {#if !goals.length}
          <div class="copy">
            <h2 class="headline">Set a daily goal</h2>
            <p class="sentence">Goals decide how much of each language a plan includes. Set one for each language you are studying.</p>
            <button class="btn small" type="button" onclick={onsettings}>Set a goal</button>
          </div>
        {:else if allMet}
          <div class="copy">
            <h2 class="headline">All goals met</h2>
            <p class="sentence">Every goal is done for today. Anything you start now is extra.</p>
          </div>
        {:else}
          <p class="figure big">{leftMinutes}<span class="unit">min</span></p>
          <p class="sentence">{sentence}</p>
        {/if}
      </div>

      <div class="cta">
        <button class="btn" type="button" disabled={!ready} onclick={startPlan}>
          {ready ? `Start ${planMinutes}-min session →` : "Start session →"}
        </button>
        {#if ready}
          <p>ends about {endsAt(plan.seconds, now)} · <kbd class="kbd">P</kbd></p>
        {/if}
      </div>
    </div>

    {#if ready}
      <Strip videos={plan.videos} onpick={focusTab} />
    {:else}
      <p class="empty">{emptyText}</p>
    {/if}

    <div class="plan-bar">
      <LengthPills value={budget} showFinish={behind.length > 0} onchange={setBudget} />
      <button class="btn ghost small" type="button" onclick={() => onnavigate("videos")}>All videos →</button>
    </div>

    {#if goals.length}
      <div class="panels">
        {#each panels as panel (panel.row.lang)}
          <LanguagePanel
            row={panel.row}
            next={panel.next}
            playMinutes={Math.round(panel.own.seconds / 60)}
            canPlay={panel.own.videos.length > 0}
            onplay={() => start(panel.own.videos.map((video) => video.tabId))}
          />
        {/each}
      </div>
    {/if}

    {#if alsoToday.length}
      <p class="also">Also today: {alsoToday.map((row) => `${nativeName(row.lang)} ${duration(row.listenedSeconds)}`).join(", ")}</p>
    {/if}

    {#if problem}
      <p class="problem" role="alert">Could not do that. {problem}</p>
    {/if}
  {/if}
</section>

<style>
  .today {
    display: flex;
    flex-direction: column;
    gap: 26px;
    padding: 14px clamp(16px, 3vw, 40px) 40px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 20px 26px;
  }

  .lead {
    display: flex;
    flex: 1 1 320px;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px 26px;
    min-width: 0;
  }

  .figure {
    margin: 0;
    font-size: clamp(96px, 12vw, 150px);
  }

  .figure :global(.unit) {
    font-size: 0.34em;
  }

  .sentence {
    max-width: 20em;
    margin: 0 0 8px;
    color: var(--ink-2);
    font-size: clamp(17px, 2vw, 20px);
    line-height: 1.35;
  }

  .copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .copy .sentence {
    margin: 0 0 10px;
  }

  .headline {
    margin: 0;
    font-size: clamp(44px, 6vw, 72px);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 0.95;
  }

  .cta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    margin-left: auto;
    text-align: right;
  }

  .cta p {
    margin: 0;
    color: var(--dim);
    font-size: 13px;
  }

  .plan-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 14px;
  }

  .panels {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .empty {
    margin: 0;
    padding: 24px 0;
    color: var(--ink-2);
    font-size: 16px;
  }

  .also {
    margin: 0;
    color: var(--dim);
    font-size: 14px;
  }

  .problem {
    margin: 0;
    color: var(--danger);
    font-size: 14px;
  }

  @media (max-width: 560px) {
    .cta {
      align-items: flex-start;
      margin-left: 0;
      text-align: left;
    }
  }
</style>
