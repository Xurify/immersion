<script lang="ts">
  import { data } from "../../../../lib/data.svelte";
  import { englishName, langColor } from "../../../../lib/languages";
  import { isLearned } from "../../../../lib/review";
  import { load, save } from "../../../../lib/storage";
  import type { Sentence } from "../../../../lib/types";

  const DAY = 86_400_000;

  const saved = $derived([...data.sentences].sort((a, b) => b.createdAt - a.createdAt));
  let error = $state("");
  let removing = $state<string | null>(null);

  function stepLabel(sentence: Sentence): string {
    if (isLearned(sentence)) return "learned";
    const now = Date.now();
    if (sentence.dueAt <= now) return "due now";
    const days = Math.ceil((sentence.dueAt - now) / DAY);
    return `next review in ${days} ${days === 1 ? "day" : "days"}`;
  }

  async function remove(id: string) {
    removing = id;
    error = "";
    try {
      const next = (await load("sentences")).filter((sentence) => sentence.id !== id);
      await save("sentences", next);
      data.sentences = next;
    } catch {
      error = "Could not delete that sentence. Try again.";
    } finally {
      removing = null;
    }
  }
</script>

<section class="saved" aria-labelledby="saved-title">
  <h3 id="saved-title">Saved sentences</h3>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  <ul>
    {#each saved as sentence (sentence.id)}
      <li>
        <div class="body">
          <p class="text" lang={sentence.lang}>{sentence.text}</p>
          <p class="meta">
            <i class="dot" style:background={langColor(sentence.lang)} aria-hidden="true"></i>
            <span class="sr-only">{englishName(sentence.lang)}.</span>
            <span>{sentence.videoTitle}</span>
            <span aria-hidden="true">·</span>
            <span>{stepLabel(sentence)}</span>
          </p>
        </div>
        <button
          class="delete"
          type="button"
          disabled={removing === sentence.id}
          aria-label={`Delete “${sentence.text}”`}
          onclick={() => remove(sentence.id)}
        >
          Delete
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  h3 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
  }

  .body {
    min-width: 0;
  }

  .text {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.3;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--dim);
  }

  .meta .dot {
    width: 8px;
    height: 8px;
  }

  .delete {
    flex: none;
    min-height: 2.25rem;
    padding: 0 1rem;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: transparent;
    color: var(--danger);
    font-size: 14px;
    font-weight: 600;
  }

  .delete:hover {
    border-color: var(--danger);
  }

  .delete:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .error {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--danger);
  }
</style>
