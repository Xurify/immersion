<script lang="ts">
  import { dateKey, duration } from "../../../../lib/format";
  import { englishName } from "../../../../lib/languages";
  import { langColor } from "../../../../lib/colors.svelte";
  import type { RangeSummary } from "../../../../lib/stats";

  let { summary, goalSeconds }: { summary: RangeSummary; goalSeconds: number } = $props();

  const sumOf = (day: Record<string, number>) => Object.values(day).reduce((total, seconds) => total + seconds, 0);
  const today = dateKey();

  function weekday(key: string): string {
    const [year, month, day] = key.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day).toLocaleDateString([], { weekday: "short" });
  }

  // Headroom past the goal and the longest day, so the goal mark never sits on the track's end.
  const scale = $derived(Math.max(goalSeconds, ...summary.perDay.map(sumOf), 1) * 1.08);
  const goalPercent = $derived((goalSeconds / scale) * 100);

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
</script>

<div class="week">
  {#each rows as row (row.key)}
    <div class="row" class:today={row.isToday}>
      <span class="day" aria-hidden="true">{row.label}</span>
      <div class="track" aria-hidden="true">
        <div class="bar">
          {#each row.parts as part (part.lang)}
            <i style:width={`${(part.seconds / scale) * 100}%`} style:background={langColor(part.lang)}></i>
          {/each}
        </div>
        {#if goalSeconds > 0}
          <i class="goal" style:left={`${goalPercent}%`}></i>
        {/if}
      </div>
      <span class="total" class:zero={row.total < 60} aria-hidden="true">{row.total < 60 ? "–" : duration(row.total)}</span>
      <span class="sr-only">{row.description}</span>
    </div>
  {/each}
  {#if goalSeconds > 0}
    <p class="caption">
      <i class="key" aria-hidden="true"></i>
      Every goal together: {duration(goalSeconds)} a day
    </p>
  {/if}
</div>

<style>
  .week {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) 64px;
    column-gap: 16px;
    row-gap: 8px;
    align-items: center;
  }

  .row {
    display: contents;
    font-size: 14px;
    font-weight: 500;
  }

  .day {
    color: var(--dim);
  }

  .today .day,
  .today .total {
    color: var(--ink);
    font-weight: 800;
  }

  .track {
    position: relative;
    height: 32px;
    border-radius: 8px;
    background: var(--soft);
  }

  .bar {
    display: flex;
    gap: 2px;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
  }

  .bar i {
    flex: none;
    height: 100%;
  }

  /* Drawn per row; the row gaps break it into the dashes of one goal line. */
  .goal {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--ink-2);
    opacity: 0.55;
  }

  .total {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .total.zero {
    color: var(--dim);
    font-weight: 500;
  }

  .caption {
    grid-column: 2 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--dim);
  }

  .key {
    width: 2px;
    height: 14px;
    border-radius: 1px;
    background: var(--ink-2);
    opacity: 0.55;
  }

  @media (max-width: 520px) {
    .week {
      grid-template-columns: 44px minmax(0, 1fr) 52px;
      column-gap: 10px;
    }

    .row {
      font-size: 13px;
    }
  }
</style>
