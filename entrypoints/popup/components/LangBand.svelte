<script lang="ts">
  import LangName from "../../../ui/LangName.svelte";
  import { minutes } from "../../../lib/format";
  import { nativeName } from "../../../lib/languages";
  import { langColor } from "../../../lib/colors.svelte";
  import type { LangProgress } from "../../../lib/plan";
  import type { OpenVideo } from "../../../lib/types";

  interface Props {
    row: LangProgress;
    next: OpenVideo[];
    reading?: boolean;
    playing?: boolean;
    wide?: boolean;
    onplay: (videos: OpenVideo[]) => void;
    onshow: () => void;
  }

  let {
    row,
    next,
    reading = false,
    playing = false,
    wide = false,
    onplay,
    onshow,
  }: Props = $props();

  const colour = $derived(langColor(row.lang));
  const first = $derived(next[0]);
  const listened = $derived(Math.floor(row.listenedSeconds / 60));
  const percent = $derived(
    row.goalMinutes > 0 ? Math.min(100, Math.round((row.listenedSeconds / (row.goalMinutes * 60)) * 100)) : 0,
  );
  const subtitle = $derived.by((): string => {
    if (first) return first.title;
    if (reading) return "Checking open tabs…";
    return "Nothing queued yet";
  });
</script>

<li class={["tile", wide && "wide", playing && "playing"]} style:--panel={colour}>
  <div class="tile-top">
    <div class="heading">
      <span class="name"><LangName lang={row.lang} /></span>
      {#if wide}
        <p class="next-line" class:muted={!first}>
          {#if first}<span class="sr-only">Next: </span>{/if}{subtitle}
        </p>
      {/if}
    </div>

    {#if wide}
      <div class="wide-right">
        <div class="figure-stack">
          <span class="left">{minutes(row.leftSeconds)}<span class="unit">min</span></span>
          {#if row.goalMinutes > 0}
            <span class="ratio">{listened}/{row.goalMinutes}m</span>
          {/if}
        </div>
        {#if playing}
          <button type="button" class="live-btn" onclick={onshow} aria-label="Show the {nativeName(row.lang)} tab">
            <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
            Show
          </button>
        {:else if next.length > 0}
          <button type="button" class="play" onclick={() => onplay(next)} aria-label="Play {nativeName(row.lang)}">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
          </button>
        {/if}
      </div>
    {:else if playing}
      <button type="button" class="live-btn" onclick={onshow} aria-label="Show the {nativeName(row.lang)} tab">
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
        Live
      </button>
    {:else if next.length > 0}
      <button type="button" class="play" onclick={() => onplay(next)} aria-label="Play {nativeName(row.lang)}">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
      </button>
    {/if}
  </div>

  {#if !wide}
    <div class="metric-row">
      <span class="left">{minutes(row.leftSeconds)}<span class="unit">min</span></span>
      {#if row.goalMinutes > 0}
        <span class="ratio">{listened}/{row.goalMinutes}m</span>
      {/if}
    </div>
  {/if}

  <div class="progress-rail" aria-hidden="true">
    <i style:width="{percent}%"></i>
  </div>

  {#if !wide}
    <p class="next-line" class:muted={!first}>
      {#if first}<span class="sr-only">Next: </span>{/if}{subtitle}
    </p>
  {/if}
</li>

<style>
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 12px 12px 11px 13px;
    border-radius: 13px;
    background: var(--panel);
    color: #fff;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14), 0 1px 2px rgb(0 0 0 / 0.08);
  }

  .tile.wide {
    grid-column: 1 / -1;
    gap: 10px;
    padding: 13px 13px 12px 15px;
  }

  .tile :focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .tile-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .tile.wide .tile-top {
    align-items: center;
    gap: 12px;
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .name {
    display: block;
    overflow: hidden;
    font-size: 19.5px;
    line-height: 1.12;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile.wide .name {
    font-size: 22px;
  }

  .wide-right {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .figure-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .metric-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-top: 2px;
  }

  .left {
    font-size: 29px;
    font-weight: 800;
    letter-spacing: -0.045em;
    line-height: 0.92;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    margin-inline-start: 2px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    opacity: 0.9;
  }

  .ratio {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    opacity: 0.78;
    white-space: nowrap;
  }

  .progress-rail {
    height: 4px;
    border-radius: var(--pill);
    background: rgb(255 255 255 / 0.24);
    overflow: hidden;
  }

  .progress-rail i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #fff;
    transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
  }

  .next-line {
    margin: 0;
    overflow: hidden;
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.25;
    opacity: 0.9;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .next-line.muted {
    opacity: 0.72;
  }

  .play {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    padding-inline-start: 2px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: var(--panel);
    box-shadow: 0 3px 10px -2px rgb(0 0 0 / 0.25);
    transition: transform 0.14s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.14s ease;
  }

  .tile.wide .play {
    width: 38px;
    height: 38px;
  }

  .play:hover {
    transform: scale(1.07);
    box-shadow: 0 6px 14px -3px rgb(0 0 0 / 0.32);
  }

  .play:active {
    transform: scale(0.96);
  }

  .live-btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--pill);
    background: #fff;
    color: var(--panel);
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
    transition: transform 0.14s cubic-bezier(0.2, 0, 0, 1);
  }

  .live-btn:active {
    transform: scale(0.96);
  }

  .eq {
    display: inline-flex;
    align-items: flex-end;
    gap: 1.5px;
    height: 10px;
  }

  .eq i {
    display: block;
    width: 2px;
    border-radius: 1px;
    background: currentColor;
    animation: eq-bounce 0.9s ease-in-out infinite alternate;
  }

  .eq i:nth-child(1) {
    height: 5px;
    animation-delay: 0s;
  }

  .eq i:nth-child(2) {
    height: 10px;
    animation-delay: 0.22s;
  }

  .eq i:nth-child(3) {
    height: 7px;
    animation-delay: 0.44s;
  }

  @keyframes eq-bounce {
    from {
      transform: scaleY(0.45);
    }
    to {
      transform: scaleY(1);
    }
  }
</style>
