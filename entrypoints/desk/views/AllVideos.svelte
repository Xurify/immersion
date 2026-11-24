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
  // Two or three groups sit side by side; one group or four or more run full width.
  const sideBySide = $derived(groups.length >= 2 && groups.length <= 3);

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

    <header class="top">
      <div class="total">
        {#if knownCount > 0}
          <p class="big">{hoursClock(totalSeconds)}<span class="unit">h</span></p>
        {:else if tabs.length}
          <p class="reading-now">Reading video details…</p>
        {/if}
        <p class="dim">
          in {tabs.length} open {tabs.length === 1 ? "tab" : "tabs"}{knownCount > 0 && loadingCount ? ` · + ${loadingCount} still loading` : ""}
        </p>
      </div>

      <div class="tools">
        <div class="sources" role="group" aria-label="Show">
          <button type="button" class="pill" aria-current={source === "open" ? "true" : undefined} onclick={() => setSource("open")}>
            Open tabs <span class="count">{tabs.length}</span>
          </button>
          <button type="button" class="pill" aria-current={source === "saved" ? "true" : undefined} onclick={() => setSource("saved")}>
            Saved sessions <span class="count">{data.sessions.length}</span>
          </button>
          <button type="button" class="pill" aria-current={source === "reading" ? "true" : undefined} onclick={() => setSource("reading")}>
            Reading list
            {#if reading}<span class="count">{reading.length}</span>{/if}
          </button>
        </div>
        <input
          bind:this={searchEl}
          bind:value={query}
          type="search"
          class="input search"
          placeholder="Search"
          aria-label="Search videos"
          title="Press / to search"
        />
      </div>
    </header>

    {#if source === "open" && tabs.length}
      <MixBar parts={mix} height={12} />
    {/if}

    {#if problem}
      <p class="problem" role="alert">Could not do that. {problem}</p>
    {/if}

    {#if source === "open"}
      {#if !tabs.length}
        <div class="empty">
          <p class="empty-title">No YouTube videos open.</p>
          <p class="dim">Open a video in a language you are learning and it appears here, sorted by language.</p>
        </div>
      {:else if !groups.length}
        <p class="empty dim">No open videos match “{query}”.</p>
      {:else}
        <div class:columns={sideBySide} class:stack={!sideBySide}>
          {#each groups as group (group.lang ?? "unknown")}
            <LanguageColumn
              lang={group.lang}
              videos={group.videos}
              seconds={group.seconds}
              loading={group.loading}
              wide={!sideBySide || group.videos.length > 8}
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
    gap: 18px;
    padding: 14px clamp(16px, 3vw, 40px) 120px;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px 24px;
  }

  .total {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 4px 16px;
  }

  .total .big {
    margin: 0;
    font-size: clamp(64px, 8vw, 84px);
    line-height: 0.8;
  }

  .total .unit {
    font-size: 0.38em;
  }

  .reading-now {
    margin: 0;
    font-size: clamp(28px, 3.5vw, 40px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .total p.dim {
    margin: 0 0 6px;
    font-size: 18px;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sources .pill {
    white-space: nowrap;
  }

  .sources .count {
    color: inherit;
    opacity: 0.7;
  }

  .search {
    width: 220px;
    max-width: 100%;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    align-items: start;
    gap: 14px;
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

  .empty-title {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 700;
  }

  .problem {
    margin: 0;
    color: var(--danger);
    font-size: 14px;
  }
</style>
