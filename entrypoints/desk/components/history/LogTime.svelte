<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { dateKey, lastDays, uid } from "../../../../lib/format";
  import { englishName } from "../../../../lib/languages";
  import { langColor } from "../../../../lib/colors.svelte";
  import { save } from "../../../../lib/storage";
  import type { ManualEntry } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";

  let { onclose }: { onclose: () => void } = $props();

  const SOURCES = ["Podcast", "Audiobook", "TV", "Tutor", "Other"];

  const goalLangs = $derived(Object.keys(data.goals));
  const days = lastDays(7).reverse();

  let lang = $state(Object.keys(data.goals)[0] ?? "");
  let minutes = $state(20);
  let day = $state(dateKey());
  let source = $state("Podcast");
  let error = $state("");
  let saving = $state(false);

  function dayLabel(key: string, index: number): string {
    if (index === 0) return "Today";
    if (index === 1) return "Yesterday";
    const [year, month, date] = key.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const amount = Math.round(Number(minutes));
    if (!lang || !Number.isFinite(amount) || amount < 1 || amount > 1440) {
      error = "Enter between 1 and 1440 minutes.";
      return;
    }
    saving = true;
    error = "";
    const entry: ManualEntry = { id: uid(), date: day, lang, seconds: amount * 60, source, addedAt: Date.now() };
    try {
      const next = [...data.manual, entry];
      data.manual = next;
      await save("manual", next);
      onclose();
    } catch {
      error = "Could not save. Try again.";
    } finally {
      saving = false;
    }
  }
</script>

<form class="surface log" onsubmit={submit} aria-labelledby="log-title">
  <header class="head">
    <h2 id="log-title">Log listening off YouTube</h2>
    <button type="button" class="close" aria-label="Close" onclick={onclose}>×</button>
  </header>

  {#if goalLangs.length === 0}
    <p class="note">Set a goal language first, then log time for it here.</p>
  {:else}
    <div class="fields">
      <fieldset class="field">
        <legend>Language</legend>
        <div class="langs">
          {#each goalLangs as code (code)}
            <label class="lang" class:on={lang === code} style:--c={langColor(code)}>
              <input class="sr-only" type="radio" name="log-lang" value={code} bind:group={lang} />
              <LangName lang={code} />
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="row">
        <label class="field">
          <span class="label">Minutes</span>
          <input class="input num" type="number" inputmode="numeric" min="1" max="1440" bind:value={minutes} />
        </label>
        <label class="field grow">
          <span class="label">Day</span>
          <select class="input" bind:value={day}>
            {#each days as key, index (key)}
              <option value={key}>{dayLabel(key, index)}</option>
            {/each}
          </select>
        </label>
      </div>

      <fieldset class="field">
        <legend>Source</legend>
        <div class="seg" role="group">
          {#each SOURCES as item (item)}
            <button type="button" aria-pressed={source === item} onclick={() => (source = item)}>{item}</button>
          {/each}
        </div>
      </fieldset>
    </div>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <footer class="actions">
      <button class="btn small" type="submit" disabled={saving}>Add {Math.max(0, Math.round(Number(minutes)) || 0)} min of {englishName(lang)}</button>
      <button class="btn small ghost" type="button" onclick={onclose}>Cancel</button>
    </footer>
  {/if}
</form>

<style>
  .log {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px 28px 28px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.01em;
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
    font-size: 22px;
  }

  .close:hover {
    background: var(--soft);
    color: var(--ink);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 640px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend,
  .label {
    padding: 0;
    margin-bottom: 8px;
    color: var(--dim);
    font-size: 13px;
    font-weight: 600;
  }

  .label {
    margin-bottom: 0;
  }

  .langs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .lang {
    display: inline-flex;
    align-items: center;
    min-height: 2.5rem;
    padding: 0 16px;
    border-radius: var(--pill);
    background: var(--soft);
    box-shadow: inset 0 0 0 1px var(--line);
    font-size: 17px;
    cursor: pointer;
    transition: background-color 0.15s ease, box-shadow 0.15s ease;
  }

  .lang:hover {
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .lang.on {
    background: color-mix(in srgb, var(--c) 16%, var(--raised));
    box-shadow: inset 0 0 0 1.5px var(--c);
  }

  .lang:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .grow {
    flex: 1;
    min-width: 200px;
    max-width: 300px;
  }

  .field .seg {
    align-self: flex-start;
  }

  .input {
    width: 100%;
    min-height: 2.5rem;
  }

  .num {
    width: 120px;
    font-variant-numeric: tabular-nums;
  }

  select.input {
    padding-right: 2rem;
  }

  .note {
    margin: 0;
    color: var(--ink-2);
    font-size: 15px;
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 14px;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  @media (max-width: 520px) {
    .log {
      padding: 20px 16px;
    }
  }
</style>
