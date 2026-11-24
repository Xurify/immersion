<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { dateKey } from "../../../../lib/format";

  const KNOWN_KEYS = ["goals", "log", "sentences", "sessions", "meta", "overrides"] as const;
  type Known = (typeof KNOWN_KEYS)[number];

  let message = $state("");
  let busy = $state(false);
  let confirmingClear = $state(false);

  const isPlainObject = (value: unknown): boolean => typeof value === "object" && value !== null && !Array.isArray(value);

  function isValid(key: Known, value: unknown): boolean {
    return key === "sentences" || key === "sessions" ? Array.isArray(value) : isPlainObject(value);
  }

  async function exportData() {
    busy = true;
    message = "";
    try {
      const everything = await browser.storage.local.get(null);
      const url = URL.createObjectURL(new Blob([JSON.stringify(everything, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `language-immersion-tracker-${dateKey()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message = "Export saved to your downloads.";
    } catch {
      message = "Export failed. Try again.";
    } finally {
      busy = false;
    }
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    busy = true;
    message = "";
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isPlainObject(parsed)) throw new Error("Not an object");
      const record = parsed as Record<string, unknown>;

      const values: Partial<Record<Known, unknown>> = {};
      const found: Known[] = [];
      for (const key of KNOWN_KEYS) {
        if (key in record && isValid(key, record[key])) {
          values[key] = record[key];
          found.push(key);
        }
      }
      if (found.length === 0) {
        message = "This file has no tracker data in it. Nothing was changed.";
        return;
      }

      await browser.storage.local.set(values);
      const skipped = Object.keys(record).filter((key) => !found.includes(key as Known)).length;
      message = `Imported ${found.join(", ")}.${skipped ? ` Skipped ${skipped} other ${skipped === 1 ? "entry" : "entries"}.` : ""}`;
    } catch {
      message = "That file is not a valid backup. Nothing was changed.";
    } finally {
      busy = false;
    }
  }

  async function clearLog() {
    busy = true;
    message = "";
    try {
      await browser.storage.local.remove("log");
      data.log = {};
      message = "Listening history cleared. Goals and sentences are unchanged.";
    } catch {
      message = "Could not clear the history. Try again.";
    } finally {
      busy = false;
      confirmingClear = false;
    }
  }
</script>

<div class="panel">
  <h3>Data</h3>
  <p class="intro">Everything is stored in this browser only. Export saves a copy as one JSON file.</p>

  <div class="block">
    <h4>Backup</h4>
    <p class="intro">
      Export includes goals, listening history, sentences, sessions and video overrides. Import reads a file made by Export and replaces the sections it contains. Sections missing from the file stay as they are.
    </p>
    <div class="actions">
      <button type="button" class="btn small" disabled={busy} onclick={exportData}>Export</button>
      <label class="import">
        <span>Import a backup file</span>
        <input type="file" accept="application/json,.json" disabled={busy} onchange={importFile} />
      </label>
    </div>
  </div>

  <div class="block">
    <h4>Listening history</h4>
    <p class="intro">Removes the time counted for every language on every day. Goals and sentences stay.</p>
    {#if confirmingClear}
      <div class="actions">
        <button type="button" class="btn small danger" disabled={busy} onclick={clearLog}>Yes, clear all listening time</button>
        <button type="button" class="btn small ghost" onclick={() => (confirmingClear = false)}>Cancel</button>
      </div>
    {:else}
      <button type="button" class="btn small ghost" onclick={() => (confirmingClear = true)}>Clear listening history</button>
    {/if}
  </div>

  {#if message}
    <p class="status" role="status">{message}</p>
  {/if}
</div>

<style>
  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  h4 {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 700;
  }

  .intro {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink-2);
    max-width: 40em;
  }

  .block {
    padding: 18px 0;
    border-bottom: 1px solid var(--line);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .import {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
  }

  .import input {
    font-size: 14px;
    font-weight: 400;
  }

  .btn.danger {
    background: var(--danger);
    color: var(--on-ink);
  }

  .status {
    margin: 16px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-2);
  }
</style>
