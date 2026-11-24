<script lang="ts">
  import { hoursClock } from "../../../../lib/format";
  import { langColor } from "../../../../lib/languages";
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
    /** Per language over the last 28 days, for the mini calendar. */
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
    if (!(item.lang in goals)) return "no goal";
    return `goal hit ${item.daysHit} of ${days} days`;
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
      <div class="top">
        <div class="who">
          <h2 class="name"><LangName lang={item.lang} /></h2>
          <p class="sub">
            {item.streak > 0 ? `${item.streak}-day streak · ` : ""}{total(item.allTime)} total
          </p>
        </div>
        <div class="figure">
          <p class="big">{hoursClock(item.seconds)}</p>
          <p class="goal">{goalText(item)}</p>
        </div>
      </div>
      <div class="calendar" role="img" aria-label={calendarLabel(statuses)}>
        {#each statuses as status, i (i)}
          <i class="cell {status}" aria-hidden="true"></i>
        {/each}
      </div>
    </article>
  {/each}
</div>

<style>
  .panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
    gap: 12px;
  }

  .panel {
    --mark: #fff;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
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

  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .name {
    margin: 0;
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
  }

  .sub,
  .goal {
    margin: 8px 0 0;
    font-size: 13px;
    opacity: 0.9;
  }

  .figure {
    text-align: right;
    flex: none;
  }

  .big {
    margin: 0;
    font-size: 46px;
  }

  .calendar {
    display: grid;
    grid-template-columns: repeat(7, 10px);
    gap: 3px;
    width: max-content;
  }

  .cell {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--mark) 22%, transparent);
  }

  .cell.partly {
    background: color-mix(in srgb, var(--mark) 55%, transparent);
  }

  .cell.hit {
    background: var(--mark);
  }
</style>
