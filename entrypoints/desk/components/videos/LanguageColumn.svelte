<script lang="ts">
  import { duration } from "../../../../lib/format";
  import { englishName, isCjk, langColor } from "../../../../lib/languages";
  import type { OpenVideo } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";
  import VideoRow from "./VideoRow.svelte";

  let {
    lang,
    videos,
    seconds,
    stacked,
    longest,
    selected,
    ontoggle,
    onfocus,
    onproblem,
  }: {
    lang: string | null;
    videos: OpenVideo[];
    seconds: number;
    stacked: boolean;
    longest: number;
    selected: Set<number>;
    ontoggle: (video: OpenVideo) => void;
    onfocus: (video: OpenVideo) => void;
    onproblem: (message: string) => void;
  } = $props();

  const colour = $derived(langColor(lang));
</script>

<section class="col" class:stacked style:--c={colour} aria-label={englishName(lang)}>
  <header class="head">
    <span class="name" class:cjk={isCjk(lang)}><LangName {lang} /></span>
    <span class="count">{videos.length} {videos.length === 1 ? "video" : "videos"} · {duration(seconds)}</span>
  </header>
  <ul class="list">
    {#each videos as video (video.tabId)}
      <VideoRow
        {video}
        selected={selected.has(video.tabId)}
        {longest}
        ontoggle={() => ontoggle(video)}
        onfocus={() => onfocus(video)}
        {onproblem}
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
    background: var(--raised);
    box-shadow: 0 0 0 1px var(--line);
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

  .name {
    font-size: 30px;
    line-height: 1;
  }

  .name.cjk {
    font-size: 26px;
  }

  .count {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.9;
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .stacked .list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    .stacked .list {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
