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
    return `${item.daysHit} of ${days}`;
  }

  /** Share of the range's goal time, capped at 100. Null without a goal. */
  function goalShare(item: LangSummary): number | null {
    const minutes = goals[item.lang];
    if (!minutes) return null;
    return Math.min(100, Math.round((item.seconds / (minutes * 60 * days)) * 100));
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
    {@const share = goalShare(item)}
    <article class="panel" class:quiet={item.seconds === 0} style:--c={langColor(item.lang)}>
      <div class="head">
        <h3 class="name"><LangName lang={item.lang} /></h3>
        <p class="big time">{hoursClock(item.seconds)}</p>
      </div>

      {#if share !== null}
        <div class="progress">
          <div class="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-label="Share of the goal time">
            <i style:width="{share}%"></i>
          </div>
          <span class="pct">{share}% of goal</span>
        </div>
      {/if}

      <dl class="facts">
        <div><dt>Goal days</dt><dd>{goalText(item)}</dd></div>
        <div><dt>Streak</dt><dd>{item.streak ? `${item.streak} ${item.streak === 1 ? "day" : "days"}` : "–"}</dd></div>
        <div><dt>All time</dt><dd>{total(item.allTime)}</dd></div>
      </dl>

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
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
    padding: 24px;
    overflow: hidden;
    border-radius: var(--r-xl);
    background:
      radial-gradient(120% 90% at 100% 0%, rgb(255 255 255 / 0.16), transparent 55%),
      var(--c);
    color: #fff;
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.12) inset, 0 12px 32px -16px color-mix(in srgb, var(--c) 70%, #000);
  }

  /* No time in range: a pale tint of the language colour, marks in the colour. */
  .panel.quiet {
    --mark: var(--c);
    background: color-mix(in srgb, var(--c) 12%, var(--raised));
    color: var(--ink);
    box-shadow: var(--lift);
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
    font-size: clamp(22px, 1.8vw, 26px);
    font-weight: 600;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time {
    flex: none;
    margin: 0;
    font-size: clamp(38px, 3vw, 46px);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .meter {
    flex: 1;
    height: 8px;
    border-radius: var(--pill);
    background: color-mix(in srgb, var(--mark) 22%, transparent);
    overflow: hidden;
  }

  .meter i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--mark);
  }

  .pct {
    flex: none;
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
    padding: 16px 0 0;
    border-top: 1px solid color-mix(in srgb, var(--mark) 22%, transparent);
  }

  .facts dt {
    font-size: 12px;
    opacity: 0.9;
  }

  .facts dd {
    margin: 4px 0 0;
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(28, minmax(0, 1fr));
    gap: 3px;
  }

  .cell {
    height: 12px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--mark) 20%, transparent);
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
    margin-top: 8px;
    font-size: 11.5px;
    opacity: 0.9;
  }
</style>
