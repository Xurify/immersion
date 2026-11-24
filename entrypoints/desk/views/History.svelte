<script lang="ts">
  import { data } from "../../../lib/data.svelte";
  import { duration, hoursClock } from "../../../lib/format";
  import { englishName } from "../../../lib/languages";
  import { onlyLangs, otherLangs, summarise } from "../../../lib/stats";
  import { save } from "../../../lib/storage";
  import LangName from "../../../ui/LangName.svelte";
  import LangPanels from "../components/history/LangPanels.svelte";
  import RangeChart from "../components/history/RangeChart.svelte";
  import WeekChart from "../components/history/WeekChart.svelte";

  let { onsettings }: { onsettings: () => void } = $props();

  const RANGES = [
    { days: 7, label: "Week", period: "week" },
    { days: 30, label: "Month", period: "month" },
    { days: 90, label: "Quarter", period: "quarter" },
  ] as const;
  const NEW_GOAL_MINUTES = 20;

  let rangeDays = $state<7 | 30 | 90>(7);
  const range = $derived(RANGES.find((item) => item.days === rangeDays) ?? RANGES[0]);

  const goalLangs = $derived(Object.keys(data.goals));
  const hasGoals = $derived(goalLangs.length > 0);
  // With goals set, History is about those languages; anything else YouTube played is listed on its own.
  const tracked = $derived(hasGoals ? onlyLangs(data.log, goalLangs) : data.log);
  const summary = $derived(summarise(tracked, data.goals, rangeDays));
  const calendar = $derived(summarise(tracked, data.goals, 28));
  const others = $derived(hasGoals ? otherLangs(data.log, goalLangs, summary.keys) : []);
  const goalSeconds = $derived(Object.values(data.goals).reduce((sum, minutes) => sum + minutes * 60, 0));
  const hasListening = $derived(Object.values(data.log).some((day) => Object.values(day).some((seconds) => seconds > 0)));

  const diff = $derived(summary.totalSeconds - summary.previousSeconds);
  const comparison = $derived.by(() => {
    if (Math.round(Math.abs(diff) / 60) === 0) return `The same as the ${range.period} before.`;
    return `${duration(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the ${range.period} before.`;
  });
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

  async function addGoal(lang: string) {
    const next = { ...data.goals, [lang]: NEW_GOAL_MINUTES };
    data.goals = next;
    await save("goals", next);
  }
</script>

<section class="history" aria-label="History">
  <div class="hero">
    {#if hasListening}
      <div class="figure">
        <p class="eyebrow">{hasGoals ? "Goal languages" : "Listened"}, last {rangeDays} days</p>
        <p class="total big">{hoursClock(summary.totalSeconds)}<span class="unit">h</span></p>
      </div>
      <div class="note">
        <p>{comparison}</p>
        {#if hasGoals}
          <p class="dim">{summary.allGoalsDays ? `Every goal hit on ${plural(summary.allGoalsDays, "day")}.` : "No day with every goal hit yet."}</p>
        {/if}
      </div>
    {/if}
    <div class="controls">
      <div class="seg" role="group" aria-label="Range">
        {#each RANGES as item (item.days)}
          <button type="button" aria-pressed={rangeDays === item.days} onclick={() => (rangeDays = item.days)}>
            {item.label}
          </button>
        {/each}
      </div>
      <button type="button" class="btn small ghost" onclick={onsettings}>Edit goals</button>
    </div>
  </div>

  {#if !hasListening}
    <div class="empty-state">
      <h2>No listening logged yet</h2>
      <p>
        Time counts while a YouTube video plays in a language. Each goal language gets its own panel here. Set a daily goal for each one in Settings.
      </p>
    </div>
  {:else}
    <div class="chart">
      {#if rangeDays === 7}
        <WeekChart {summary} {goalSeconds} />
      {:else}
        <RangeChart {summary} {goalSeconds} />
      {/if}
    </div>

    <LangPanels langs={summary.langs} calendar={calendar.langs} goals={data.goals} days={rangeDays} />

    {#if others.length}
      <div class="others">
        <h2>Also heard, not in your goals</h2>
        <ul>
          {#each others as item (item.lang)}
            <li>
              <LangName lang={item.lang} />
              <span class="time">{duration(item.seconds)}</span>
              <button type="button" class="add" aria-label="Add a goal for {englishName(item.lang)}" onclick={() => addGoal(item.lang)}>
                Add goal
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</section>

<style>
  .history {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 16px var(--gutter) 48px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px 32px;
  }

  .figure {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .eyebrow {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--dim);
  }

  .total {
    margin: 0;
    font-size: clamp(88px, 9vw, 120px);
  }

  .note {
    max-width: 24em;
  }

  .note p {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    color: var(--ink);
    text-wrap: pretty;
  }

  .note .dim {
    margin-top: 4px;
    font-size: 15px;
    color: var(--dim);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .controls .btn {
    min-height: 2.375rem;
  }

  .others h2 {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--dim);
  }

  .others ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .others li {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 2.5rem;
    padding: 0 6px 0 14px;
    border-radius: var(--pill);
    background: var(--soft);
    font-size: 14px;
  }

  .others li :global(.native) {
    font-size: 17px;
  }

  .time {
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }

  .add {
    min-height: 1.875rem;
    padding: 0 12px;
    border: 0;
    border-radius: var(--pill);
    background: var(--raised);
    box-shadow: inset 0 0 0 1px var(--line);
    font-size: 13px;
    font-weight: 600;
  }

  .add:hover {
    box-shadow: inset 0 0 0 1px var(--ink);
  }

  @media (max-width: 720px) {
    .history {
      gap: 24px;
    }

    .controls {
      margin-left: 0;
    }
  }
</style>
