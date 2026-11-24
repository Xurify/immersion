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

  const ICON: Record<LaneKey, string> = {
    inbox: "M3 13h4l1.5 2.5h7L17 13h4M5 5h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z",
    next: "M4 6h16M4 12h10M4 18h7M17 15l4 3-4 3z",
    playing: "M7 4.5v15l12-7.5z",
    done: "M4 12.5l5 5L20 6.5",
    later: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  };

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
  class:playing={lane === "playing" && rows.length > 0}
  class:idle={lane === "playing" && rows.length === 0}
  class:targeted
  aria-labelledby="lane-{lane}"
  ondragover={(event) => onover(event, lane)}
  ondrop={(event) => ondrop(event, lane)}
>
  <header class="head">
    <h3 id="lane-{lane}">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={ICON[lane]} fill={lane === "playing" ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {title}
    </h3>
    {#if meta}<span class="meta">{meta}</span>{/if}
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
    border-radius: var(--r-xl);
    background: color-mix(in srgb, var(--soft) 70%, var(--bg));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line) 60%, transparent);
  }

  .lane.playing {
    background: var(--ink);
    color: var(--on-ink);
    box-shadow: 0 16px 40px -20px var(--shadow);
  }

  /* Nothing playing: an open slot rather than a lit panel. */
  .lane.idle {
    background: transparent;
    box-shadow: none;
    outline: 1.5px dashed var(--line-2);
    outline-offset: -1.5px;
  }

  .lane.idle .list {
    justify-content: center;
  }

  .lane.idle .hint {
    align-self: center;
    max-width: 16em;
    text-align: center;
  }

  .lane.playing :global(:focus-visible) {
    outline-color: var(--on-ink);
  }

  .lane.targeted {
    box-shadow: inset 0 0 0 2px var(--focus);
    outline: none;
  }

  .lane.playing.targeted {
    box-shadow: inset 0 0 0 2px var(--on-ink);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
    margin: 2px 4px 2px;
  }

  h3 {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }

  h3 svg {
    color: var(--dim);
  }

  .playing h3 svg {
    color: inherit;
  }

  .meta {
    min-width: 0;
    overflow: hidden;
    padding: 2px 8px;
    border-radius: var(--pill);
    background: var(--raised);
    box-shadow: 0 0 0 1px var(--line);
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .playing .meta {
    box-shadow: none;
    background: color-mix(in srgb, var(--on-ink) 14%, transparent);
    color: color-mix(in srgb, var(--on-ink) 80%, transparent);
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
    container: lane / inline-size;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
  }

  .hint {
    margin: 4px 0;
    font-size: 13px;
    line-height: 1.45;
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
  @media (max-width: 1360px) {
    .lane {
      flex: 0 0 280px;
      min-width: 260px;
      scroll-snap-align: start;
    }
  }
</style>
