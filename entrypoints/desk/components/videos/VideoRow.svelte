<script lang="ts">
  import { clock, thumbnail } from "../../../../lib/format";
  import { COMMON_LANGS, englishName, langColor, nativeName } from "../../../../lib/languages";
  import { send } from "../../../../lib/messages";
  import type { OpenVideo } from "../../../../lib/types";

  let {
    video,
    selected,
    longest,
    ontoggle,
    onfocus,
    onproblem,
  }: {
    video: OpenVideo;
    selected: boolean;
    /** Longest open video, so every length bar shares one scale. */
    longest: number;
    ontoggle: () => void;
    onfocus: () => void;
    onproblem: (message: string) => void;
  } = $props();

  const colour = $derived(langColor(video.lang));
  const lengthPct = $derived(video.duration > 0 ? (video.duration / longest) * 100 : 0);
  const seenPct = $derived(video.duration > 0 ? Math.min(100, (video.position / video.duration) * 100) : 0);

  async function setLanguage(event: Event & { currentTarget: HTMLSelectElement }) {
    const select = event.currentTarget;
    const lang = select.value;
    if (!lang) return;
    try {
      await send("lang:override", { videoId: video.videoId, channel: video.channel, lang, scope: "channel" });
    } catch (error) {
      onproblem(error instanceof Error ? error.message : String(error));
    }
    select.value = "";
  }
</script>

<li class="row" class:selected style:--c={colour}>
  <span class="check">
    <input type="checkbox" checked={selected} onchange={() => ontoggle()} aria-label="Select {video.title}" />
  </span>

  <div class="body">
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
      <span class="text">
        <span class="title">{video.title}</span>
        <span class="meta">
          <span class="length" aria-hidden="true">
            <span class="track" style:width="{lengthPct}%"><span class="seen" style:width="{seenPct}%"></span></span>
          </span>
          <span>{video.duration > 0 ? clock(video.remaining) : "length unknown"}</span>
          {#if video.position > 0 && video.duration > 0}
            <span>· {Math.round(seenPct)}% seen</span>
          {/if}
          {#if video.asleep}
            <span>· asleep</span>
          {/if}
        </span>
      </span>
    </button>

    {#if !video.lang}
      <select class="lang" aria-label="Set language for {video.channel}" onchange={setLanguage}>
        <option value="">Set language…</option>
        {#each COMMON_LANGS as code (code)}
          <option value={code}>{nativeName(code)} · {englishName(code)}</option>
        {/each}
      </select>
    {/if}
  </div>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 4px 6px;
    align-items: start;
    padding: 10px 14px 12px 10px;
    border-top: 1px solid var(--line);
  }

  .row.selected {
    background: color-mix(in srgb, var(--ink) 4%, var(--raised));
  }

  .check {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
  }

  .check input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--ink);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .open {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
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
    border-radius: 6px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
  }

  .thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 14.5px;
    font-weight: 700;
    line-height: 1.2;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    color: var(--dim);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  .length {
    display: block;
    flex: none;
    width: 96px;
    height: 5px;
    border-radius: 3px;
  }

  .track {
    display: block;
    height: 100%;
    max-width: 100%;
    border-radius: 3px;
    background: color-mix(in srgb, var(--c) 28%, var(--soft));
  }

  .seen {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--c);
  }

  .lang {
    justify-self: start;
    min-height: 2.25rem;
    padding: 0 10px;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: var(--raised);
    font-size: 13px;
  }
</style>
