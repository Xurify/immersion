<script lang="ts">
  import { data } from "../../lib/data.svelte";
  import AllVideos from "./views/AllVideos.svelte";
  import Board from "./views/Board.svelte";
  import History from "./views/History.svelte";
  import Review from "./views/Review.svelte";
  import Settings from "./views/Settings.svelte";

  const VIEWS = [
    { id: "board", label: "Board", key: "1" },
    { id: "videos", label: "All videos", key: "2" },
    { id: "review", label: "Review", key: "3" },
    { id: "history", label: "History", key: "4" },
  ] as const;
  type ViewId = (typeof VIEWS)[number]["id"];

  // The Today view became the Board; old links and desk:open("today") still land on it.
  const fromHash = (): ViewId => {
    const id = location.hash.slice(1);
    if (id === "today") return "board";
    return VIEWS.some((v) => v.id === id) ? (id as ViewId) : "board";
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
    <span class="brand">
      <svg class="mark" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <rect x="2" y="9" width="4" height="6" rx="2" fill="currentColor" opacity="0.45" />
        <rect x="8" y="4" width="4" height="16" rx="2" fill="currentColor" />
        <rect x="14" y="7" width="4" height="10" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
      <span class="brand-name">Immersion</span>
    </span>
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
    {#if view === "board"}
      <Board onnavigate={go} onsettings={() => (settingsOpen = true)} />
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
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    height: 64px;
    padding: 0 var(--gutter);
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(12px) saturate(1.4);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--line) 70%, transparent);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .mark {
    flex: none;
  }

  .brand-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  nav {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 11px;
    background: var(--soft);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  nav a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 2rem;
    padding: 0 13px;
    border-radius: 8px;
    color: var(--dim);
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  nav a:hover {
    color: var(--ink);
  }

  nav a[aria-current="page"] {
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--line), 0 1px 2px var(--shadow);
  }

  .badge {
    min-width: 1.25rem;
    padding: 0 6px;
    border-radius: var(--pill);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.25rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .settings {
    justify-self: end;
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border: 0;
    border-radius: 9px;
    background: light-dark(var(--raised), var(--soft));
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--ink-2);
    transition: color 0.15s ease, background-color 0.15s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .settings:hover {
    background: var(--ink);
    color: var(--on-ink);
  }

  .settings:active {
    transform: scale(0.96);
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 720px) {
    header {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }

    .brand {
      display: none;
    }

    nav {
      justify-self: start;
      max-width: 100%;
      overflow-x: auto;
    }
  }

  @media (max-width: 440px) {
    nav a {
      padding: 0 9px;
      font-size: 13px;
    }
  }
</style>
