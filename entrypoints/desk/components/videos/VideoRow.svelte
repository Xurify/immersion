<script lang="ts">
  import { clock, thumbnail } from "../../../../lib/format";
  import { englishName } from "../../../../lib/languages";
  import { langColor } from "../../../../lib/colors.svelte";
  import type { OpenVideo } from "../../../../lib/types";

  let {
    video,
    selected,
    longest,
    ontoggle,
    onfocus,
    onsetlang,
  }: {
    video: OpenVideo;
    selected: boolean;
    /** Longest open video, so every length bar shares one scale. */
    longest: number;
    ontoggle: () => void;
    onfocus: () => void;
    onsetlang: (anchor: HTMLElement) => void;
  } = $props();

  const colour = $derived(langColor(video.lang));
  const known = $derived(video.duration > 0);
  const lengthPct = $derived(known ? (video.duration / longest) * 100 : 0);
  const seenPct = $derived(known ? Math.min(100, (video.position / video.duration) * 100) : 0);
</script>

<li class="card" class:selected style:--c={colour}>
  <label class="check">
    <input type="checkbox" checked={selected} onchange={() => ontoggle()} aria-label="Select {video.title}" />
  </label>

  <button class="open" type="button" onclick={() => onfocus()} title="Show this tab">
    <span class="thumb">
      <img
        src={thumbnail(video.videoId)}
        alt=""
        loading="lazy"
        onerror={(event) => {
          (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </span>
    <span class="title">{video.title}</span>
  </button>

  <div class="meta">
    {#if video.lang}
      <button
        type="button"
        class="lang"
        title="Wrong language? Change it"
        aria-label="Language: {englishName(video.lang)}. Change it"
        onclick={(event) => onsetlang(event.currentTarget)}
      >
        <i class="dot" style:background={colour} aria-hidden="true"></i>
      </button>
    {:else}
      <button type="button" class="set" onclick={(event) => onsetlang(event.currentTarget)}>Set language</button>
    {/if}

    {#if known}
      <span class="time">{clock(video.remaining)} left</span>
      {#if video.position > 0}<span>{Math.round(seenPct)}% seen</span>{/if}
    {/if}
    {#if video.asleep}<span class="tag">Asleep</span>{/if}
  </div>

  {#if known}
    <span class="bar" aria-hidden="true">
      <span class="len" style:width="{lengthPct}%"><span class="seen" style:width="{seenPct}%"></span></span>
    </span>
  {:else}
    <span class="bar shimmer" aria-hidden="true"></span>
  {/if}
</li>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 10px;
    border-radius: 10px;
    background: var(--raised);
    box-shadow: var(--lift);
    transition: box-shadow 0.15s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .card:hover {
    box-shadow: 0 0 0 1px var(--line-2), 0 4px 12px -6px var(--shadow);
  }

  .card.selected {
    box-shadow: 0 0 0 2px var(--c);
  }

  .check {
    position: absolute;
    top: 14px;
    inset-inline-start: 14px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: rgb(14 13 12 / 0.72);
    backdrop-filter: blur(4px);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.22);
    cursor: pointer;
  }

  .check input {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--c);
    cursor: pointer;
  }

  .open {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: inherit;
    text-align: start;
  }

  .open:hover .title {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .thumb {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 8px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
    outline: 1px solid light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.12));
    outline-offset: -1px;
  }

  .thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .title {
    display: -webkit-box;
    min-width: 0;
    overflow: hidden;
    font-size: 13.5px;
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: break-word;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-height: 26px;
    color: var(--dim);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  .lang {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    margin-left: -6px;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
  }

  .lang:hover {
    background: var(--soft);
  }

  .lang .dot {
    width: 12px;
    height: 12px;
  }

  .set {
    min-height: 1.75rem;
    padding: 0 0.7rem;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: var(--raised);
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 600;
  }

  .set:hover {
    border-color: var(--ink);
  }

  .tag {
    padding: 0 7px;
    border-radius: var(--pill);
    background: var(--soft);
    font-size: 11.5px;
    line-height: 1.6;
  }

  .bar {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--soft);
    overflow: hidden;
  }

  .len {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: color-mix(in srgb, var(--c) 28%, var(--soft));
  }

  .seen {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--c);
  }

  .shimmer {
    background: linear-gradient(90deg, var(--soft) 0%, color-mix(in srgb, var(--line) 80%, var(--soft)) 50%, var(--soft) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -100% 0;
    }
  }
</style>
