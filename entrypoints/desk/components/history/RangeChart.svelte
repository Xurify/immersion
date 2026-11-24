<script lang="ts">
  import { duration } from "../../../../lib/format";
  import { langColor } from "../../../../lib/languages";
  import type { RangeSummary } from "../../../../lib/stats";

  let { summary, goalSeconds }: { summary: RangeSummary; goalSeconds: number } = $props();

  const sumOf = (day: Record<string, number>) => Object.values(day).reduce((total, seconds) => total + seconds, 0);

  function dateLabel(key: string): string {
    const [year, month, day] = key.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Quarter gets a label each month; Month gets one each week.
  const labelEvery = $derived(summary.keys.length > 45 ? 30 : 7);
  const scale = $derived(Math.max(goalSeconds, ...summary.perDay.map(sumOf), 1));

  const columns = $derived(
    summary.keys.map((key, i) => {
      const day: Record<string, number> = summary.perDay[i] ?? {};
      const total = sumOf(day);
      const parts = summary.langs
        .map((item) => ({ lang: item.lang, percent: ((day[item.lang] ?? 0) / scale) * 100 }))
        .filter((part) => part.percent > 0);
      return {
        key,
        parts,
        title: `${dateLabel(key)}: ${duration(total)}`,
        date: i % labelEvery === 0 ? dateLabel(key) : null,
      };
    }),
  );
</script>

<div class="range-chart">
  <div class="cols" role="img" aria-label={`Listening each day for the last ${summary.keys.length} days`}>
    {#each columns as column (column.key)}
      <div class="col" title={column.title}>
        <div class="stack">
          {#each column.parts as part (part.lang)}
            <i style:height={`${part.percent}%`} style:background={langColor(part.lang)}></i>
          {/each}
        </div>
      </div>
    {/each}
    {#if goalSeconds > 0}
      <div class="goal" style:bottom={`${(goalSeconds / scale) * 100}%`} aria-hidden="true"></div>
    {/if}
  </div>
  <div class="dates" aria-hidden="true">
    {#each columns as column (column.key)}
      <span class="date">
        {#if column.date}<span class="label">{column.date}</span>{/if}
      </span>
    {/each}
  </div>
  {#if goalSeconds > 0}
    <p class="caption">Dashed line: all goals together, {Math.round(goalSeconds / 60)} min a day</p>
  {/if}
</div>

<style>
  .cols,
  .dates {
    display: flex;
    gap: clamp(1px, 0.35vw, 3px);
  }

  .cols {
    position: relative;
    height: 200px;
    border-bottom: 1px solid var(--line);
  }

  .col {
    flex: 1 1 0;
    min-width: 2px;
    height: 100%;
  }

  .stack {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
  }

  .stack i {
    flex: none;
    display: block;
    width: 100%;
  }

  .goal {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1.5px dashed var(--dim);
    pointer-events: none;
  }

  .dates {
    margin-top: 6px;
  }

  .date {
    position: relative;
    flex: 1 1 0;
    min-width: 2px;
    height: 1.4em;
  }

  .label {
    position: absolute;
    top: 0;
    left: 0;
    white-space: nowrap;
    font-size: 12px;
    color: var(--dim);
  }

  .caption {
    margin: 10px 0 0;
    font-size: 12.5px;
    color: var(--dim);
  }
</style>
