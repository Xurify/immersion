<script lang="ts">
  import { clock, thumbnail } from "../../../../lib/format";
  import LangName from "../../../../ui/LangName.svelte";
  import { langColor } from "../../../../lib/colors.svelte";
  import type { Column } from "../../../../lib/board";
  import { MOVE_LABEL, type CardActions, type Row } from "./rows";

  interface Props {
    row: Row;
    menuOpen: boolean;
    stop: boolean;
    dragging: boolean;
    actions: CardActions;
  }

  let { row, menuOpen, stop, dragging, actions }: Props = $props();

  const COLUMNS: Column[] = ["next", "inbox", "later", "done"];

  let thumbFailed = $state(false);
  let cardElement = $state<HTMLLIElement>();
  const colour = $derived(langColor(row.lang));
  const gradient = $derived(`linear-gradient(135deg, ${colour}, color-mix(in srgb, ${colour} 45%, #000))`);
  const playing = $derived(row.lane === "playing");
  const percent = $derived(row.duration > 0 ? Math.min(100, (row.position / row.duration) * 100) : 0);

  const time = $derived.by((): string => {
    if (row.duration <= 0) return "";
    return row.lane === "done" || row.position <= 0 ? clock(row.duration) : `${clock(row.left)} left`;
  });

  const watchedText = $derived.by((): string => {
    if (row.duration > 0 && row.duration < 60) {
      return `${Math.min(Math.round(row.watched), Math.round(row.duration))} of ${Math.round(row.duration)} sec`;
    }
    const watched = Math.max(1, Math.round(row.watched / 60));
    if (row.duration <= 0) return `${watched} min`;
    const total = Math.max(1, Math.round(row.duration / 60));
    return `${Math.min(watched, total)} of ${total} min`;
  });

  function handleSetLang(): void {
    if (cardElement) actions.setLang(row, cardElement);
  }
</script>

<li
  bind:this={cardElement}
  class={["card", playing && "now", row.lane === "done" && "done", dragging && "dragging"]}
  style:--c={colour}
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
        <img src={thumbnail(row.videoId)} alt="" loading="lazy" width="100" height="56" onerror={() => (thumbFailed = true)} />
      {/if}
      {#if time}<span class="len">{time}</span>{/if}
      {#if row.position > 0 || playing}
        <span class="seen" aria-hidden="true"><i style:width="{percent}%" style:background={colour}></i></span>
      {:else}
        <span class="lang-edge" aria-hidden="true"></span>
      {/if}
    </div>
    <div class="text">
      <b class="title">{row.title}</b>
      <div class="meta">
        <i class="dot" style:background={colour} aria-hidden="true"></i>
        {#if row.lang}<LangName lang={row.lang} />{:else}<span>Unknown</span>{/if}
        {#if row.card.channel}<span class="channel">· {row.card.channel}</span>{/if}
      </div>
      {#if row.lane === "done" && row.watched >= 30}
        <span class="watched">Watched {watchedText}</span>
      {:else if row.tab && !playing}
        <span class="tag">Tab open</span>
      {/if}
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
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="3" cy="8" r="1.4" fill="currentColor" />
        <circle cx="8" cy="8" r="1.4" fill="currentColor" />
        <circle cx="13" cy="8" r="1.4" fill="currentColor" />
      </svg>
    </button>
  {/if}

  {#if menuOpen}
    <div class="menu">
      <button type="button" onclick={() => actions.play(row)}>Play now</button>
      <button type="button" onclick={handleSetLang}>Set language</button>
      {#if row.card.channel}
        <button type="button" onclick={() => actions.follow(row)}>Follow {row.card.channel}</button>
      {/if}
      {#each COLUMNS as column (column)}
        {#if column !== row.source}
          <button type="button" onclick={() => actions.move(row, column)}>Move to {MOVE_LABEL[column]}</button>
        {/if}
      {/each}
      {#if row.source}
        <button type="button" class="danger" onclick={() => actions.remove(row)}>Remove from board</button>
      {/if}
    </div>
  {/if}
</li>

<style>
  .card {
    position: relative;
    flex: none;
    border-radius: 11px;
    background: var(--raised);
    box-shadow: var(--lift);
    transition: box-shadow 0.15s ease, transform 0.14s cubic-bezier(0.2, 0, 0, 1);
  }

  .card:hover {
    box-shadow: 0 0 0 1px var(--line-2), 0 4px 12px -6px var(--shadow);
  }

  .card:has(.hit:active) {
    transform: scale(0.98);
  }

  .card.dragging {
    opacity: 0.4;
  }

  .card.done .thumb {
    opacity: 0.58;
  }

  .card.done .title {
    color: var(--dim);
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--ink) 45%, transparent);
  }

  .hit {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 11px;
    padding: 8px;
    border-radius: 11px;
    cursor: pointer;
  }

  .thumb {
    position: relative;
    align-self: start;
    aspect-ratio: 16 / 9;
    border-radius: 6px;
    overflow: hidden;
    outline: 1px solid light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.12));
    outline-offset: -1px;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .len {
    position: absolute;
    inset-inline-end: 4px;
    bottom: 6px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgb(0 0 0 / 0.78);
    color: #fff;
    font-size: 10.5px;
    font-weight: 650;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
  }

  .seen {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 3px;
    background: rgb(255 255 255 / 0.3);
  }

  .seen i {
    display: block;
    height: 100%;
  }

  .lang-edge {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 2.5px;
    background: var(--c);
    opacity: 0.85;
  }

  .text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    min-width: 0;
    padding: 1px 24px 1px 0;
  }

  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 13.5px;
    font-weight: 650;
    line-height: 1.3;
    overflow-wrap: break-word;
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
    width: 7.5px;
    height: 7.5px;
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

  @container lane (max-width: 260px) {
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

  .watched {
    color: var(--ink-2);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .tag {
    padding: 1px 6px;
    border-radius: 5px;
    background: var(--soft);
    color: var(--dim);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1.5;
  }

  .more {
    position: absolute;
    top: 5px;
    inset-inline-end: 5px;
    display: grid;
    place-items: center;
    width: 1.85rem;
    height: 1.85rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    transition: opacity 0.14s ease, background-color 0.14s ease, color 0.14s ease;
  }

  @media (hover: hover) {
    .more {
      opacity: 0;
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
    font-weight: 550;
    text-align: start;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .menu button:hover {
    background: var(--soft);
  }

  .menu button.danger:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }
</style>
