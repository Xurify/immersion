<script lang="ts">
  import { clock, thumbnail } from "../../../../lib/format";
  import { englishName } from "../../../../lib/languages";
  import LangName from "../../../../ui/LangName.svelte";
  import { langColor } from "../../../../lib/colors.svelte";
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
  let cardEl = $state<HTMLLIElement>();
  const colour = $derived(langColor(row.lang));
  const gradient = $derived(`linear-gradient(135deg, ${colour}, color-mix(in srgb, ${colour} 45%, #000))`);
  const playing = $derived(row.lane === "playing");
  const percent = $derived(row.duration > 0 ? Math.min(100, (row.position / row.duration) * 100) : 0);
  // Zero length means the video's details never arrived; a dash reads better than 0:00.
  const time = $derived.by(() => {
    if (row.duration <= 0) return "";
    return row.lane === "done" || row.position <= 0 ? clock(row.duration) : `${clock(row.left)} left`;
  });

  function setLang() {
    if (cardEl) actions.setLang(row, cardEl);
  }
</script>

<li
  bind:this={cardEl}
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
        <img src={thumbnail(row.videoId)} alt="" loading="lazy" width="96" height="54" onerror={() => (thumbFailed = true)} />
      {/if}
      {#if time}<span class="len">{time}</span>{/if}
      {#if row.position > 0 || playing}
        <span class="seen" aria-hidden="true"><i style:width="{percent}%" style:background={colour}></i></span>
      {/if}
    </div>
    <div class="text">
      <b class="title">{row.title}</b>
      <div class="meta">
        <i class="dot" style:background={colour} aria-hidden="true"></i>
        {#if row.lang}<LangName lang={row.lang} />{:else}<span>Unknown</span>{/if}
        {#if row.card.channel}<span class="channel">· {row.card.channel}</span>{/if}
      </div>
      {#if row.tab && !playing}<span class="tag">Tab open</span>{/if}
    </div>
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
      <button type="button" onclick={setLang}>Set language</button>
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
    border-radius: 14px;
    background: var(--raised);
    box-shadow: var(--lift);
    transition: box-shadow 0.15s ease, transform 0.15s ease;
  }

  .card:hover {
    box-shadow: 0 0 0 1px var(--line-2), 0 10px 24px -12px var(--shadow);
  }

  .card:has(.hit:active) {
    transform: scale(0.99);
  }

  .card.dragging {
    opacity: 0.4;
  }

  .card.done .thumb {
    opacity: 0.55;
  }

  .card.done .title {
    color: var(--dim);
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--ink) 50%, transparent);
  }

  .card.now {
    background: color-mix(in srgb, var(--on-ink) 8%, var(--ink));
    color: var(--on-ink);
    box-shadow: none;
  }

  .hit {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 10px;
    padding: 8px;
    border-radius: 14px;
    cursor: pointer;
  }

  .thumb {
    position: relative;
    align-self: start;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .len {
    position: absolute;
    right: 4px;
    bottom: 6px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgb(0 0 0 / 0.78);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
  }

  .seen {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: rgb(255 255 255 / 0.3);
  }

  .seen i {
    display: block;
    height: 100%;
  }

  .text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-width: 0;
    padding: 2px 28px 2px 0;
  }

  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 13.5px;
    font-weight: 650;
    line-height: 1.3;
    overflow-wrap: anywhere;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    font-size: 12px;
    color: var(--dim);
  }

  .meta .dot {
    width: 8px;
    height: 8px;
    border-radius: 2.5px;
  }

  .meta :global(.native) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--ink-2);
  }

  /* Narrow columns keep the language and drop the channel rather than cut both. */
  @container lane (max-width: 330px) {
    .channel {
      display: none;
    }
  }

  .channel {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .now .text {
    padding-right: 0;
  }

  .now .meta,
  .now .meta :global(.native) {
    color: color-mix(in srgb, var(--on-ink) 70%, transparent);
  }

  .tag {
    padding: 0 7px;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink-2);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.6;
  }

  .more {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
  }

  /* With a mouse, the menu button waits for hover so the titles read clean. */
  @media (hover: hover) {
    .more {
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .card:hover .more,
    .card:focus-within .more,
    .more[aria-expanded="true"] {
      opacity: 1;
    }
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
    margin: 0 8px;
    padding: 6px 0 8px;
    border-top: 1px solid var(--line);
  }

  .menu button {
    padding: 7px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font-size: 13px;
    font-weight: 500;
    text-align: start;
  }

  .menu button:hover {
    background: var(--soft);
  }
</style>
