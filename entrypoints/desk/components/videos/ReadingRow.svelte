<script lang="ts">
  import { thumbnail } from "../../../../lib/format";
  import type { ReadingItem } from "../../../../lib/types";

  let {
    item,
    onopen,
    onremove,
  }: {
    item: ReadingItem;
    onopen: () => void;
    onremove: () => void;
  } = $props();
</script>

<li class="row">
  <span class="thumb">
    {#if item.videoId}
      <img
        src={thumbnail(item.videoId)}
        alt=""
        loading="lazy"
        onerror={(event) => {
          (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    {/if}
  </span>
  <p class="title">{item.title}</p>
  <div class="actions">
    <button class="btn small" type="button" onclick={onopen}>Open</button>
    <button class="btn small ghost" type="button" onclick={onremove}>Remove</button>
  </div>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }

  .row:first-child {
    border-top: 0;
  }

  .thumb {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 6px;
    background: var(--soft);
  }

  .thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .title {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.25;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  @media (max-width: 520px) {
    .row {
      grid-template-columns: 88px minmax(0, 1fr);
    }

    .actions {
      grid-column: 1 / -1;
    }
  }
</style>
