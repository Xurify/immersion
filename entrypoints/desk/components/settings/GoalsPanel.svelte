<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { COMMON_LANGS, englishName } from "../../../../lib/languages";
  import { langColor } from "../../../../lib/colors.svelte";
  import { save } from "../../../../lib/storage";
  import type { Goals } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";
  import LanguagePicker from "../../../../ui/LanguagePicker.svelte";

  const DEFAULT_MINUTES = 20;
  const STEP = 5;
  const MIN_MINUTES = 5;
  const MAX_MINUTES = 600;

  let error = $state("");

  const goalRows = $derived(Object.entries(data.goals));
  const goalLangs = $derived(Object.keys(data.goals));
  const suggested = $derived(COMMON_LANGS.filter((lang) => !(lang in data.goals)));

  const clamp = (minutes: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));

  async function write(next: Goals) {
    error = "";
    try {
      data.goals = next;
      await save("goals", next);
    } catch {
      error = "Could not save goals. Try again.";
    }
  }

  function setMinutes(lang: string, minutes: number) {
    void write({ ...data.goals, [lang]: clamp(minutes) });
  }

  function commitTyped(lang: string, input: HTMLInputElement) {
    const parsed = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = String(data.goals[lang] ?? DEFAULT_MINUTES);
      return;
    }
    const minutes = clamp(parsed);
    input.value = String(minutes);
    setMinutes(lang, minutes);
  }

  function remove(lang: string) {
    void write(Object.fromEntries(goalRows.filter(([key]) => key !== lang)));
  }

  function pickLanguage(lang: string) {
    void write({ ...data.goals, [lang]: DEFAULT_MINUTES });
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
          <div class="stepper" role="group" aria-label="Minutes a day for {englishName(lang)}">
            <button
              type="button"
              aria-label="Less time for {englishName(lang)}"
              disabled={minutes <= MIN_MINUTES}
              onclick={() => setMinutes(lang, minutes - STEP)}
            >
              −
            </button>
            <input
              type="text"
              inputmode="numeric"
              value={minutes}
              aria-label="Minutes a day for {englishName(lang)}"
              onchange={(event) => commitTyped(lang, event.currentTarget)}
            />
            <button
              type="button"
              aria-label="More time for {englishName(lang)}"
              disabled={minutes >= MAX_MINUTES}
              onclick={() => setMinutes(lang, minutes + STEP)}
            >
              +
            </button>
          </div>
          <span class="dim unit">min a day</span>
          <button type="button" class="remove" aria-label="Remove {englishName(lang)}" onclick={() => remove(lang)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="add">
    <label for="goal-language">Add a language</label>
    <LanguagePicker id="goal-language" exclude={goalLangs} suggested={suggested} onpick={pickLanguage} />
    <p class="dim hint">Picking a language adds it at {DEFAULT_MINUTES} min a day.</p>
  </div>

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
    margin: 0 0 26px;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  .row {
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) auto auto auto;
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

  .stepper {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: var(--raised);
  }

  .stepper button {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    color: var(--ink);
  }

  .stepper button:hover:not(:disabled) {
    background: var(--soft);
  }

  .stepper button:disabled {
    color: var(--dim);
    opacity: 0.5;
    cursor: default;
  }

  .stepper input {
    width: 3.25rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .stepper input:focus-visible {
    outline: none;
    border-radius: var(--pill);
    box-shadow: 0 0 0 2px var(--focus);
  }

  .unit {
    font-size: 14px;
    white-space: nowrap;
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

  @media (max-width: 520px) {
    .row {
      grid-template-columns: 10px minmax(0, 1fr) auto;
    }

    .stepper {
      grid-column: 2;
      grid-row: 2;
      justify-self: start;
    }

    .unit {
      grid-column: 3;
      grid-row: 2;
    }

    .remove {
      grid-column: 3;
      grid-row: 1;
    }
  }
</style>
