<script lang="ts">
  import { hoursClock } from "../../../../lib/format";
  import { langColor } from "../../../../lib/colors.svelte";
  import type { DayStatus, LangSummary } from "../../../../lib/stats";
  import type { Goals } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";

  let {
    langs,
    calendar,
    goals,
    days,
  }: {
    /** Per language for the chosen range. */
    langs: LangSummary[];
    /** Per language over the last 28 days, for the strip. */
    calendar: LangSummary[];
    goals: Goals;
    days: number;
  } = $props();

  const calendarByLang = $derived(new Map<string, DayStatus[]>(calendar.map((item) => [item.lang, item.days])));

  function total(seconds: number): string {
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${Math.round((seconds / 3600) * 10) / 10} h`;
  }

  function goalText(item: LangSummary): string {
    if (!(item.lang in goals)) return "No goal";
    return `Goal hit ${item.daysHit} of ${days} days`;
  }

  function calendarLabel(statuses: DayStatus[]): string {
    const hit = statuses.filter((status) => status === "hit").length;
    const partly = statuses.filter((status) => status === "partly").length;
    return `Last ${statuses.length} days: ${hit} days hit, ${partly} partly`;
  }
</script>

<div class="panels">
  {#each langs as item (item.lang)}
    {@const statuses = calendarByLang.get(item.lang) ?? []}
    <article class="panel" class:quiet={item.seconds === 0} style:--c={langColor(item.lang)}>
      <div class="head">
        <h2 class="name"><LangName lang={item.lang} /></h2>
        <p class="big time">{hoursClock(item.seconds)}</p>
      </div>
      <div class="facts">
        <span>{total(item.allTime)} total{item.streak > 0 ? ` · ${item.streak}-day streak` : ""}</span>
        <span>{goalText(item)}</span>
      </div>
      <div class="strip">
        <div class="cells" role="img" aria-label={calendarLabel(statuses)}>
          {#each statuses as status, i (i)}
            <i class="cell {status}" aria-hidden="true"></i>
          {/each}
        </div>
        <div class="ends" aria-hidden="true"><span>4 weeks ago</span><span>Today</span></div>
      </div>
    </article>
  {/each}
</div>

<style>
  .panels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 16px;
  }

  .panel {
    --mark: #fff;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 24px;
    border-radius: var(--r-lg);
    background: var(--c);
    color: #fff;
  }

  /* No time in range: a pale tint of the language colour, marks in the colour. */
  .panel.quiet {
    --mark: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--raised));
    color: var(--ink);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .name {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 30px;
    font-weight: 600;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time {
    flex: none;
    margin: 0;
    font-size: 48px;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    margin-top: 12px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }

  .strip {
    margin-top: 24px;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(28, minmax(0, 1fr));
    gap: 3px;
  }

  .cell {
    height: 10px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--mark) 22%, transparent);
  }

  .cell.partly {
    background: color-mix(in srgb, var(--mark) 55%, transparent);
  }

  .cell.hit {
    background: var(--mark);
  }

  .ends {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11.5px;
    opacity: 0.7;
  }
</style>
