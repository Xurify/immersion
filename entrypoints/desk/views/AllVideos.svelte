<script lang="ts">
  import { data } from "../../../lib/data.svelte";
  import { hoursClock, uid } from "../../../lib/format";
  import { send } from "../../../lib/messages";
  import { load, save } from "../../../lib/storage";
  import type { OpenVideo, ReadingItem, Session } from "../../../lib/types";
  import SetLanguagePopover from "../components/SetLanguagePopover.svelte";
  import LanguageColumn from "../components/videos/LanguageColumn.svelte";
  import MixBar from "../components/videos/MixBar.svelte";
  import { mixOf } from "../components/videos/mix";
  import ReadingRow from "../components/videos/ReadingRow.svelte";
  import SelectionBar from "../components/videos/SelectionBar.svelte";
  import SessionRow from "../components/videos/SessionRow.svelte";

  type Source = "open" | "saved" | "reading";
  interface Group {
    lang: string | null;
    videos: OpenVideo[];
    seconds: number;
    loading: number;
  }
  interface LangTarget {
    videoId: string;
    channel: string;
    title: string;
    anchor: HTMLElement;
  }

  let source = $state<Source>("open");
  let query = $state("");
  let searchEl = $state<HTMLInputElement>();
  let selected = $state(new Set<number>());
  let reading = $state<ReadingItem[] | null>(null);
  let problem = $state("");
  let langTarget = $state<LangTarget | null>(null);

  const tabs = $derived(data.tabs);
  const needle = $derived(query.trim().toLowerCase());
  const matches = (...fields: string[]) => !needle || fields.some((field) => field.toLowerCase().includes(needle));

  const visible = $derived(tabs.filter((video) => matches(video.title, video.channel)));
  const loadingCount = $derived(tabs.filter((video) => video.duration <= 0).length);
  const knownCount = $derived(tabs.length - loadingCount);
  const totalSeconds = $derived(tabs.reduce((sum, video) => sum + (video.duration > 0 ? video.remaining : 0), 0));
  const longest = $derived(tabs.reduce((max, video) => Math.max(max, video.duration), 1));
  const mix = $derived(mixOf(tabs.map((video) => ({ lang: video.lang, seconds: video.remaining }))));
  const goalLangs = $derived(Object.keys(data.goals));

  // Goal languages first in goal order, then the rest by time, with unknown language last.
  const groups = $derived.by(() => {
    const byLang = new Map<string | null, OpenVideo[]>();
    for (const video of visible) byLang.set(video.lang, [...(byLang.get(video.lang) ?? []), video]);
    const goalOrder = Object.keys(data.goals);
    const rank = (group: Group) => (group.lang === null ? 2 : goalOrder.includes(group.lang) ? 0 : 1);
    return [...byLang]
      .map(
        ([lang, videos]): Group => ({
          lang,
          videos,
          seconds: videos.reduce((sum, video) => sum + (video.duration > 0 ? video.remaining : 0), 0),
          loading: videos.filter((video) => video.duration <= 0).length,
        }),
      )
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (rank(a) === 0 ? goalOrder.indexOf(a.lang ?? "") - goalOrder.indexOf(b.lang ?? "") : b.seconds - a.seconds),
      );
  });
  // Two or more groups flow in a 2-column bento grid; large groups (>6) or odd-last span full width.
  const useGrid = $derived(groups.length >= 2);

  const screen = $derived(groups.flatMap((group) => group.videos));
  // Selection survives a search: hidden picks still count, in on-screen order.
  const picked = $derived.by(() => {
    const rank = new Map(screen.map((video, index): [number, number] => [video.tabId, index]));
    return tabs
      .filter((video) => selected.has(video.tabId))
      .sort((a, b) => (rank.get(a.tabId) ?? 1e9) - (rank.get(b.tabId) ?? 1e9));
  });
  const pickedSeconds = $derived(picked.reduce((sum, video) => sum + video.remaining, 0));

  const savedSessions = $derived(
    [...data.sessions]
      .sort((a, b) => b.savedAt - a.savedAt)
      .filter((session) => matches(session.name, ...session.videos.map((video) => video.title))),
  );
  const readingList = $derived((reading ?? []).filter((item) => matches(item.title)));

  async function call(action: Promise<unknown>): Promise<boolean> {
    problem = "";
    try {
      await action;
      return true;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function setSource(next: Source) {
    source = next;
    if (next === "reading" && reading === null) {
      void call(send("reading:list", {}).then((items) => (reading = items)));
    }
  }

  function toggle(video: OpenVideo) {
    const next = new Set(selected);
    if (next.has(video.tabId)) next.delete(video.tabId);
    else next.add(video.tabId);
    selected = next;
  }

  function focus(video: OpenVideo) {
    void call(send("tabs:focus", { tabId: video.tabId }));
  }

  function setLanguage(video: OpenVideo, anchor: HTMLElement) {
    langTarget = langTarget?.anchor === anchor ? null : { videoId: video.videoId, channel: video.channel, title: video.title, anchor };
  }

  function startPicked() {
    void call(send("session:start", { tabIds: picked.map((video) => video.tabId) }));
  }

  async function closePicked() {
    const ok = await call(send("tabs:close", { tabIds: picked.map((video) => video.tabId) }));
    if (ok) selected = new Set();
  }

  async function saveSession(name: string) {
    const session: Session = {
      id: uid(),
      name: name || `Session, ${new Date().toLocaleDateString([], { day: "numeric", month: "short" })}`,
      savedAt: Date.now(),
      videos: picked.map((video) => ({
        url: video.url,
        videoId: video.videoId,
        title: video.title,
        channel: video.channel,
        duration: video.duration,
        lang: video.lang,
      })),
    };
    const ok = await call(load("sessions").then((sessions) => save("sessions", [session, ...sessions])));
    if (ok) selected = new Set();
  }

  function openSession(session: Session) {
    void call(send("session:open", { sessionId: session.id }));
  }

  async function deleteSession(session: Session) {
    await call(load("sessions").then((sessions) => save("sessions", sessions.filter((entry) => entry.id !== session.id))));
  }

  function openReading(item: ReadingItem) {
    void browser.tabs.create({ url: item.url });
  }

  async function removeReading(item: ReadingItem) {
    const ok = await call(send("reading:remove", { url: item.url }));
    if (ok) reading = (reading ?? []).filter((entry) => entry.url !== item.url);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], dialog")) return;
    if (event.key === "/") {
      event.preventDefault();
      searchEl?.focus();
    } else if (event.key === "Escape" && picked.length) {
      selected = new Set();
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="videos" aria-busy={!data.loaded}>
  {#if data.loaded}
    <h1 class="sr-only">All videos</h1>

    <header class="hero-card">
      <div class="top">
        {#if tabs.length}
          <div class="total">
            {#if knownCount > 0}
              <p class="big">{hoursClock(totalSeconds)}<span class="unit">h</span></p>
            {:else}
              <p class="reading-now">Reading video details…</p>
            {/if}
            <p class="dim">
              left in {tabs.length} open {tabs.length === 1 ? "tab" : "tabs"}{knownCount > 0 && loadingCount ? ` · ${loadingCount} still loading` : ""}
            </p>
          </div>
        {/if}

        <div class="tools">
          <div class="seg" role="group" aria-label="Show">
            <button type="button" aria-current={source === "open" ? "true" : undefined} onclick={() => setSource("open")}>
              Open tabs <span class="count">{tabs.length}</span>
            </button>
            <button type="button" aria-current={source === "saved" ? "true" : undefined} onclick={() => setSource("saved")}>
              Saved sessions <span class="count">{data.sessions.length}</span>
            </button>
            <button type="button" aria-current={source === "reading" ? "true" : undefined} onclick={() => setSource("reading")}>
              Reading list
              {#if reading}<span class="count">{reading.length}</span>{/if}
            </button>
          </div>
          <div class="search-wrap">
            <svg class="search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path d="M10.4 10.4 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <input
              bind:this={searchEl}
              bind:value={query}
              type="search"
              class="input search"
              placeholder="Search videos"
              aria-label="Search videos"
              title="Press / to search"
            />
            {#if !query}
              <kbd class="search-kbd" aria-hidden="true">/</kbd>
            {/if}
          </div>
        </div>
      </div>

      {#if source === "open" && tabs.length}
        <MixBar parts={mix} height={10} />
      {/if}
    </header>

    {#if problem}
      <p class="problem" role="alert">Could not do that. {problem}</p>
    {/if}

    {#if source === "open"}
      {#if !tabs.length}
        <div class="empty-state">
          <h2>No YouTube videos open</h2>
          <p>Open a video in a language you are learning and it appears here, sorted by language.</p>
        </div>
      {:else if !groups.length}
        <p class="empty dim">No open videos match “{query}”.</p>
      {:else}
        <div class:columns={useGrid} class:stack={!useGrid}>
          {#each groups as group, index (group.lang ?? "unknown")}
            {@const isOddLast = useGrid && groups.length % 2 === 1 && index === groups.length - 1}
            <LanguageColumn
              lang={group.lang}
              videos={group.videos}
              seconds={group.seconds}
              loading={group.loading}
              wide={!useGrid || group.videos.length > 6 || isOddLast}
              {longest}
              {selected}
              ontoggle={toggle}
              onfocus={focus}
              onsetlang={setLanguage}
            />
          {/each}
        </div>
      {/if}
    {:else if source === "saved"}
      {#if !data.sessions.length}
        <p class="empty dim">No saved sessions yet. Select videos under Open tabs and choose Save to keep a set for later.</p>
      {:else if !savedSessions.length}
        <p class="empty dim">No saved sessions match “{query}”.</p>
      {:else}
        <ul class="rows">
          {#each savedSessions as session (session.id)}
            <SessionRow {session} onopen={() => openSession(session)} ondelete={() => deleteSession(session)} />
          {/each}
        </ul>
      {/if}
    {:else}
      {#if reading === null}
        <p class="empty dim">Loading your reading list.</p>
      {:else if !reading.length}
        <p class="empty dim">Nothing on your reading list yet.</p>
      {:else if !readingList.length}
        <p class="empty dim">No saved videos match “{query}”.</p>
      {:else}
        <ul class="rows">
          {#each readingList as item (item.url)}
            <ReadingRow {item} onopen={() => openReading(item)} onremove={() => removeReading(item)} />
          {/each}
        </ul>
      {/if}
    {/if}

    {#if langTarget}
      <SetLanguagePopover
        videoId={langTarget.videoId}
        channel={langTarget.channel}
        title={langTarget.title}
        anchor={langTarget.anchor}
        suggested={goalLangs}
        onclose={() => (langTarget = null)}
      />
    {/if}

    {#if source === "open" && picked.length}
      <SelectionBar count={picked.length} seconds={pickedSeconds} onsave={saveSession} onclose={closePicked} onstart={startPicked} />
    {/if}
  {/if}
</section>

<style>
  .videos {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px var(--gutter) 120px;
  }

  .hero-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 0 0;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px 24px;
  }

  .total {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 14px;
  }

  .total .big {
    margin: 0;
    font-size: clamp(46px, 5.5vw, 62px);
    line-height: 0.85;
  }

  .total .unit {
    font-size: 0.38em;
    color: var(--ink-2);
  }

  .reading-now {
    margin: 0;
    font-size: clamp(24px, 3vw, 34px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .total p.dim {
    margin: 0;
    font-size: 14.5px;
    font-weight: 500;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    inset-inline-start: 13px;
    color: var(--dim);
    pointer-events: none;
  }

  .search {
    width: 230px;
    min-height: 2.375rem;
    max-width: 100%;
    padding-inline: 36px 32px;
    border-radius: 10px;
    background: var(--raised);
  }

  .search-kbd {
    position: absolute;
    inset-inline-end: 10px;
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding-inline: 5px;
    border: 1px solid var(--line-2);
    border-radius: 5px;
    background: var(--raised);
    color: var(--dim);
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 14px;
  }

  @media (max-width: 820px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rows {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    border-radius: var(--r-md);
    background: var(--raised);
    box-shadow: 0 0 0 1px var(--line);
  }

  .empty {
    margin: 0;
    padding: 28px 0;
    font-size: 16px;
  }

  .problem {
    margin: 0;
    color: var(--danger);
    font-size: 14px;
  }

  @media (max-width: 520px) {
    .search {
      width: 100%;
    }
  }
</style>
