<script lang="ts">
  import AppearancePanel from "../components/settings/AppearancePanel.svelte";
  import ChannelsPanel from "../components/settings/ChannelsPanel.svelte";
  import DataPanel from "../components/settings/DataPanel.svelte";
  import GoalsPanel from "../components/settings/GoalsPanel.svelte";
  import KeyboardPanel from "../components/settings/KeyboardPanel.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  type Section = "goals" | "channels" | "appearance" | "keyboard" | "data";

  const SECTIONS: { id: Section; label: string; icon: string }[] = [
    { id: "goals", label: "Goals", icon: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-4h.01" },
    { id: "channels", label: "Channels", icon: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" },
    { id: "appearance", label: "Appearance", icon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" },
    { id: "keyboard", label: "Keyboard", icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm4 3h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8" },
    { id: "data", label: "Data", icon: "M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3Zm0 0v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6m0 6c0 1.66 3.58 3 8 3s8-1.34 8-3" },
  ];

  let section = $state<Section>("goals");
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    const element = dialog;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  });

  $effect(() => {
    const element = dialog;
    if (!element) return;
    const handleBackdrop = (event: MouseEvent): void => {
      if (event.target === element) open = false;
    };
    element.addEventListener("click", handleBackdrop);
    return () => element.removeEventListener("click", handleBackdrop);
  });
</script>

<dialog bind:this={dialog} class="settings" aria-labelledby="settings-title" onclose={() => (open = false)}>
  <div class="sheet">
    <header>
      <h2 id="settings-title">Settings</h2>
      <button type="button" class="close" aria-label="Close settings" onclick={() => dialog?.close()}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </header>
    <div class="body">
      <nav aria-label="Settings sections">
        {#each SECTIONS as item (item.id)}
          <button type="button" aria-current={section === item.id ? "true" : undefined} onclick={() => (section = item.id)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d={item.icon} fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{item.label}</span>
          </button>
        {/each}
      </nav>
      <div class="content">
        {#if section === "goals"}
          <GoalsPanel />
        {:else if section === "channels"}
          <ChannelsPanel />
        {:else if section === "appearance"}
          <AppearancePanel />
        {:else if section === "keyboard"}
          <KeyboardPanel />
        {:else}
          <DataPanel />
        {/if}
      </div>
    </div>
  </div>
</dialog>

<style>
  .settings {
    width: min(820px, calc(100vw - 32px));
    height: min(650px, calc(100dvh - 48px));
    padding: 0;
    border: 0;
    border-radius: 16px;
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--line-2), 0 24px 64px var(--shadow);
    overflow: hidden;
  }

  .settings::backdrop {
    background: light-dark(rgb(22 21 19 / 0.28), rgb(0 0 0 / 0.6));
    backdrop-filter: blur(4px);
  }

  .sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 15px 18px 15px 22px;
    border-bottom: 1px solid var(--line);
    background: var(--raised);
  }

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .close {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--dim);
    transition: background-color 0.14s ease, color 0.14s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .close:hover {
    background: var(--soft);
    color: var(--ink);
  }

  .close:active {
    transform: scale(0.96);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 188px minmax(0, 1fr);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 10px;
    border-inline-end: 1px solid var(--line);
    background: var(--bg);
  }

  nav button {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 36px;
    padding: 0 11px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--dim);
    font-size: 13.5px;
    font-weight: 600;
    text-align: start;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  nav button:hover {
    background: var(--soft);
    color: var(--ink);
  }

  nav button[aria-current="true"] {
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--line);
  }

  .content {
    min-width: 0;
    overflow: auto;
    padding: 24px 28px 32px;
  }

  @media (max-width: 640px) {
    .body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }

    nav {
      flex-direction: row;
      overflow-x: auto;
      border-inline-end: 0;
      border-bottom: 1px solid var(--line);
    }

    nav button {
      white-space: nowrap;
    }

    .content {
      padding: 20px;
    }
  }
</style>
