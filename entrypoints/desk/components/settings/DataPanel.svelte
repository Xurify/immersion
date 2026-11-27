<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { dateKey } from "../../../../lib/format";
  import { send } from "../../../../lib/messages";
  import { ankiTsv, clozemasterCsv } from "../../../../lib/export";
  import { englishName } from "../../../../lib/languages";

  const KNOWN_KEYS = [
    "goals",
    "log",
    "sentences",
    "sessions",
    "meta",
    "overrides",
    "watched",
    "board",
    "logBackground",
    "manual",
    "baseline",
    "goalPeriods",
    "follows",
  ] as const;
  type Known = (typeof KNOWN_KEYS)[number];

  let message = $state("");
  let busy = $state(false);
  let confirmingClear = $state(false);

  const sentenceLangs = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const sentence of data.sentences) counts.set(sentence.lang, (counts.get(sentence.lang) ?? 0) + 1);
    return [...counts].sort((first, second) => second[1] - first[1]);
  });

  let exportLang = $state("");
  $effect(() => {
    if (!sentenceLangs.some(([lang]) => lang === exportLang)) exportLang = sentenceLangs[0]?.[0] ?? "";
  });
  const chosenLang = $derived(exportLang);

  function download(text: string, name: string, type: string): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportSentences(target: "anki" | "clozemaster"): void {
    message = "";
    const chosen = data.sentences.filter((sentence) => sentence.lang === chosenLang);
    const name = `${englishName(chosenLang).toLowerCase().replace(/\W+/g, "-")}-sentences-${dateKey()}`;
    if (target === "anki") {
      download(ankiTsv(chosen), `${name}.txt`, "text/tab-separated-values");
      message = `Exported ${chosen.length} ${chosen.length === 1 ? "sentence" : "sentences"} for Anki. In Anki, choose File > Import and pick the file.`;
      return;
    }
    const { csv, skipped } = clozemasterCsv(chosen);
    if (!csv) {
      message = "None of these sentences has a translation yet, and Clozemaster needs one. Add translations in Review first.";
      return;
    }
    download(csv, `${name}.csv`, "text/csv");
    const count = chosen.length - skipped;
    message = `Exported ${count} ${count === 1 ? "sentence" : "sentences"} for Clozemaster${skipped ? `; ${skipped} without a translation were left out` : ""}. In a custom collection, choose Add Sentences > Upload file.`;
  }

  const missing = $derived(data.tabs.filter((video) => video.duration <= 0).length);

  async function handleRetryDetails(): Promise<void> {
    busy = true;
    message = "";
    try {
      const { queued } = await send("meta:retry", {});
      message = queued ? `Looking up ${queued} ${queued === 1 ? "video" : "videos"} again. This can take a minute.` : "Every video already has its details.";
    } catch {
      message = "Could not start the lookup. Try again.";
    } finally {
      busy = false;
    }
  }

  const isPlainObject = (value: unknown): boolean => typeof value === "object" && value !== null && !Array.isArray(value);

  function isValid(key: Known, value: unknown): boolean {
    return key === "sentences" || key === "sessions" || key === "manual" ? Array.isArray(value) : isPlainObject(value);
  }

  async function handleExportData(): Promise<void> {
    busy = true;
    message = "";
    try {
      const everything = await browser.storage.local.get(null);
      const url = URL.createObjectURL(new Blob([JSON.stringify(everything, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `immersion-${dateKey()}.json`;
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

  async function handleImportFile(event: Event): Promise<void> {
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

  async function handleClearLog(): Promise<void> {
    busy = true;
    message = "";
    try {
      await browser.storage.local.remove(["log", "watched", "logBackground", "manual"]);
      data.youtubeLog = {};
      data.logBackground = {};
      data.manual = [];
      data.watched = {};
      message = "Listening history cleared, including time logged by hand. Goals and sentences are unchanged.";
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
  <p class="intro">Everything stays local in this browser. Export creates a single JSON backup file.</p>

  <div class="block">
    <h4>Backup</h4>
    <p class="sub">
      Includes goals, listening history, board cards, sentences, sessions, and language overrides. Import replaces only the sections present in the file.
    </p>
    <div class="actions">
      <button type="button" class="btn small" disabled={busy} onclick={handleExportData}>Export backup</button>
      <label class={["btn small soft import", busy && "disabled"]}>
        Import backup…
        <input class="sr-only" type="file" accept="application/json,.json" disabled={busy} onchange={handleImportFile} />
      </label>
    </div>
  </div>

  <div class="block">
    <h4>Export sentences</h4>
    {#if sentenceLangs.length === 0}
      <p class="sub">Sentences saved on YouTube with S can be exported here for Anki or Clozemaster.</p>
    {:else}
      <p class="sub">
        One language per file. Anki exports sentence, translation, source, and timestamp link. Clozemaster exports sentence and translation.
      </p>
      <div class="actions">
        <select class="input lang-select" bind:value={exportLang} aria-label="Language to export">
          {#each sentenceLangs as [lang, count] (lang)}
            <option value={lang}>{englishName(lang)} · {count}</option>
          {/each}
        </select>
        <button type="button" class="btn small soft" onclick={() => handleExportSentences("anki")}>For Anki</button>
        <button type="button" class="btn small soft" onclick={() => handleExportSentences("clozemaster")}>For Clozemaster</button>
      </div>
    {/if}
  </div>

  <div class="block">
    <h4>Video details</h4>
    <p class="sub">
      {missing
        ? `${missing} open ${missing === 1 ? "tab is" : "tabs are"} missing a length or language.`
        : "Every open tab has its length and language."}
      Sleeping tabs are fetched in the background without reloading them.
    </p>
    <button type="button" class="btn small soft" disabled={busy} onclick={handleRetryDetails}>Look them up again</button>
  </div>

  <div class="block danger-zone">
    <h4>Listening history</h4>
    <p class="sub">Removes all logged listening time across every language, including manual entries. Goals, baseline hours, and sentences stay.</p>
    {#if confirmingClear}
      <div class="actions">
        <button type="button" class="btn small danger" disabled={busy} onclick={handleClearLog}>Yes, clear all listening time</button>
        <button type="button" class="btn small soft" onclick={() => (confirmingClear = false)}>Cancel</button>
      </div>
    {:else}
      <button type="button" class="btn small clear" onclick={() => (confirmingClear = true)}>Clear listening history</button>
    {/if}
  </div>

  {#if message}
    <p class="status" role="status">{message}</p>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .intro {
    margin: -6px 0 2px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-2);
  }

  .block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 16px;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .danger-zone {
    background: light-dark(var(--bg), color-mix(in srgb, var(--danger) 6%, var(--bg)));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 30%, var(--line));
  }

  h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
  }

  .sub {
    margin: -4px 0 2px;
    font-size: 13.5px;
    line-height: 1.45;
    color: var(--ink-2);
    max-width: 44em;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .import {
    cursor: pointer;
  }

  .import:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .import.disabled {
    opacity: 0.4;
    cursor: default;
  }

  .lang-select {
    min-height: 2.25rem;
    padding-inline-end: 2rem;
    background: var(--raised);
  }

  .clear {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 40%, transparent);
  }

  .clear:hover {
    background: var(--danger);
    color: #fff;
  }

  .btn.danger {
    background: var(--danger);
    color: #fff;
  }

  .status {
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--soft);
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink);
  }
</style>
