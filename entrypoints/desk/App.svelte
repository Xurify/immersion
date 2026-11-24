<script lang="ts">
  import { data } from "../../lib/data.svelte";
  import AllVideos from "./views/AllVideos.svelte";
  import History from "./views/History.svelte";
  import Review from "./views/Review.svelte";
  import Settings from "./views/Settings.svelte";
  import Today from "./views/Today.svelte";

  const VIEWS = [
    { id: "today", label: "Today", key: "1" },
    { id: "videos", label: "All videos", key: "2" },
    { id: "review", label: "Review", key: "3" },
    { id: "history", label: "History", key: "4" },
  ] as const;
  type ViewId = (typeof VIEWS)[number]["id"];

  const fromHash = (): ViewId => {
    const id = location.hash.slice(1);
    return VIEWS.some((v) => v.id === id) ? (id as ViewId) : "today";
  };

  let view = $state<ViewId>(fromHash());
  let settingsOpen = $state(false);

  function go(id: ViewId) {
    view = id;
    history.replaceState(null, "", `#${id}`);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
    const match = VIEWS.find((v) => v.key === event.key);
    if (match) {
      event.preventDefault();
      go(match.id);
    }
  }

  $effect(() => {
    void data.start();
    const onHash = () => (view = fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });

  const dueCount = $derived(data.sentences.filter((s) => s.step < 5 && s.dueAt <= Date.now()).length);
</script>

<svelte:window {onkeydown} />

<div class="shell">
  <header>
    <span class="brand">Language Immersion Tracker</span>
    <nav aria-label="Views">
      {#each VIEWS as item (item.id)}
        <a
          href="#{item.id}"
          aria-current={view === item.id ? "page" : undefined}
          aria-keyshortcuts={item.key}
          onclick={(event) => {
            event.preventDefault();
            go(item.id);
          }}
        >
          {item.label}{#if item.id === "review" && dueCount > 0}<span class="badge" aria-label="{dueCount} due">{dueCount}</span>{/if}
        </a>
      {/each}
    </nav>
    <button class="settings" type="button" onclick={() => (settingsOpen = true)} aria-label="Settings">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.9a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
    </button>
  </header>

  <main>
    {#if view === "today"}
      <Today onnavigate={go} />
    {:else if view === "videos"}
      <AllVideos />
    {:else if view === "review"}
      <Review />
    {:else}
      <History onsettings={() => (settingsOpen = true)} />
    {/if}
  </main>
</div>

<Settings bind:open={settingsOpen} />

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 16px clamp(16px, 3vw, 40px);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px);
  }

  .brand {
    margin-right: auto;
    font-weight: 800;
    font-size: 15px;
    white-space: nowrap;
  }

  nav {
    display: flex;
    gap: 2px;
  }

  nav a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 2.25rem;
    padding: 0 13px;
    border-radius: var(--pill);
    color: var(--dim);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
  }

  nav a:hover {
    color: var(--ink);
  }

  nav a[aria-current="page"] {
    background: var(--ink);
    color: var(--on-ink);
  }

  .badge {
    min-width: 1.25rem;
    padding: 0 5px;
    border-radius: var(--pill);
    background: var(--soft);
    color: var(--ink);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25rem;
    text-align: center;
  }

  [aria-current="page"] .badge {
    background: color-mix(in srgb, var(--on-ink) 22%, transparent);
    color: var(--on-ink);
  }

  .settings {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
  }

  .settings:hover {
    background: var(--soft);
    color: var(--ink);
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 720px) {
    .brand {
      display: none;
    }

    nav {
      margin-right: auto;
    }
  }
</style>
