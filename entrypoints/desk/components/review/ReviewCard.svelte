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

<article class="card" style:background={color} style:--panel={color} aria-label="Sentence to review">
  <p class="label">
    <span class="lang"><LangName lang={sentence.lang} /></span>
    <span class="source">from “{sentence.videoTitle}” at {clock(sentence.start)}</span>
  </p>

  <p class="text" lang={sentence.lang}>{sentence.text}</p>

  <div class="reveal">
    {#if revealed && hasTranslation}
      <p class="translation">{sentence.translation}</p>
    {:else if revealed}
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
    {:else}
      <button class="btn ghost small" type="button" onclick={() => (revealed = true)}>
        Show translation <span class="chip" aria-hidden="true">T</span>
      </button>
    {/if}
  </div>

  <footer class="actions">
    <button class="btn ghost" type="button" aria-keyshortcuts="Space" onclick={onhear}>
      <span aria-hidden="true">▶</span> Hear it
    </button>
    {#each GRADES as item (item.grade)}
      <div class="grade">
        <button
          class="btn {item.grade === 'good' ? 'light' : 'ghost'}"
          type="button"
          aria-keyshortcuts={item.key}
          aria-describedby="hint-{item.grade}"
          disabled={busy}
          onclick={() => ongrade(item.grade)}
        >
          {item.label}
        </button>
        <span class="hint" id="hint-{item.grade}">{hint(item.grade)}</span>
      </div>
    {/each}
    <p class="keys">1 · 2 · 3 · Space replays</p>
  </footer>
</article>

<style>
  .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 360px;
    padding: clamp(24px, 4vw, 40px) clamp(24px, 4vw, 50px);
    border-radius: var(--r-lg);
    color: #fff;
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
    font-size: 15px;
    font-weight: 500;
  }

  .lang {
    font-size: 28px;
  }

  .text {
    margin: 26px 0 0;
    max-width: 14em;
    font-size: clamp(34px, 4.6vw, 60px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.04;
  }

  .reveal {
    margin-top: 20px;
    max-width: 34em;
  }

  .translation {
    margin: 0;
    font-size: 21px;
    line-height: 1.35;
    opacity: 0.9;
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
    border: 1.5px solid rgba(255, 255, 255, 0.7);
    border-radius: var(--pill);
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    font-size: 16px;
  }

  .error {
    margin: 8px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .chip {
    margin-left: 4px;
    padding: 0 5px;
    border: 1px solid currentColor;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0.85;
  }

  .actions {
    margin-top: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 10px;
    padding-top: 24px;
  }

  .grade {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .hint {
    font-size: 13px;
    opacity: 0.85;
    white-space: nowrap;
  }

  .keys {
    margin: 0 0 0 auto;
    font-size: 14px;
    opacity: 0.85;
    white-space: nowrap;
  }
</style>
