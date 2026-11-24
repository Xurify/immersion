<script lang="ts">
  import LangName from "../../../ui/LangName.svelte";
  import { minutes } from "../../../lib/format";
  import { nativeName } from "../../../lib/languages";
  import { langColor } from "../../../lib/colors.svelte";
  import type { LangProgress } from "../../../lib/plan";
  import type { OpenVideo } from "../../../lib/types";

  let {
    row,
    next,
    reading = false,
    onplay,
  }: { row: LangProgress; next: OpenVideo[]; reading?: boolean; onplay: (videos: OpenVideo[]) => void } = $props();

  const colour = $derived(langColor(row.lang));
  const first = $derived(next[0]);
  const listened = $derived(Math.min(row.goalMinutes, Math.floor(row.listenedSeconds / 60)));
</script>

<li class="band" class:done={row.done} style:--panel={colour}>
  <div class="label">
    <span class="name"><LangName lang={row.lang} /></span>
    {#if row.done}
      <small>{row.goalMinutes > 0 ? `${listened} of ${row.goalMinutes} min today` : "This week's goal is met"}</small>
    {:else if first}
      <small><span class="sr-only">Next: </span>{first.title}</small>
    {:else if reading}
      <small>Checking open tabs…</small>
    {:else}
      <small>Nothing queued in this language</small>
    {/if}
  </div>
  <div class="figures">
    {#if row.done}
      <span class="done-mark">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Done
      </span>
    {:else}
      <span class="left">{minutes(row.leftSeconds)}<span class="unit">min</span></span>
      {#if next.length > 0}
        <button type="button" class="play" onclick={() => onplay(next)} aria-label="Play {nativeName(row.lang)}">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
        </button>
      {:else}
        <span class="play-space" aria-hidden="true"></span>
      {/if}
    {/if}
  </div>
</li>

<style>
  .band {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 58px;
    padding: 8px 9px 8px 14px;
    border-radius: 16px;
    background: var(--panel);
    color: #fff;
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.12) inset;
  }

  .band :focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .band.done {
    background: color-mix(in srgb, var(--panel) 14%, var(--raised));
    color: var(--ink);
    box-shadow: var(--lift);
  }

  .label {
    flex: 1;
    min-width: 0;
  }

  .name {
    display: block;
    font-size: 22px;
    line-height: 1.1;
  }

  small {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    font-size: 12px;
    opacity: 0.92;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .figures {
    display: flex;
    flex: none;
    align-items: center;
    gap: 10px;
  }

  .left {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    margin-left: 2px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .play-space {
    width: 40px;
  }

  .play {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0 0 0 2px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: var(--panel);
    transition: transform 0.12s ease;
  }

  .play:hover {
    transform: scale(1.06);
  }

  .play:active {
    transform: scale(0.96);
  }

  .done-mark {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--pill);
    background: color-mix(in srgb, var(--panel) 18%, transparent);
    color: var(--ink);
    font-size: 13px;
    font-weight: 700;
  }

  .done-mark svg {
    color: color-mix(in srgb, var(--panel) 55%, var(--ink));
  }
</style>
