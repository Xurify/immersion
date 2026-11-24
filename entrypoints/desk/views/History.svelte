<script lang="ts">
  import { data } from "../../../lib/data.svelte";
  import { duration, hoursClock } from "../../../lib/format";
  import { englishName } from "../../../lib/languages";
  import { onlyLangs, otherLangs, summarise } from "../../../lib/stats";
  import { langColor } from "../../../lib/colors.svelte";
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
  const trend = $derived(Math.round(diff / 60) === 0 ? 0 : Math.sign(diff));
  const comparison = $derived.by(() => {
    if (trend === 0) return `Same as the ${range.period} before`;
    return `${duration(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the ${range.period} before`;
  });
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

  async function addGoal(lang: string) {
    const next = { ...data.goals, [lang]: NEW_GOAL_MINUTES };
    data.goals = next;
    await save("goals", next);
  }
</script>

<section class="history" aria-label="History">
  <header class="hero">
    {#if hasListening}
      <div class="lead">
        <p class="eyebrow">{hasGoals ? "Goal languages" : "All listening"} · last {rangeDays} days</p>
        <p class="total big">{hoursClock(summary.totalSeconds)}<span class="unit">h</span></p>
        <div class="facts">
          <span class="chip" class:up={trend > 0} class:down={trend < 0}>
            {#if trend !== 0}<span aria-hidden="true">{trend > 0 ? "▲" : "▼"}</span>{/if}
            {comparison}
          </span>
          {#if hasGoals}
            <span class="chip">{summary.allGoalsDays ? `Every goal hit on ${plural(summary.allGoalsDays, "day")}` : "No day with every goal hit yet"}</span>
          {/if}
        </div>
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
  </header>

  {#if !hasListening}
    <div class="empty-state">
      <h2>No listening logged yet</h2>
      <p>
        Time counts while a YouTube video plays in a language. Each goal language gets its own panel here. Set a daily goal for each one in Settings.
      </p>
    </div>
  {:else}
    <section class="surface chart" aria-labelledby="chart-title">
      <header class="card-head">
        <h2 id="chart-title">Each day</h2>
        {#if summary.langs.length}
          <ul class="legend" aria-label="Colours">
            {#each summary.langs as item (item.lang)}
              <li><i class="dot" style:background={langColor(item.lang)} aria-hidden="true"></i><LangName lang={item.lang} /></li>
            {/each}
          </ul>
        {/if}
      </header>
      {#if rangeDays === 7}
        <WeekChart {summary} {goalSeconds} />
      {:else}
        <RangeChart {summary} {goalSeconds} />
      {/if}
    </section>

    <section class="block" aria-labelledby="langs-title">
      <h2 id="langs-title" class="section-title">By language</h2>
      <LangPanels langs={summary.langs} calendar={calendar.langs} goals={data.goals} days={rangeDays} />
    </section>

    {#if others.length}
      <section class="block" aria-labelledby="others-title">
        <h2 id="others-title" class="section-title">Also heard, not in your goals</h2>
        <ul class="others">
          {#each others as item (item.lang)}
            <li>
              <i class="dot" style:background={langColor(item.lang)} aria-hidden="true"></i>
              <LangName lang={item.lang} />
              <span class="time">{duration(item.seconds)}</span>
              <button type="button" class="add" aria-label="Add a goal for {englishName(item.lang)}" onclick={() => addGoal(item.lang)}>
                + Add goal
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</section>

<style>
  .history {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 40px;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 32px var(--gutter) 64px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px 32px;
  }

  .lead {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .total {
    margin: 4px 0 0;
    font-size: clamp(88px, 10vw, 136px);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .chip.up {
    background: color-mix(in srgb, #1d7a4c 22%, var(--soft));
    color: light-dark(#14583a, #8fe0b4);
  }

  .chip.down {
    background: color-mix(in srgb, #c93a1e 18%, var(--soft));
    color: light-dark(#8f2a15, #ffb4a3);
  }

  .chip span {
    font-size: 10px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .controls .btn {
    min-height: 2.5rem;
  }

  .controls .seg button {
    min-height: 2.125rem;
  }

  .chart {
    padding: 24px 28px 28px;
  }

  .card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 24px;
  }

  .card-head h2,
  .section-title {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .section-title {
    margin-bottom: 16px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }

  .others {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .others li {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 3rem;
    padding: 0 6px 0 16px;
    border-radius: var(--pill);
    background: var(--raised);
    box-shadow: var(--lift);
    font-size: 14px;
  }

  .others li :global(.native) {
    font-size: 18px;
  }

  .time {
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }

  .add {
    min-height: 2.25rem;
    margin-left: 4px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--pill);
    background: var(--soft);
    font-size: 13px;
    font-weight: 700;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .add:hover {
    background: var(--ink);
    color: var(--on-ink);
  }

  @media (max-width: 720px) {
    .history {
      gap: 32px;
      padding-top: 20px;
    }

    .chart {
      padding: 20px 16px;
    }
  }
</style>
