<script lang="ts">
  import { dateKey, duration } from "../../../../lib/format";
  import { englishName } from "../../../../lib/languages";
  import { langColor } from "../../../../lib/colors.svelte";
  import type { RangeSummary } from "../../../../lib/stats";

  let { summary, goalSeconds }: { summary: RangeSummary; goalSeconds: number } = $props();

  // Must match the grid columns below: label 60px, total 72px, 12px gaps.
  const TRACK_LEFT = 72;
  const TRACK_INSET = 156;

  const sumOf = (day: Record<string, number>) => Object.values(day).reduce((total, seconds) => total + seconds, 0);
  const today = dateKey();

  function weekday(key: string): string {
    const [year, month, day] = key.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day).toLocaleDateString([], { weekday: "short" });
  }

  const scale = $derived(Math.max(goalSeconds, ...summary.perDay.map(sumOf), 1));

  const rows = $derived(
    summary.keys.map((key, i) => {
      const day: Record<string, number> = summary.perDay[i] ?? {};
      const label = key === today ? "Today" : weekday(key);
      const total = sumOf(day);
      const parts = summary.langs
        .filter((item) => (day[item.lang] ?? 0) > 0)
        .map((item) => ({ lang: item.lang, seconds: day[item.lang] ?? 0 }));
      const breakdown = parts.map((part) => `${englishName(part.lang)} ${duration(part.seconds)}`).join(", ");
      return {
        key,
        label,
        isToday: key === today,
        total,
        parts,
        description: `${label}, ${duration(total)}${breakdown ? `: ${breakdown}` : ""}`,
      };
    }),
  );

  const goalLeft = $derived(`calc(${TRACK_LEFT}px + (100% - ${TRACK_INSET}px) * ${goalSeconds / scale})`);
</script>

<div class="week-chart">
  <div class="week">
    {#each rows as row (row.key)}
      <div class="row" class:today={row.isToday}>
        <span class="day" aria-hidden="true">{row.label}</span>
        <div class="bar" aria-hidden="true">
          {#each row.parts as part (part.lang)}
            <i style:width={`${(part.seconds / scale) * 100}%`} style:background={langColor(part.lang)}></i>
          {/each}
        </div>
        <span class="total" aria-hidden="true">{duration(row.total)}</span>
        <span class="sr-only">{row.description}</span>
      </div>
    {/each}
    {#if goalSeconds > 0}
      <div class="goal" style:left={goalLeft} aria-hidden="true"></div>
    {/if}
  </div>
  {#if goalSeconds > 0}
    <p class="caption">Dashed line: all goals together, {Math.round(goalSeconds / 60)} min</p>
  {/if}
</div>

<style>
  .week {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .row {
    display: grid;
    grid-template-columns: 60px minmax(0, 1fr) 72px;
    gap: 12px;
    align-items: center;
    font-size: 13.5px;
    font-weight: 500;
  }

  .row.today .day {
    font-weight: 800;
  }

  .bar {
    display: flex;
    gap: 3px;
    height: 36px;
  }

  .bar i {
    flex: none;
    height: 100%;
    border-radius: 4px;
  }

  .total {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .goal {
    position: absolute;
    top: -4px;
    bottom: -4px;
    border-left: 2px dashed var(--dim);
    pointer-events: none;
  }

  .caption {
    margin: 10px 0 0 72px;
    font-size: 12.5px;
    color: var(--dim);
  }
</style>
