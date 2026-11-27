<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { send } from "../../../../lib/messages";
  import { langColor } from "../../../../lib/colors.svelte";
  import LangName from "../../../../ui/LangName.svelte";

  let busy = $state(false);
  let message = $state("");

  const follows = $derived(Object.values(data.follows).sort((first, second) => first.name.localeCompare(second.name)));

  function checked(timestamp: number | null): string {
    if (timestamp === null) return "Not checked yet";
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "Checked just now";
    if (minutes < 60) return `Checked ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `Checked ${hours} h ago` : `Checked ${Math.round(hours / 24)} d ago`;
  }

  async function handleCheckNow(): Promise<void> {
    busy = true;
    message = "";
    try {
      const { added } = await send("channels:check", {});
      message = added ? `Added ${added} new ${added === 1 ? "upload" : "uploads"} to Inbox.` : "No new uploads.";
    } catch {
      message = "Could not check the channels. Try again.";
    } finally {
      busy = false;
    }
  }

  async function handleUnfollow(channelId: string): Promise<void> {
    message = "";
    try {
      await send("channels:unfollow", { channelId });
    } catch {
      message = "Could not unfollow. Try again.";
    }
  }
</script>

<div class="panel">
  <div class="panel-head">
    <div>
      <h3>Channels</h3>
      <p class="intro">
        New uploads from followed channels land in Inbox every 6 hours. Follow any channel from the popup or a board card's menu.
      </p>
    </div>
    {#if follows.length > 0}
      <button type="button" class="btn small soft" disabled={busy} onclick={handleCheckNow}>
        {busy ? "Checking…" : "Check now"}
      </button>
    {/if}
  </div>

  {#if follows.length === 0}
    <p class="empty-card">You're not following any channels yet.</p>
  {:else}
    <ul class="rows">
      {#each follows as follow (follow.channelId)}
        <li>
          <i class="dot" style:background={langColor(follow.lang)} aria-hidden="true"></i>
          <span class="who">
            <b>{follow.name}</b>
            <span class="meta">
              {#if follow.lang}<LangName lang={follow.lang} /> ·{/if}
              {checked(follow.checkedAt)}
            </span>
          </span>
          <a class="open" href="https://www.youtube.com/channel/{follow.channelId}/videos" target="_blank" rel="noreferrer">Open ↗</a>
          <button type="button" class="unfollow" onclick={() => handleUnfollow(follow.channelId)}>Unfollow</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if message}<p class="status" role="status">{message}</p>{/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .intro {
    margin: 0;
    max-width: 38em;
    color: var(--ink-2);
    font-size: 14px;
    line-height: 1.5;
  }

  .empty-card {
    margin: 0;
    padding: 16px;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--dim);
    font-size: 14px;
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: hidden;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .rows li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 3.6rem;
    padding: 8px 12px 8px 16px;
  }

  .rows li + li {
    border-top: 1px solid var(--line);
  }

  .who {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .who b {
    overflow: hidden;
    font-size: 14.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    color: var(--dim);
    font-size: 12.5px;
  }

  .meta :global(.native) {
    color: var(--ink-2);
    font-size: 13.5px;
  }

  .open,
  .unfollow {
    min-height: 2rem;
    padding: 0 11px;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    font-size: 12.5px;
    font-weight: 650;
    line-height: 2rem;
    text-decoration: none;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .open:hover {
    background: var(--soft);
    color: var(--ink);
  }

  .unfollow:hover {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }

  .status {
    margin: 0;
    color: var(--ink-2);
    font-size: 13.5px;
    font-weight: 600;
  }
</style>
