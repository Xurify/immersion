<script lang="ts">
  import type { Snippet } from "svelte";
  import CardView from "./CardView.svelte";
  import type { CardActions, LaneKey, Row } from "./rows";

  interface Props {
    lane: LaneKey;
    title: string;
    meta: string;
    rows: Row[];
    hint: string;
    /** Where the drop placeholder sits, counted among the rows that are not being dragged. */
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

  let { lane, title, meta, rows, hint, slot, dragId, stop, menuId, targeted, actions, onover, ondrop, top, footer }: Props = $props();

  type Entry = { kind: "slot" } | { kind: "row"; row: Row };

  const entries = $derived.by(() => {
    const out: { key: string; entry: Entry }[] = [];
    let seen = 0;
    for (const row of rows) {
      if (row.videoId === dragId) {
        out.push({ key: row.videoId, entry: { kind: "row", row } });
        continue;
      }
      if (slot === seen) out.push({ key: "slot", entry: { kind: "slot" } });
      out.push({ key: row.videoId, entry: { kind: "row", row } });
      seen++;
    }
    if (slot !== null && slot >= seen) out.push({ key: "slot", entry: { kind: "slot" } });
    return out;
  });
</script>

<section
  class="lane"
  class:playing={lane === "playing"}
  class:targeted
  aria-labelledby="lane-{lane}"
  ondragover={(event) => onover(event, lane)}
  ondrop={(event) => ondrop(event, lane)}
>
  <header class="head">
    <h3 id="lane-{lane}">{title}</h3>
    <span class="meta">{meta}</span>
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
    gap: 8px;
    min-width: 0;
    min-height: 0;
    padding: 12px;
    border-radius: 16px;
    background: var(--soft);
  }

  .lane.playing {
    background: var(--ink);
    color: var(--on-ink);
  }

  .lane.targeted {
    box-shadow: inset 0 0 0 2px var(--focus);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin: 2px 4px 4px;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }

  .meta {
    font-size: 13px;
    color: var(--dim);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .playing .meta {
    color: color-mix(in srgb, var(--on-ink) 70%, transparent);
  }

  .top,
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 4px;
    font-size: 13px;
  }

  .foot {
    flex: none;
    margin-top: 4px;
  }

  .list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    margin: 0;
    padding: 2px 4px 4px;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
  }

  .hint {
    margin: 6px 4px;
    font-size: 13px;
    line-height: 1.4;
    color: var(--dim);
  }

  .playing .hint {
    color: color-mix(in srgb, var(--on-ink) 70%, transparent);
  }

  .slot {
    flex: none;
    height: 58px;
    border: 2px dashed color-mix(in srgb, var(--ink) 30%, transparent);
    border-radius: 12px;
  }

  /* Five columns side by side on a desk; horizontally scrolling columns on narrow windows. */
  @media (max-width: 999px) {
    .lane {
      flex: 0 0 280px;
      min-width: 260px;
      scroll-snap-align: start;
    }
  }
</style>
