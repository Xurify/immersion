<script lang="ts">
  import { duration } from "../../../../lib/format";
  import { englishName, isCjk } from "../../../../lib/languages";
  import { langColor } from "../../../../lib/colors.svelte";
  import type { OpenVideo } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";
  import VideoRow from "./VideoRow.svelte";

  let {
    lang,
    videos,
    seconds,
    loading,
    wide,
    longest,
    selected,
    ontoggle,
    onfocus,
    onsetlang,
  }: {
    lang: string | null;
    videos: OpenVideo[];
    /** Seconds left across the videos whose length is known. */
    seconds: number;
    /** Videos whose length has not arrived yet. */
    loading: number;
    /** Spans the whole width; otherwise it sits in a side-by-side column. */
    wide: boolean;
    longest: number;
    selected: Set<number>;
    ontoggle: (video: OpenVideo) => void;
    onfocus: (video: OpenVideo) => void;
    onsetlang: (video: OpenVideo, anchor: HTMLElement) => void;
  } = $props();

  const colour = $derived(langColor(lang));
  const summary = $derived(
    [`${videos.length} ${videos.length === 1 ? "video" : "videos"}`, seconds > 0 ? duration(seconds) : "", loading ? `${loading} loading` : ""]
      .filter(Boolean)
      .join(" · "),
  );
</script>

<section
  class="col"
  class:wide
  class:unknown={lang === null}
  style:--c={colour}
  aria-label={lang ? englishName(lang) : "Language not detected yet"}
>
  <header class="head">
    {#if lang}
      <span class="name" class:cjk={isCjk(lang)}><LangName {lang} /></span>
    {:else}
      <span class="unknown-name">Language not detected yet</span>
    {/if}
    <span class="count">{summary}</span>
  </header>
  <ul class="list">
    {#each videos as video (video.tabId)}
      <VideoRow
        {video}
        selected={selected.has(video.tabId)}
        {longest}
        ontoggle={() => ontoggle(video)}
        onfocus={() => onfocus(video)}
        onsetlang={(anchor) => onsetlang(video, anchor)}
      />
    {/each}
  </ul>
</section>

<style>
  .col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--r-md);
    background: var(--soft);
    box-shadow: 0 0 0 1px var(--line);
  }

  .col.wide {
    grid-column: 1 / -1;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 12px;
    padding: 14px 18px;
    background: var(--c);
    color: #fff;
  }

  .unknown .head {
    background: var(--raised);
    color: var(--ink);
    box-shadow: inset 0 -1px 0 var(--line);
  }

  .name {
    font-size: 30px;
    line-height: 1;
  }

  .name.cjk {
    font-size: 26px;
  }

  .unknown-name {
    font-size: 17px;
    font-weight: 700;
  }

  .count {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.9;
    font-variant-numeric: tabular-nums;
  }

  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 10px;
    margin: 0;
    padding: 12px;
    list-style: none;
  }
</style>
