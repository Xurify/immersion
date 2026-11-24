<script lang="ts">
  import { clock } from "../lib/format";
  import { langColor } from "../lib/languages";
  import type { OpenVideo } from "../lib/types";

  /** A session drawn to scale: one block per video, width by time left, colour by language. */
  let {
    videos,
    labels = true,
    height = 64,
    onpick,
  }: { videos: OpenVideo[]; labels?: boolean; height?: number; onpick?: (video: OpenVideo) => void } = $props();
</script>

<ol class="strip" class:bare={!labels} style:height="{height}px" aria-label="Session order">
  {#each videos as video, i (video.videoId)}
    <li style:flex-grow={Math.max(video.remaining, 60)} style:--c={langColor(video.lang)}>
      {#if labels}
        <button type="button" onclick={() => onpick?.(video)} title={video.title}>
          <b>{video.title}</b>
          <span>{i === 0 ? "Now · " : ""}{clock(video.remaining)}</span>
        </button>
      {:else}
        <span class="sr-only">{video.title}, {clock(video.remaining)}</span>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .strip {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    flex-basis: 0;
    min-width: 6px;
    border-radius: var(--r-sm);
    background: var(--c);
    overflow: hidden;
    container-type: inline-size;
  }

  /* Narrow blocks drop their text rather than show a clipped letter or two. */
  @container (max-width: 72px) {
    button > * {
      visibility: hidden;
    }
  }

  .bare li {
    border-radius: 3px;
  }

  button {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 9px 12px;
    border: 0;
    background: transparent;
    color: #fff;
    text-align: start;
  }

  button:hover {
    background: rgb(255 255 255 / 0.08);
  }

  b {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 12px;
    opacity: 0.88;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
