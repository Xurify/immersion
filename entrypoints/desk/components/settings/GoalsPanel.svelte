<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { COMMON_LANGS, englishName, langColor, nativeName } from "../../../../lib/languages";
  import { save } from "../../../../lib/storage";
  import type { Goals } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";

  const DEFAULT_MINUTES = 20;

  let error = $state("");
  let pick = $state("");

  const goalRows = $derived(Object.entries(data.goals));
  const choices = $derived(COMMON_LANGS.filter((lang) => !(lang in data.goals)));
  const selected = $derived(choices.includes(pick) ? pick : (choices[0] ?? ""));

  async function write(next: Goals) {
    error = "";
    try {
      data.goals = next;
      await save("goals", next);
    } catch {
      error = "Could not save goals. Try again.";
    }
  }

  function setMinutes(lang: string, input: HTMLInputElement) {
    const parsed = Math.round(Number(input.value));
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = String(data.goals[lang] ?? DEFAULT_MINUTES);
      return;
    }
    const minutes = Math.min(600, Math.max(1, parsed));
    input.value = String(minutes);
    void write({ ...data.goals, [lang]: minutes });
  }

  function remove(lang: string) {
    void write(Object.fromEntries(goalRows.filter(([key]) => key !== lang)));
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    if (!selected) return;
    void write({ ...data.goals, [selected]: DEFAULT_MINUTES });
    pick = "";
  }
</script>

<div class="panel">
  <h3>Goals</h3>
  <p class="intro">
    A goal is how many minutes to listen each day in one language. Time counts only while a YouTube video plays in that language.
  </p>

  {#if goalRows.length === 0}
    <p class="empty">No goals yet. Add a language below to start tracking one.</p>
  {:else}
    <ul class="rows">
      {#each goalRows as [lang, minutes] (lang)}
        <li class="row">
          <i class="dot" style:background={langColor(lang)} aria-hidden="true"></i>
          <span class="name">
            <LangName {lang} />
            <span class="dim">{englishName(lang)}</span>
          </span>
          <span class="minutes">
            <input
              type="number"
              min="1"
              max="600"
              step="5"
              value={minutes}
              aria-label={`Minutes a day for ${englishName(lang)}`}
              onchange={(event) => setMinutes(lang, event.currentTarget)}
            />
            <span class="dim">min a day</span>
          </span>
          <button type="button" class="remove" aria-label={`Remove ${englishName(lang)}`} onclick={() => remove(lang)}>
            Remove
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <form class="add" onsubmit={add}>
    <label for="goal-language">Add a language</label>
    <div class="add-row">
      <select id="goal-language" value={selected} disabled={choices.length === 0} onchange={(event) => (pick = event.currentTarget.value)}>
        {#each choices as lang (lang)}
          <option value={lang}>{nativeName(lang)} ({englishName(lang)})</option>
        {/each}
      </select>
      <button type="submit" class="btn small" disabled={!selected}>Add</button>
    </div>
    <p class="dim hint">New goals start at {DEFAULT_MINUTES} min a day.</p>
  </form>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
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
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink-2);
    max-width: 38em;
  }

  .rows {
    margin: 0 0 22px;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  .row {
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }

  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
    min-width: 0;
    font-size: 20px;
  }

  .name .dim {
    font-size: 14px;
  }

  .minutes {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .minutes input {
    width: 5.5rem;
    min-height: 2.25rem;
    padding: 0 0.6rem;
    border: 1.5px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--bg);
    font-variant-numeric: tabular-nums;
  }

  .minutes input:focus-visible {
    outline: none;
    border-color: var(--ink);
  }

  .remove {
    min-height: 2.25rem;
    padding: 0 0.9rem;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: transparent;
    font-size: 14px;
    font-weight: 600;
  }

  .add label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .add-row {
    display: flex;
    gap: 8px;
  }

  .add select {
    flex: 1;
    min-width: 0;
    min-height: 2.5rem;
    padding: 0 0.8rem;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: var(--bg);
    font-size: 15px;
  }

  .hint {
    margin: 8px 0 0;
    font-size: 13px;
  }

  .error {
    margin: 12px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--danger);
  }
</style>
