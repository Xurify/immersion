<script lang="ts">
  import { data } from "../../../lib/data.svelte";
  import { duration, hoursClock } from "../../../lib/format";
  import { englishName } from "../../../lib/languages";
  import { dailyPace, onlyLangs, otherLangs, summarise } from "../../../lib/stats";
  import { langColor } from "../../../lib/colors.svelte";
  import { save } from "../../../lib/storage";
  import LangName from "../../../ui/LangName.svelte";
  import LangPanels from "../components/history/LangPanels.svelte";
  import LogTime from "../components/history/LogTime.svelte";
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
  // Weekly goals count an even seventh each day here, so goal days and the goal line stay comparable.
  const pace = $derived(dailyPace(data.goals, data.goalPeriods));
  const summary = $derived(summarise(tracked, pace, rangeDays));
  const calendar = $derived(summarise(tracked, pace, 28));
  const others = $derived(hasGoals ? otherLangs(data.log, goalLangs, summary.keys) : []);
  const goalSeconds = $derived(Object.values(pace).reduce((sum, minutes) => sum + minutes * 60, 0));
  /** Seconds per language in the range that played in a hidden tab. */
  const background = $derived.by(() => {
    const out: Record<string, number> = {};
    for (const key of summary.keys) for (const [lang, seconds] of Object.entries(data.logBackground[key] ?? {})) out[lang] = (out[lang] ?? 0) + seconds;
    return out;
  });
  /** Seconds per language in the range from YouTube alone, the base for the watching share. */
  const youtube = $derived.by(() => {
    const out: Record<string, number> = {};
    for (const key of summary.keys) for (const [lang, seconds] of Object.entries(data.youtubeLog[key] ?? {})) out[lang] = (out[lang] ?? 0) + seconds;
    return out;
  });
  const youtubeTotal = $derived(summary.langs.reduce((sum, item) => sum + (youtube[item.lang] ?? 0), 0));
  const backgroundTotal = $derived(summary.langs.reduce((sum, item) => sum + (background[item.lang] ?? 0), 0));
  const watchingShare = $derived(youtubeTotal > 0 ? Math.round(((youtubeTotal - backgroundTotal) / youtubeTotal) * 100) : 100);
  const tracksBackground = $derived(Object.keys(data.logBackground).length > 0);
  const recentManual = $derived([...data.manual].sort((a, b) => b.date.localeCompare(a.date) || b.addedAt - a.addedAt).slice(0, 20));
  let logging = $state(false);
  const hasListening = $derived(Object.values(data.log).some((day) => Object.values(day).some((seconds) => seconds > 0)));

  const diff = $derived(summary.totalSeconds - summary.previousSeconds);
  const trend = $derived(Math.round(diff / 60) === 0 ? 0 : Math.sign(diff));
  const comparison = $derived.by(() => {
    if (trend === 0) return `Same as the ${range.period} before`;
    return `${duration(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the ${range.period} before`;
  });
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

  async function removeManual(id: string) {
    const next = data.manual.filter((entry) => entry.id !== id);
    data.manual = next;
    await save("manual", next);
  }

  function dayName(key: string): string {
    const [year, month, date] = key.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, date).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  }

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
          {#if tracksBackground && youtubeTotal >= 60}
            <span class="chip" title="Background means the tab was hidden while the video played">
              {watchingShare}% watching · {100 - watchingShare}% background
            </span>
          {/if}
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
      <button type="button" class="btn small soft" aria-expanded={logging} onclick={() => (logging = !logging)}>
        <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
          <path d="M7 2.5v9M2.5 7h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        Log time
      </button>
      <button type="button" class="btn small soft" onclick={onsettings}>
        <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path d="M7 4.5V7l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Edit goals
      </button>
    </div>
  </header>

  {#if logging}
    <LogTime onclose={() => (logging = false)} />
  {/if}

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
      <LangPanels
        langs={summary.langs}
        calendar={calendar.langs}
        goals={pace}
        days={rangeDays}
        {background}
        {youtube}
        baseline={data.baseline}
        showWatching={tracksBackground}
      />
    </section>

    {#if recentManual.length}
      <section class="block" aria-labelledby="manual-title">
        <h2 id="manual-title" class="section-title">Logged by hand</h2>
        <ul class="manual">
          {#each recentManual as entry (entry.id)}
            <li>
              <i class="dot" style:background={langColor(entry.lang)} aria-hidden="true"></i>
              <LangName lang={entry.lang} />
              <span class="time">{duration(entry.seconds)}</span>
              <span class="where">{entry.source} · {dayName(entry.date)}</span>
              <button type="button" class="remove" aria-label="Delete {duration(entry.seconds)} of {englishName(entry.lang)} on {dayName(entry.date)}" onclick={() => removeManual(entry.id)}>
                Delete
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

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
    gap: 28px;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px var(--gutter) 64px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px 32px;
    padding: 4px 0 0;
  }

  .lead {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .total {
    margin: 2px 0 0;
    font-size: clamp(64px, 7.5vw, 96px);
  }

  .total .unit {
    color: var(--ink-2);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
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

  .manual {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    border-radius: var(--r-lg);
    background: var(--raised);
    box-shadow: var(--lift);
  }

  .manual li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 3.25rem;
    padding: 0 8px 0 18px;
    font-size: 14px;
  }

  .manual li + li {
    border-top: 1px solid var(--line);
  }

  .manual li :global(.native) {
    font-size: 18px;
  }

  .where {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--dim);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    min-height: 2.25rem;
    padding: 0 12px;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    font-size: 13px;
    font-weight: 600;
  }

  .remove:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
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
