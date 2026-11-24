<script lang="ts">
  import { clock, thumbnail } from "../../../../lib/format";
  import { englishName, langColor } from "../../../../lib/languages";
  import type { Column } from "../../../../lib/board";
  import { MOVE_LABEL, timeOf, type CardActions, type Row } from "./rows";

  let {
    row,
    menuOpen,
    stop,
    dragging,
    actions,
  }: { row: Row; menuOpen: boolean; stop: boolean; dragging: boolean; actions: CardActions } = $props();

  const COLUMNS: Column[] = ["next", "inbox", "later", "done"];

  let thumbFailed = $state(false);
  const colour = $derived(langColor(row.lang));
  const gradient = $derived(`linear-gradient(135deg, ${colour}, color-mix(in srgb, ${colour} 45%, #000))`);
  const playing = $derived(row.lane === "playing");
  const percent = $derived(row.duration > 0 ? Math.min(100, (row.position / row.duration) * 100) : 0);
  const time = $derived(
    row.lane === "done" ? clock(row.duration) : `${clock(row.left)}${row.position > 0 ? " left" : ""}`,
  );
</script>

<li
  class="card"
  class:now={playing}
  class:done={row.lane === "done"}
  class:dragging
  draggable="true"
  ondragstart={(event) => actions.dragstart(event, row)}
  ondragend={() => actions.dragend()}
>
  <div
    class="hit"
    role="button"
    tabindex={stop ? 0 : -1}
    aria-label={row.title}
    data-card-id={row.videoId}
    onclick={() => actions.open(row)}
    onfocus={() => actions.focus(row)}
    onkeydown={(event) => actions.key(event, row)}
  >
    <div class="thumb" style:background={gradient}>
      {#if !thumbFailed}
        <img src={thumbnail(row.videoId)} alt="" loading="lazy" width="72" height="41" onerror={() => (thumbFailed = true)} />
      {/if}
    </div>
    <div class="text">
      <b class="title">{row.title}</b>
      <div class="meta">
        <i class="dot" style:background={colour} aria-hidden="true"></i>
        <span class="sr-only">{englishName(row.lang)}</span>
        <span>{time}</span>
        {#if row.tab && !playing}<span class="tab">tab open</span>{/if}
      </div>
    </div>
    {#if row.position > 0 || playing}
      <div class="bar" aria-hidden="true"><i style:width="{percent}%" style:background={colour}></i></div>
    {/if}
  </div>

  {#if !playing}
    <button
      class="more"
      type="button"
      aria-label="Actions for {row.title}"
      aria-expanded={menuOpen}
      onclick={() => actions.menu(row)}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="3" cy="8" r="1.5" fill="currentColor" /><circle cx="8" cy="8" r="1.5" fill="currentColor" /><circle cx="13" cy="8" r="1.5" fill="currentColor" /></svg>
    </button>
  {/if}

  {#if menuOpen}
    <div class="menu">
      <button type="button" onclick={() => actions.play(row)}>Play now</button>
      {#each COLUMNS as column (column)}
        {#if column !== row.source}
          <button type="button" onclick={() => actions.move(row, column)}>Move to {MOVE_LABEL[column]}</button>
        {/if}
      {/each}
      {#if row.source}
        <button type="button" onclick={() => actions.remove(row)}>Remove from board</button>
      {/if}
    </div>
  {/if}
</li>

<style>
  .card {
    position: relative;
    flex: none;
    border-radius: 12px;
    background: var(--raised);
    box-shadow: 0 1px 0 rgb(0 0 0 / 0.04), 0 0 0 1px var(--line);
  }

  .card.dragging {
    opacity: 0.45;
  }

  .card.done {
    opacity: 0.6;
  }

  .card.done .title {
    color: var(--dim);
    text-decoration: line-through;
    text-decoration-color: var(--dim);
  }

  .card.now {
    background: color-mix(in srgb, var(--on-ink) 9%, var(--ink));
    color: var(--on-ink);
    box-shadow: none;
  }

  .hit {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
    border-radius: 12px;
    cursor: pointer;
  }

  .thumb {
    aspect-ratio: 16 / 9;
    border-radius: 6px;
    overflow: hidden;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    min-width: 0;
    padding-right: 26px;
  }

  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 13.5px;
    line-height: 1.2;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }

  .now .meta {
    color: color-mix(in srgb, var(--on-ink) 70%, transparent);
  }

  .tab {
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: var(--pill);
    font-size: 11px;
    line-height: 1.5;
  }

  .bar {
    grid-column: 1 / -1;
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    overflow: hidden;
  }

  .now .bar {
    background: color-mix(in srgb, var(--on-ink) 18%, transparent);
  }

  .bar i {
    display: block;
    height: 100%;
    border-radius: 2px;
  }

  .more {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
  }

  .more:hover,
  .more[aria-expanded="true"] {
    background: var(--soft);
    color: var(--ink);
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px 8px;
  }

  .menu button {
    padding: 6px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font-size: 13px;
    text-align: start;
  }

  .menu button:hover {
    background: var(--soft);
  }
</style>
