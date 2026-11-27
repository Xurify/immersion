<script lang="ts">
  import type { Snippet } from "svelte";
  import CardView from "./CardView.svelte";
  import type { CardActions, LaneKey, Row } from "./rows";

  interface Props {
    lane: LaneKey;
    title: string;
    meta: string;
    metaNote?: string;
    rows: Row[];
    hint: string;
    slot: number | null;
    dragId: string | null;
    stop: string | null;
    menuId: string | null;
    targeted: boolean;
    actions: CardActions;
    onover: (event: DragEvent, lane: LaneKey) => void;
    ondrop: (event: DragEvent, lane: LaneKey) => void;
    top?: Snippet;
    footer?: Snippet;
  }

  let { lane, title, meta, metaNote = "", rows, hint, slot, dragId, stop, menuId, targeted, actions, onover, ondrop, top, footer }: Props = $props();

  type Entry = { kind: "slot" } | { kind: "row"; row: Row };

  const ICON: Record<LaneKey, string> = {
    inbox: "M3 13h4l1.5 2.5h7L17 13h4M5 5h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z",
    next: "M4 6h16M4 12h10M4 18h7M17 15l4 3-4 3z",
    playing: "M7 4.5v15l12-7.5z",
    done: "M4 12.5l5 5L20 6.5",
    later: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  };

  const entries = $derived.by((): { key: string; entry: Entry }[] => {
    const output: { key: string; entry: Entry }[] = [];
    let seen = 0;
    for (const row of rows) {
      if (row.videoId === dragId) {
        output.push({ key: row.videoId, entry: { kind: "row", row } });
        continue;
      }
      if (slot === seen) output.push({ key: "slot", entry: { kind: "slot" } });
      output.push({ key: row.videoId, entry: { kind: "row", row } });
      seen++;
    }
    if (slot !== null && slot >= seen) output.push({ key: "slot", entry: { kind: "slot" } });
    return output;
  });
</script>

<section
  class={["lane", targeted && "targeted"]}
  aria-labelledby="lane-{lane}"
  ondragover={(event) => onover(event, lane)}
  ondrop={(event) => ondrop(event, lane)}
>
  <header class="head">
    <h3 id="lane-{lane}">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path
          d={ICON[lane]}
          fill={lane === "playing" ? "currentColor" : "none"}
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      {title}
    </h3>
    {#if meta}<span class="meta" title={metaNote || undefined}>{meta}</span>{/if}
  </header>

  {#if top}
    <div class="top">{@render top()}</div>
  {/if}

  <ul class="list">
    {#each entries as item (item.key)}
      {#if item.entry.kind === "slot"}
        <li class="slot" aria-hidden="true"></li>
      {:else}
        <CardView
          row={item.entry.row}
          menuOpen={menuId === item.entry.row.videoId}
          stop={stop === item.entry.row.videoId}
          dragging={dragId === item.entry.row.videoId}
          {actions}
        />
      {/if}
    {:else}
      <li class="hint">{hint}</li>
    {/each}
  </ul>

  {#if footer}
    <div class="foot">{@render footer()}</div>
  {/if}
</section>

<style>
  .lane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
    padding: 12px;
    border-radius: 14px;
    background: var(--raised-2);
    box-shadow: inset 0 0 0 1px var(--line);
    transition: box-shadow 0.15s ease;
  }

  .lane.targeted {
    box-shadow: inset 0 0 0 2px var(--focus);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 24px;
    padding-inline: 2px;
  }

  h3 {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    font-size: 13.5px;
    font-weight: 750;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  h3 svg {
    color: var(--dim);
  }

  .meta {
    min-width: 0;
    overflow: hidden;
    color: var(--dim);
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .top,
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding-inline: 2px;
    font-size: 12.5px;
  }

  .foot {
    flex: none;
    padding-top: 6px;
    border-top: 1px solid color-mix(in srgb, var(--line) 75%, transparent);
  }

  .list {
    container: lane / inline-size;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    margin: 0;
    padding: 2px;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
  }

  .hint {
    margin: 6px 4px;
    font-size: 13px;
    line-height: 1.45;
    text-wrap: balance;
    color: var(--dim);
  }

  .slot {
    flex: none;
    height: 62px;
    border: 2px dashed color-mix(in srgb, var(--focus) 55%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--focus) 6%, transparent);
  }

  @media (max-width: 1100px) {
    .lane {
      flex: 0 0 300px;
      min-width: 280px;
      scroll-snap-align: start;
    }
  }
</style>
