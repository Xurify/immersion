<script lang="ts">
  import LangName from "../../../ui/LangName.svelte";
  import { langColor } from "../../../lib/colors.svelte";
  import type { LangProgress } from "../../../lib/plan";

  interface Props {
    row: LangProgress;
    playing?: boolean;
    expanded?: boolean;
  }

  let { row, playing = false, expanded = false }: Props = $props();

  const colour = $derived(langColor(row.lang));
  const listened = $derived(Math.floor(row.listenedSeconds / 60));
  const bonus = $derived(row.goalMinutes > 0 ? Math.max(0, listened - row.goalMinutes) : 0);
</script>

<li class={["done-chip", expanded && "expanded", playing && "playing"]} style:--panel={colour}>
  <span class="badge" aria-hidden="true">
    {#if playing}
      <span class="pulse"></span>
    {:else}
      <svg viewBox="0 0 14 14" width="11" height="11">
        <path d="M2.5 7.3 5.5 10.3 11.5 4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </span>

  <div class="copy">
    <span class="name"><LangName lang={row.lang} /></span>
    {#if expanded}
      <span class="detail">
        {row.goalMinutes > 0 ? `${listened} of ${row.goalMinutes} min` : "Weekly goal met"}
      </span>
    {/if}
  </div>

  <div class="stats">
    {#if bonus > 0}
      <span class="bonus" title="{listened} of {row.goalMinutes} min today">+{bonus}m</span>
    {:else if row.goalMinutes > 0}
      <span class="ratio">{listened}/{row.goalMinutes}m</span>
    {:else}
      <span class="ratio">Met</span>
    {/if}
    {#if !expanded && bonus > 0 && row.goalMinutes > 0}
      <span class="sub-ratio">{listened}/{row.goalMinutes}m</span>
    {/if}
  </div>
</li>

<style>
  .done-chip {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    min-height: 44px;
    padding: 7px 11px 7px 9px;
    border-radius: 11px;
    background: light-dark(var(--raised), color-mix(in srgb, var(--panel) 9%, var(--raised)));
    box-shadow: var(--lift);
    color: var(--ink);
  }

  .done-chip.expanded {
    min-height: 54px;
    padding: 10px 12px;
    border-radius: 12px;
  }

  .done-chip.playing {
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--panel) 55%, var(--line));
  }

  .badge {
    flex: none;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--panel);
    color: #fff;
  }

  .pulse {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #fff;
    animation: gentle-pulse 1.5s ease-in-out infinite;
  }

  @keyframes gentle-pulse {
    0%,
    100% {
      transform: scale(0.85);
      opacity: 0.75;
    }
    50% {
      transform: scale(1.15);
      opacity: 1;
    }
  }

  .copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    display: block;
    overflow: hidden;
    font-size: 16.5px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .done-chip.expanded .name {
    font-size: 18px;
  }

  .detail {
    font-size: 11px;
    color: var(--dim);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stats {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    font-variant-numeric: tabular-nums;
  }

  .bonus {
    font-size: 12px;
    font-weight: 800;
    color: light-dark(
      color-mix(in srgb, var(--panel) 84%, var(--ink)),
      color-mix(in srgb, var(--panel) 44%, var(--ink))
    );
    line-height: 1.1;
  }

  .ratio {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink-2);
    line-height: 1.1;
  }

  .sub-ratio {
    font-size: 10px;
    font-weight: 600;
    color: var(--dim);
    line-height: 1.1;
  }
</style>
