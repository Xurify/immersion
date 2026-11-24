<script lang="ts">
  import AppearancePanel from "../components/settings/AppearancePanel.svelte";
  import DataPanel from "../components/settings/DataPanel.svelte";
  import GoalsPanel from "../components/settings/GoalsPanel.svelte";
  import KeyboardPanel from "../components/settings/KeyboardPanel.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  type Section = "goals" | "appearance" | "keyboard" | "data";
  const SECTIONS: { id: Section; label: string }[] = [
    { id: "goals", label: "Goals" },
    { id: "appearance", label: "Appearance" },
    { id: "keyboard", label: "Keyboard" },
    { id: "data", label: "Data" },
  ];

  let section = $state<Section>("goals");
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });

  // The dialog covers the whole viewport, so a click on the element itself is a click on the backdrop.
  $effect(() => {
    const el = dialog;
    if (!el) return;
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === el) open = false;
    };
    el.addEventListener("click", onBackdrop);
    return () => el.removeEventListener("click", onBackdrop);
  });
</script>

<dialog bind:this={dialog} class="settings" aria-labelledby="settings-title" onclose={() => (open = false)}>
  <div class="sheet">
    <header>
      <h2 id="settings-title">Settings</h2>
      <button type="button" class="close" aria-label="Close settings" onclick={() => dialog?.close()}>×</button>
    </header>
    <div class="body">
      <nav aria-label="Settings sections">
        {#each SECTIONS as item (item.id)}
          <button type="button" aria-current={section === item.id ? "true" : undefined} onclick={() => (section = item.id)}>
            {item.label}
          </button>
        {/each}
      </nav>
      <div class="content">
        {#if section === "goals"}
          <GoalsPanel />
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
    width: min(780px, calc(100vw - 32px));
    height: min(640px, calc(100dvh - 48px));
    padding: 0;
    border: 0;
    border-radius: var(--r-lg);
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--line-2), 0 30px 80px var(--shadow);
    overflow: hidden;
  }

  .settings::backdrop {
    background: rgb(20 19 16 / 0.45);
  }

  .sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 20px 14px 28px;
    border-bottom: 1px solid var(--line);
  }

  h2 {
    margin: 0;
    margin-right: auto;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .close {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    font-size: 24px;
    line-height: 1;
  }

  .close:hover {
    background: var(--soft);
    color: var(--ink);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 170px minmax(0, 1fr);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
    border-right: 1px solid var(--line);
  }

  nav button {
    padding: 9px 12px;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--dim);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }

  nav button:hover {
    color: var(--ink);
  }

  nav button[aria-current="true"] {
    background: var(--soft);
    color: var(--ink);
  }

  .content {
    min-width: 0;
    overflow: auto;
    padding: 24px 28px 28px;
  }

  @media (max-width: 640px) {
    .body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }

    nav {
      flex-direction: row;
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }

    nav button {
      white-space: nowrap;
    }
  }
</style>
