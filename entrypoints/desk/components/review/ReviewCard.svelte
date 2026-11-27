<script lang="ts">
  import { clock } from "../../../../lib/format";
  import { langColor } from "../../../../lib/colors.svelte";
  import { dueLabel, nextDueAt } from "../../../../lib/review";
  import type { Grade, Sentence } from "../../../../lib/types";
  import LangName from "../../../../ui/LangName.svelte";

  let {
    sentence,
    busy = false,
    onhear,
    ongrade,
    onsave,
  }: {
    sentence: Sentence;
    busy?: boolean;
    onhear: () => void;
    ongrade: (grade: Grade) => void;
    onsave: (translation: string) => Promise<void>;
  } = $props();

  const GRADES: { grade: Grade; label: string; key: string }[] = [
    { grade: "again", label: "Again", key: "1" },
    { grade: "hard", label: "Hard", key: "2" },
    { grade: "good", label: "Got it", key: "3" },
  ];

  const color = $derived(langColor(sentence.lang));
  const hasTranslation = $derived(sentence.translation.trim().length > 0);

  let revealed = $state(false);
  let draft = $state("");
  let saving = $state(false);
  let saveError = $state("");

  function hint(grade: Grade): string {
    return dueLabel(nextDueAt(sentence, grade));
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || saving) return;
    saving = true;
    saveError = "";
    try {
      await onsave(text);
      draft = "";
    } catch {
      saveError = "Could not save the translation. Try again.";
    } finally {
      saving = false;
    }
  }

  // Capture phase, so grade keys reach here before the app's 1 to 4 view switch.
  $effect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;

      if (event.key === " ") {
        event.preventDefault();
        onhear();
        return;
      }
      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        revealed = true;
        return;
      }
      const match = GRADES.find((item) => item.key === event.key);
      if (match) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busy) ongrade(match.grade);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
</script>

<article class="card" style:background-color={color} style:--panel={color} aria-label="Sentence to review">
  <p class="label">
    <span class="lang"><LangName lang={sentence.lang} /></span>
    <span class="source">from “{sentence.videoTitle}” at {clock(sentence.start)}</span>
  </p>

  <p class="text" lang={sentence.lang}>{sentence.text}</p>

  <div class="tools">
    <button class="btn small ghost" type="button" aria-keyshortcuts="Space" onclick={onhear}>
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M2.5 1.2v9.6L10.5 6z" /></svg>
      Hear it <span class="key" aria-hidden="true">Space</span>
    </button>
    {#if !revealed}
      <button class="btn ghost small" type="button" onclick={() => (revealed = true)}>
        Show translation <span class="key" aria-hidden="true">T</span>
      </button>
    {/if}
  </div>

  {#if revealed}
    <div class="reveal">
      {#if hasTranslation}
        <p class="translation">{sentence.translation}</p>
      {:else}
        <form class="add" onsubmit={submit}>
          <label for="translation-input">Add a translation</label>
          <div class="add-row">
            <input id="translation-input" type="text" autocomplete="off" bind:value={draft} />
            <button class="btn small light" type="submit" disabled={saving || draft.trim() === ""}>Save</button>
          </div>
          {#if saveError}
            <p class="error" role="alert">{saveError}</p>
          {/if}
        </form>
      {/if}
    </div>
  {/if}

  <footer class="grades">
    {#each GRADES as item (item.grade)}
      <button
        class="grade"
        class:good={item.grade === "good"}
        type="button"
        aria-keyshortcuts={item.key}
        aria-describedby="hint-{item.grade}"
        disabled={busy}
        onclick={() => ongrade(item.grade)}
      >
        <span class="grade-top">
          <span class="grade-label">{item.label}</span>
          <span class="key" aria-hidden="true">{item.key}</span>
        </span>
        <span class="hint" id="hint-{item.grade}">{hint(item.grade)}</span>
      </button>
    {/each}
  </footer>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    padding: clamp(24px, 4vw, 44px);
    border-radius: 20px;
    color: #fff;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14), 0 2px 8px rgb(0 0 0 / 0.12);
  }

  .card button:focus-visible,
  .card input:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
  }

  .label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin: 0;
    font-size: 14px;
  }

  .lang {
    font-size: 26px;
  }

  .source {
    opacity: 0.9;
  }

  .text {
    margin: 40px 0 0;
    font-size: clamp(34px, 4.4vw, 56px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.08;
    text-wrap: balance;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 28px;
  }

  .tools .btn.ghost {
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.45);
  }

  .tools .btn.ghost:hover {
    box-shadow: inset 0 0 0 1px #fff;
  }

  .reveal {
    margin-top: 20px;
    max-width: 34em;
  }

  .translation {
    margin: 0;
    padding-left: 16px;
    border-left: 3px solid rgb(255 255 255 / 0.5);
    font-size: 21px;
    line-height: 1.4;
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

  .add input {
    flex: 1;
    min-width: 0;
    min-height: 2.75rem;
    padding: 0 1.1rem;
    border: 1.5px solid rgba(255, 255, 255, 0.6);
    border-radius: var(--pill);
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    font-size: 16px;
  }

  .error {
    margin: 8px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .key {
    display: inline-grid;
    place-items: center;
    min-width: 1.4em;
    margin-left: 2px;
    padding: 0 5px;
    border-radius: 5px;
    background: rgb(255 255 255 / 0.18);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
  }

  .grades {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 48px;
  }

  .grade {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-height: 4.5rem;
    padding: 12px 16px;
    border: 0;
    border-radius: 18px;
    background: rgb(0 0 0 / 0.16);
    color: #fff;
    text-align: start;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.22);
    transition: background-color 0.15s ease, transform 0.12s ease;
  }

  .grade:hover {
    background: rgb(0 0 0 / 0.26);
  }

  .grade:active {
    transform: scale(0.96);
  }

  .grade:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .grade.good {
    background: #fff;
    color: var(--panel);
    box-shadow: none;
  }

  .grade.good:hover {
    background: rgb(255 255 255 / 0.9);
  }

  .grade.good .key {
    background: color-mix(in srgb, var(--panel) 14%, transparent);
  }

  .grade-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
  }

  .grade-label {
    font-size: 17px;
    font-weight: 800;
  }

  .hint {
    font-size: 13px;
    opacity: 0.9;
  }

  @media (max-width: 520px) {
    .grades {
      gap: 6px;
    }

    .grade {
      padding: 10px 12px;
    }

    .key {
      display: none;
    }
  }
</style>
