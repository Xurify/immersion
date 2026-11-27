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

  const isWeekly = (lang: string): boolean => data.goalPeriods[lang] === "week";
  const stepFor = (lang: string): number => (isWeekly(lang) ? STEP * 3 : STEP);
  const maxFor = (lang: string): number => (isWeekly(lang) ? MAX_MINUTES * 7 : MAX_MINUTES);
  const clampFor = (lang: string, minutes: number): number => Math.min(maxFor(lang), Math.max(MIN_MINUTES, Math.round(minutes)));

  async function setPeriod(lang: string, period: "day" | "week"): Promise<void> {
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

  async function setBaseline(lang: string, input: HTMLInputElement): Promise<void> {
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

  async function write(next: Goals): Promise<void> {
    error = "";
    try {
      data.goals = next;
      await save("goals", next);
    } catch {
      error = "Could not save goals. Try again.";
    }
  }

  function setMinutes(lang: string, minutes: number): void {
    void write({ ...data.goals, [lang]: clampFor(lang, minutes) });
  }

  function commitTyped(lang: string, input: HTMLInputElement): void {
    const parsed = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = String(data.goals[lang] ?? DEFAULT_MINUTES);
      return;
    }
    const minutes = clampFor(lang, parsed);
    input.value = String(minutes);
    setMinutes(lang, minutes);
  }

  function remove(lang: string): void {
    void write(Object.fromEntries(goalRows.filter(([key]) => key !== lang)));
    if (data.goalPeriods[lang]) {
      const periods = { ...data.goalPeriods };
      delete periods[lang];
      data.goalPeriods = periods;
      void save("goalPeriods", periods);
    }
  }

  function pickLanguage(lang: string): void {
    void write({ ...data.goals, [lang]: DEFAULT_MINUTES });
  }
</script>

<div class="panel">
  <h3>Goals</h3>
  <p class="intro">
    Set how many minutes to listen in each language per day or per week. Time counts automatically on YouTube plus anything logged by hand in History.
  </p>

  {#if goalRows.length === 0}
    <p class="empty-card">No goals yet. Add a language below to start tracking daily immersion.</p>
  {:else}
    <ul class="rows">
      {#each goalRows as [lang, minutes] (lang)}
        <li class="row" style:--c={langColor(lang)}>
          <i class="dot" style:background={langColor(lang)} aria-hidden="true"></i>
          <span class="name">
            <LangName {lang} />
            <span class="dim">{englishName(lang)}</span>
          </span>
          <div class="amount">
            <div class="stepper" role="group" aria-label="Minutes for {englishName(lang)}">
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
                aria-label="Minutes for {englishName(lang)}"
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
          <button type="button" class="remove" aria-label="Remove {englishName(lang)}" onclick={() => remove(lang)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="card-section">
    <label for="goal-language">Add a language</label>
    <LanguagePicker id="goal-language" exclude={goalLangs} {suggested} onpick={pickLanguage} />
    <p class="dim hint">Starts at {DEFAULT_MINUTES} min a day. Weekly goals spread remaining minutes across the days left in the week.</p>
  </div>

  {#if goalRows.length}
    <div class="card-section">
      <h4>Hours before tracking</h4>
      <p class="sub-intro">Listening done before installing Immersion, counted toward all-time totals and hour milestones.</p>
      <ul class="before-rows">
        {#each goalRows as [lang] (lang)}
          <li style:--c={langColor(lang)}>
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
            <span class="dim unit-label">h</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .intro {
    margin: -8px 0 2px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-2);
    max-width: 42em;
  }

  .empty-card {
    margin: 0;
    padding: 18px;
    border-radius: 16px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--dim);
    font-size: 14px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .row {
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    padding: 10px 10px 10px 14px;
  }

  .row + .row {
    border-top: 1px solid var(--line);
  }

  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    min-width: 0;
    font-size: 19px;
  }

  .name .dim {
    font-size: 13px;
  }

  .amount {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--pill);
    background: var(--raised);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .stepper button {
    display: grid;
    place-items: center;
    width: 1.85rem;
    height: 1.85rem;
    padding: 0;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    color: var(--ink);
    transition: background-color 0.12s ease;
  }

  .stepper button:hover:not(:disabled) {
    background: var(--soft);
  }

  .stepper button:disabled {
    color: var(--dim);
    opacity: 0.45;
    cursor: default;
  }

  .stepper input {
    width: 3rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 15px;
    font-weight: 750;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .stepper input:focus-visible {
    outline: none;
    border-radius: var(--pill);
    box-shadow: 0 0 0 2px var(--focus);
  }

  .period {
    background: var(--raised);
  }

  .period button {
    min-height: 1.75rem;
    padding: 0 9px;
    font-size: 12px;
  }

  .remove {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--dim);
    transition: color 0.14s ease, background-color 0.14s ease;
  }

  .remove:hover {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }

  .card-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .card-section label,
  .card-section h4 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 750;
  }

  .sub-intro {
    margin: -4px 0 2px;
    color: var(--dim);
    font-size: 13px;
    line-height: 1.45;
  }

  .before-rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .before-rows li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--raised);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .before-rows .name {
    flex: 1;
    min-width: 0;
    font-size: 16px;
  }

  .hours {
    width: 68px;
    min-height: 1.95rem;
    padding: 0 10px;
    border-radius: 9px;
    background: var(--soft);
    font-size: 13.5px;
    font-weight: 650;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .unit-label {
    font-size: 12.5px;
    font-weight: 600;
  }

  .hint {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.4;
  }

  .error {
    margin: 0;
    font-size: 13.5px;
    font-weight: 650;
    color: var(--danger);
  }

  @media (max-width: 520px) {
    .row {
      grid-template-columns: 6px minmax(0, 1fr) auto;
    }

    .amount {
      grid-column: 2 / -1;
      grid-row: 2;
      flex-wrap: wrap;
    }

    .remove {
      grid-column: 3;
      grid-row: 1;
    }
  }
</style>
