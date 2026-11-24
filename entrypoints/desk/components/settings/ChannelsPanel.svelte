<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { send } from "../../../../lib/messages";
  import { langColor } from "../../../../lib/colors.svelte";
  import LangName from "../../../../ui/LangName.svelte";

  let busy = $state(false);
  let message = $state("");

  const follows = $derived(Object.values(data.follows).sort((a, b) => a.name.localeCompare(b.name)));

  function checked(at: number | null): string {
    if (at === null) return "Not checked yet";
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 1) return "Checked just now";
    if (minutes < 60) return `Checked ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `Checked ${hours} h ago` : `Checked ${Math.round(hours / 24)} d ago`;
  }

  async function checkNow() {
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

  async function unfollow(channelId: string) {
    message = "";
    try {
      await send("channels:unfollow", { channelId });
    } catch {
      message = "Could not unfollow. Try again.";
    }
  }
</script>

<div class="panel">
  <h3>Channels</h3>
  <p class="intro">
    New uploads from channels you follow land in Inbox, checked every 6 hours. Follow a channel from the popup while its video is open, or from a board card's menu.
  </p>

  {#if follows.length === 0}
    <p class="empty">You're not following any channels yet.</p>
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
          <a class="open" href="https://www.youtube.com/channel/{follow.channelId}/videos" target="_blank" rel="noreferrer">Open</a>
          <button type="button" class="unfollow" onclick={() => unfollow(follow.channelId)}>Unfollow</button>
        </li>
      {/each}
    </ul>
    <button type="button" class="btn small ghost" disabled={busy} onclick={checkNow}>{busy ? "Checking…" : "Check now"}</button>
  {/if}

  {#if message}<p class="status" role="status">{message}</p>{/if}
</div>

<style>
  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .intro,
  .empty {
    margin: 0 0 18px;
    max-width: 38em;
    color: var(--ink-2);
    font-size: 15px;
    line-height: 1.45;
  }

  .rows {
    margin: 0 0 18px;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  .rows li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 3.5rem;
    border-bottom: 1px solid var(--line);
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
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    color: var(--dim);
    font-size: 13px;
  }

  .meta :global(.native) {
    color: var(--ink-2);
    font-size: 14px;
  }

  .open,
  .unfollow {
    min-height: 2.25rem;
    padding: 0 12px;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    font-size: 13px;
    font-weight: 600;
    line-height: 2.25rem;
    text-decoration: none;
  }

  .open:hover {
    background: var(--soft);
    color: var(--ink);
  }

  .unfollow {
    margin-right: -12px;
  }

  .unfollow:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }

  .status {
    margin: 14px 0 0;
    color: var(--ink-2);
    font-size: 14px;
    font-weight: 600;
  }
</style>
