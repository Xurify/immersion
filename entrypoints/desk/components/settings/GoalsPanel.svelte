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

  const isWeekly = (lang: string) => data.goalPeriods[lang] === "week";
  const stepFor = (lang: string) => (isWeekly(lang) ? STEP * 3 : STEP);
  const maxFor = (lang: string) => (isWeekly(lang) ? MAX_MINUTES * 7 : MAX_MINUTES);
  const clampFor = (lang: string, minutes: number) => Math.min(maxFor(lang), Math.max(MIN_MINUTES, Math.round(minutes)));

  /** Switching keeps the same pace: 20 min a day becomes 140 a week, rounded to 5. */
  async function setPeriod(lang: string, period: "day" | "week") {
    if ((data.goalPeriods[lang] ?? "day") === period) return;
    const minutes = data.goals[lang] ?? DEFAULT_MINUTES;
    const converted = Math.max(MIN_MINUTES, Math.round((period === "week" ? minutes * 7 : minutes / 7) / 5) * 5);
    const periods = { ...data.goalPeriods, [lang]: period };
    if (period === "day") delete periods[lang];
    error = "";
    try {
      data.goalPeriods = periods;
      await save("goalPeriods", periods);
      await write({ ...data.goals, [lang]: converted });
    } catch {
      error = "Could not save goals. Try again.";
    }
  }

  /** Hours listened before tracking began, added to all-time totals and milestones. */
  async function setBaseline(lang: string, input: HTMLInputElement) {
    const hours = Number(input.value);
    if (input.value.trim() !== "" && (!Number.isFinite(hours) || hours < 0)) {
      input.value = String(Math.round((data.baseline[lang] ?? 0) / 360) / 10);
      return;
    }
    const next = { ...data.baseline };
    if (!hours) delete next[lang];
    else next[lang] = Math.round(hours * 3600);
    error = "";
    try {
      data.baseline = next;
      await save("baseline", next);
    } catch {
      error = "Could not save. Try again.";
    }
  }

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
    void write({ ...data.goals, [lang]: clampFor(lang, minutes) });
  }

  function commitTyped(lang: string, input: HTMLInputElement) {
    const parsed = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = String(data.goals[lang] ?? DEFAULT_MINUTES);
      return;
    }
    const minutes = clampFor(lang, parsed);
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
    A goal is how many minutes to listen in one language, each day or each week. Time counts while a YouTube video plays in that language, plus anything you log by hand in History.
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
          <div class="amount">
            <div class="stepper" role="group" aria-label="Minutes a day for {englishName(lang)}">
              <button
                type="button"
                aria-label="Less time for {englishName(lang)}"
                disabled={minutes <= MIN_MINUTES}
                onclick={() => setMinutes(lang, minutes - stepFor(lang))}
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
                disabled={minutes >= maxFor(lang)}
                onclick={() => setMinutes(lang, minutes + stepFor(lang))}
              >
                +
              </button>
          </div>
          <div class="seg period" role="group" aria-label="Goal period for {englishName(lang)}">
            <button type="button" aria-pressed={!isWeekly(lang)} onclick={() => setPeriod(lang, "day")}>a day</button>
            <button type="button" aria-pressed={isWeekly(lang)} onclick={() => setPeriod(lang, "week")}>a week</button>
          </div>
          </div>
          <button type="button" class="remove" aria-label="Remove {englishName(lang)}" onclick={() => remove(lang)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if goalRows.length}
    <div class="before">
      <h4>Hours before tracking</h4>
      <p class="intro">Listening you did before installing this, counted toward all-time totals and hour milestones.</p>
      <ul class="before-rows">
        {#each goalRows as [lang] (lang)}
          <li>
            <i class="dot" style:background={langColor(lang)} aria-hidden="true"></i>
            <span class="name"><LangName {lang} /></span>
            <input
              class="input hours"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.5"
              placeholder="0"
              value={data.baseline[lang] ? Math.round(data.baseline[lang] / 360) / 10 : ""}
              aria-label="Hours of {englishName(lang)} before tracking"
              onchange={(event) => setBaseline(lang, event.currentTarget)}
            />
            <span class="dim">hours</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="add">
    <label for="goal-language">Add a language</label>
    <LanguagePicker id="goal-language" exclude={goalLangs} suggested={suggested} onpick={pickLanguage} />
    <p class="dim hint">Picking a language adds it at {DEFAULT_MINUTES} min a day. A weekly goal spreads what is left of the week over the days remaining.</p>
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
    grid-template-columns: 10px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
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

  .amount {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--pill);
    background: var(--soft);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .stepper button {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
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
    background: var(--raised);
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

  .period button {
    min-height: 1.875rem;
    padding: 0 10px;
    font-size: 12.5px;
  }

  .before {
    margin: 0 0 28px;
  }

  .before h4 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 700;
  }

  .before .intro {
    margin-bottom: 12px;
    font-size: 14px;
  }

  .before-rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px 20px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .before-rows li {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .before-rows .name {
    flex: 1;
    min-width: 0;
    font-size: 17px;
  }

  .hours {
    width: 84px;
    min-height: 2.25rem;
    padding: 0 12px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }


  .remove {
    min-height: 2.25rem;
    margin-right: -0.75rem;
    padding: 0 0.75rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    font-size: 14px;
    font-weight: 600;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .remove:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }

  .add {
    margin-top: 8px;
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

    .amount {
      grid-column: 2 / -1;
      grid-row: 2;
    }

    .remove {
      grid-column: 3;
      grid-row: 1;
    }
  }
</style>
