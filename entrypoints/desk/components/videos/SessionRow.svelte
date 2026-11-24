<script lang="ts">
  import { duration } from "../../../../lib/format";
  import type { Session } from "../../../../lib/types";
  import MixBar from "./MixBar.svelte";
  import { mixOf } from "./mix";

  let {
    session,
    onopen,
    ondelete,
  }: {
    session: Session;
    onopen: () => void;
    ondelete: () => void;
  } = $props();

  let armed = $state(false);

  // The second click has to land soon after the first, so a stray click can't delete.
  $effect(() => {
    if (!armed) return;
    const timer = setTimeout(() => (armed = false), 3000);
    return () => clearTimeout(timer);
  });

  const seconds = $derived(session.videos.reduce((sum, video) => sum + video.duration, 0));
  const parts = $derived(mixOf(session.videos.map((video) => ({ lang: video.lang, seconds: video.duration }))));
  const count = $derived(session.videos.length);
  const saved = $derived(new Date(session.savedAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }));

  function remove() {
    if (!armed) {
      armed = true;
      return;
    }
    armed = false;
    ondelete();
  }
</script>

<li class="row">
  <div class="main">
    <p class="name">{session.name}</p>
    <p class="meta">Saved {saved} · {count} {count === 1 ? "video" : "videos"} · {duration(seconds)}</p>
    <MixBar {parts} height={6} />
  </div>
  <div class="actions">
    <button class="btn small" type="button" onclick={onopen}>Open</button>
    <button class="btn small ghost" type="button" onclick={remove}>{armed ? "Delete?" : "Delete"}</button>
  </div>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 14px 16px;
    border-top: 1px solid var(--line);
  }

  .row:first-child {
    border-top: 0;
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .name {
    margin: 0;
    overflow: hidden;
    font-size: 15px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    margin: 0;
    color: var(--dim);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  @media (max-width: 520px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
