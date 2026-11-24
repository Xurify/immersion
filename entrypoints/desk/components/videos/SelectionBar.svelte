<script lang="ts">
  import { duration } from "../../../../lib/format";

  let {
    count,
    seconds,
    onsave,
    onclose,
    onstart,
  }: {
    count: number;
    seconds: number;
    onsave: (name: string) => Promise<void>;
    onclose: () => void;
    onstart: () => void;
  } = $props();

  let naming = $state(false);
  let name = $state("");
  let busy = $state(false);
  let input = $state<HTMLInputElement>();

  $effect(() => {
    if (naming) input?.focus();
  });

  function cancel() {
    naming = false;
    name = "";
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    await onsave(name.trim());
    busy = false;
    cancel();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") cancel();
  }
</script>

<div class="bar" role="region" aria-label="Selected videos">
  {#if naming}
    <form class="naming" onsubmit={submit}>
      <input
        bind:this={input}
        bind:value={name}
        class="name-input"
        placeholder="Name this session"
        aria-label="Session name"
        {onkeydown}
      />
      <button class="btn light small" type="submit" disabled={busy}>Save session</button>
      <button class="btn ghost small" type="button" onclick={cancel}>Cancel</button>
    </form>
  {:else}
    <span class="count">{count} selected · {duration(seconds)}</span>
    <button class="btn ghost small" type="button" onclick={() => (naming = true)}>Save</button>
    <button class="btn ghost small" type="button" onclick={onclose}>Close tabs</button>
    <button class="btn light small" type="button" onclick={onstart}>Start →</button>
  {/if}
</div>

<style>
  .bar {
    position: fixed;
    bottom: 22px;
    left: 50%;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
    max-width: calc(100vw - 32px);
    padding: 8px 8px 8px 20px;
    transform: translateX(-50%);
    border-radius: 24px;
    background: var(--ink);
    color: var(--on-ink);
    font-weight: 600;
    box-shadow: 0 14px 30px var(--shadow);
  }

  .count {
    margin-right: auto;
    white-space: nowrap;
  }

  .naming {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .name-input {
    min-width: min(16rem, 60vw);
    min-height: 2.25rem;
    padding: 0 14px;
    border: 0;
    border-radius: var(--pill);
    background: var(--bg);
    color: var(--ink);
    font-size: 15px;
  }
</style>
