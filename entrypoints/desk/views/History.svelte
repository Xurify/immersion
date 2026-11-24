<script lang="ts">
  import { data } from "../../../lib/data.svelte";
  import { duration, hoursClock } from "../../../lib/format";
  import { summarise } from "../../../lib/stats";
  import LangPanels from "../components/history/LangPanels.svelte";
  import RangeChart from "../components/history/RangeChart.svelte";
  import WeekChart from "../components/history/WeekChart.svelte";

  let { onsettings }: { onsettings: () => void } = $props();

  const RANGES = [
    { days: 7, label: "Week", period: "week" },
    { days: 30, label: "Month", period: "month" },
    { days: 90, label: "Quarter", period: "quarter" },
  ] as const;

  let rangeDays = $state<7 | 30 | 90>(7);
  const range = $derived(RANGES.find((item) => item.days === rangeDays) ?? RANGES[0]);

  const summary = $derived(summarise(data.log, data.goals, rangeDays));
  const calendar = $derived(summarise(data.log, data.goals, 28));
  const goalSeconds = $derived(Object.values(data.goals).reduce((sum, minutes) => sum + minutes * 60, 0));
  const hasGoals = $derived(Object.keys(data.goals).length > 0);
  const hasListening = $derived(Object.values(data.log).some((day) => Object.values(day).some((seconds) => seconds > 0)));

  const diff = $derived(summary.totalSeconds - summary.previousSeconds);
  const comparison = $derived.by(() => {
    if (Math.round(Math.abs(diff) / 60) === 0) return `The same as the ${range.period} before.`;
    return `${duration(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the ${range.period} before.`;
  });
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
</script>

<section class="history" aria-label="History">
  <div class="top">
    {#if hasListening}
      <p class="total big">{hoursClock(summary.totalSeconds)}<span class="unit">h</span></p>
      <div class="note">
        <p>{comparison}</p>
        {#if hasGoals}
          <p class="dim">{summary.allGoalsDays ? `Every goal hit on ${plural(summary.allGoalsDays, "day")}.` : "No day with every goal hit yet."}</p>
        {/if}
      </div>
    {/if}
    <div class="controls">
      <div class="pills" role="group" aria-label="Range">
        {#each RANGES as item (item.days)}
          <button type="button" class="pill" aria-pressed={rangeDays === item.days} onclick={() => (rangeDays = item.days)}>
            {item.label}
          </button>
        {/each}
      </div>
      <button type="button" class="btn small ghost" onclick={onsettings}>Edit goals</button>
    </div>
  </div>

  {#if !hasListening}
    <div class="empty">
      <h2>No listening logged yet</h2>
      <p>
        Time counts while a YouTube video plays in a language. Each language gets its own panel here, and you can set a daily goal for each one in Settings.
      </p>
    </div>
  {:else}
    {#if rangeDays === 7}
      <WeekChart {summary} {goalSeconds} />
    {:else}
      <RangeChart {summary} {goalSeconds} />
    {/if}

    <LangPanels langs={summary.langs} calendar={calendar.langs} goals={data.goals} days={rangeDays} />
  {/if}
</section>

<style>
  .history {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 8px clamp(16px, 3vw, 40px) 32px;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 24px;
  }

  .total {
    margin: 0;
    font-size: 120px;
  }

  .note {
    max-width: 18em;
    padding-bottom: 6px;
  }

  .note p {
    margin: 0;
    font-size: 19px;
    line-height: 1.35;
    color: var(--ink-2);
  }

  .note .dim {
    margin-top: 6px;
    font-size: 15px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    padding-bottom: 6px;
  }

  .pills {
    display: flex;
    gap: 6px;
  }

  .empty {
    max-width: 40rem;
    margin-top: 24px;
  }

  .empty h2 {
    margin: 0 0 10px;
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .empty p {
    margin: 0;
    font-size: 18px;
    line-height: 1.45;
    color: var(--ink-2);
  }

  @media (max-width: 720px) {
    .total {
      font-size: 88px;
    }
  }
</style>
