<script lang="ts">
  import LangName from "../../../ui/LangName.svelte";
  import { minutes } from "../../../lib/format";
  import { isCjk, nativeName } from "../../../lib/languages";
  import { langColor } from "../../../lib/colors.svelte";
  import type { LangProgress } from "../../../lib/plan";
  import type { OpenVideo } from "../../../lib/types";

  let {
    row,
    next,
    onplay,
  }: { row: LangProgress; next: OpenVideo[]; onplay: (videos: OpenVideo[]) => void } = $props();

  const colour = $derived(langColor(row.lang));
  const first = $derived(next[0]);
  const listened = $derived(Math.min(row.goalMinutes, Math.floor(row.listenedSeconds / 60)));
</script>

<li class="band" class:done={row.done} style:--panel={colour}>
  <div class="label">
    <div class="name" class:cjk={isCjk(row.lang)}><LangName lang={row.lang} /></div>
    {#if row.done}
      <small>{listened} of {row.goalMinutes} min</small>
    {:else if first}
      <small>next: {first.title}</small>
    {:else}
      <small>No videos in this language on the board</small>
    {/if}
  </div>
  <div class="figures">
    {#if row.done}
      <span class="done-mark">Done</span>
    {:else}
      <span>{minutes(row.leftSeconds)}<span class="sr-only"> min left</span></span>
      {#if next.length > 0}
        <button type="button" class="btn light small" onclick={() => onplay(next)}>
          Play<span class="sr-only"> {nativeName(row.lang)}</span>
        </button>
      {/if}
    {/if}
  </div>
</li>

<style>
  .band :focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 84px;
    padding: 12px 16px;
    border-radius: var(--r-md);
    background: var(--panel);
    color: #fff;
  }

  .band.done {
    background: color-mix(in srgb, var(--panel) 14%, var(--bg));
    color: color-mix(in srgb, var(--panel) 70%, var(--ink));
  }

  .label {
    flex: 1 1 0;
    min-width: 0;
  }

  .name {
    font-size: 28px;
  }

  .name.cjk {
    font-size: 24px;
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
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .figures button {
    letter-spacing: 0;
  }

  .done-mark {
    font-size: 20px;
  }
</style>
