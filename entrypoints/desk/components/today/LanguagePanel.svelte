<script lang="ts">
  import { minutes } from "../../../../lib/format";
  import { englishName, langColor } from "../../../../lib/languages";
  import type { LangProgress } from "../../../../lib/plan";
  import type { OpenVideo } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";

  let {
    row,
    next,
    playMinutes,
    canPlay,
    onplay,
  }: {
    row: LangProgress;
    next: OpenVideo | null;
    playMinutes: number;
    canPlay: boolean;
    onplay: () => void;
  } = $props();

  const colour = $derived(langColor(row.lang));
  const name = $derived(englishName(row.lang));
  const listed = $derived(Math.round(row.listenedSeconds / 60));
  const share = $derived(row.goalMinutes > 0 ? Math.min(100, (row.listenedSeconds / (row.goalMinutes * 60)) * 100) : 0);
</script>

<section class="panel" class:behind={!row.done} class:done={row.done} style:--panel={colour} aria-label="{name} goal">
  <h2 class="name"><LangName lang={row.lang} /></h2>

  {#if row.done}
    <p class="done-word">Done</p>
    <p class="sub">{listed} of {row.goalMinutes} min</p>
  {:else}
    <div class="figures">
      <p class="big">{minutes(row.leftSeconds)}<span class="unit">min left</span></p>
      <span class="of">of {row.goalMinutes} min</span>
    </div>
    <div class="meter" role="progressbar" aria-label="{name} goal progress" aria-valuemin="0" aria-valuemax={row.goalMinutes} aria-valuenow={listed}>
      <i style:width="{share}%"></i>
    </div>
    <div class="next">
      <span>{next ? `Next: ${next.title}` : `No open ${name} video`}</span>
      <button class="btn light small" type="button" disabled={!canPlay} onclick={onplay}>Play {playMinutes} min</button>
    </div>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 22px 24px;
    border-radius: 18px;
  }

  .behind {
    flex: 1 1 280px;
    min-height: 230px;
    background: var(--panel);
    color: #fff;
  }

  .done {
    flex: 0.62 1 200px;
    min-height: 150px;
    background: color-mix(in srgb, var(--panel) 14%, var(--bg));
    color: color-mix(in srgb, var(--panel) 70%, var(--ink));
  }

  .name {
    margin: 0;
    font-size: 44px;
    line-height: 1;
    overflow-wrap: anywhere;
  }

  .done .name {
    font-size: 36px;
  }

  .figures {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
  }

  .big {
    margin: 0;
    font-size: clamp(56px, 7vw, 76px);
  }

  .big .unit {
    font-size: 0.29em;
    margin-left: 0.2em;
  }

  .of {
    font-size: 14px;
    white-space: nowrap;
    opacity: 0.9;
  }

  .meter {
    height: 5px;
    margin-top: 4px;
    border-radius: 3px;
    background: rgb(255 255 255 / 0.25);
    overflow: hidden;
  }

  .meter i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: #fff;
  }

  .next {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 14px;
  }

  .next span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.9;
  }

  .next .btn {
    flex: none;
  }

  .done-word {
    margin: 0;
    font-size: 58px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 0.9;
  }

  .sub {
    margin: auto 0 0;
    font-size: 14px;
    opacity: 0.9;
  }
</style>
