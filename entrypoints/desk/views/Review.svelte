<script lang="ts">
  import { untrack } from "svelte";
  import { data } from "../../../lib/data.svelte";
  import { englishName } from "../../../lib/languages";
  import { langColor } from "../../../lib/colors.svelte";
  import { send } from "../../../lib/messages";
  import { dueLabel, dueSentences, isLearned } from "../../../lib/review";
  import { load, save } from "../../../lib/storage";
  import type { Grade, Sentence } from "../../../lib/types";
  import ReviewCard from "../components/review/ReviewCard.svelte";
  import SavedList from "../components/review/SavedList.svelte";

  /** The sitting: cards still to answer, current first. Snapshotted when the view opens. */
  let queue = $state<Sentence[]>([]);
  let total = $state(0);
  let attempt = $state(0);
  let busy = $state(false);
  let error = $state("");
  let started = false;

  const current: Sentence | undefined = $derived(queue[0]);
  const done = $derived(total - queue.length);
  const segments = $derived(Array.from({ length: total }, (_, i) => i));

  const dueByLang = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const sentence of queue) counts.set(sentence.lang, (counts.get(sentence.lang) ?? 0) + 1);
    return [...counts].map(([lang, count]) => ({ lang, count })).sort((a, b) => b.count - a.count);
  });
  const dueText = $derived(dueByLang.map((item) => `${item.count} ${englishName(item.lang)}`).join(", ") + " due");

  const dueNow = $derived(dueSentences(data.sentences).length);
  const nextDue = $derived.by(() => {
    const now = Date.now();
    let soonest: number | null = null;
    for (const sentence of data.sentences) {
      if (isLearned(sentence) || sentence.dueAt <= now) continue;
      if (soonest === null || sentence.dueAt < soonest) soonest = sentence.dueAt;
    }
    return soonest;
  });

  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

  function startSitting() {
    const due = dueSentences(data.sentences);
    queue = due;
    total = due.length;
    error = "";
  }

  $effect(() => {
    if (!data.loaded || started) return;
    started = true;
    untrack(startSitting);
  });

  async function grade(choice: Grade) {
    const card = current;
    if (!card || busy) return;
    busy = true;
    error = "";
    try {
      const updated = await send("review:grade", { sentenceId: card.id, grade: choice });
      const rest = queue.filter((sentence) => sentence.id !== card.id);
      queue = choice === "again" ? [...rest, updated] : rest;
      attempt++;
    } catch {
      error = "That grade did not save. Try again.";
    } finally {
      busy = false;
    }
  }

  async function hear() {
    const card = current;
    if (!card) return;
    error = "";
    try {
      await send("clip:play", { sentenceId: card.id });
    } catch {
      error = "Could not play this clip. Open the video in a tab and try again.";
    }
  }

  async function saveTranslation(translation: string) {
    const card = current;
    if (!card) return;
    const all = await load("sentences");
    await save(
      "sentences",
      all.map((sentence) => (sentence.id === card.id ? { ...sentence, translation } : sentence)),
    );
    queue = queue.map((sentence) => (sentence.id === card.id ? { ...sentence, translation } : sentence));
  }
</script>

<section class="review" aria-label="Review">
  {#if !data.loaded}
    <!-- Waiting for storage; nothing to show yet. -->
  {:else if data.sentences.length === 0}
    <div class="empty">
      <h2>No sentences saved yet</h2>
      <p>On YouTube, turn on captions and press S when you hear a sentence worth keeping.</p>
    </div>
  {:else if current}
    <div class="head">
      <h2 class="count">{Math.min(done + 1, total)} of {total}</h2>
      <p class="due">
        <span class="sr-only">{dueText}</span>
        <span class="due-items" aria-hidden="true">
          {#each dueByLang as item (item.lang)}
            <span class="item"><i class="dot" style:background={langColor(item.lang)}></i>{item.count} {englishName(item.lang)}</span>
          {/each}
        </span>
      </p>
    </div>

    <div class="strip" style:--now={langColor(current.lang)} aria-hidden="true">
      {#each segments as i (i)}
        <i class="seg" class:done={i < done} class:now={i === done}></i>
      {/each}
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#key `${current.id}:${attempt}`}
      <ReviewCard sentence={current} {busy} onhear={hear} ongrade={grade} onsave={saveTranslation} />
    {/key}
  {:else}
    <div class="caught">
      <h2>All caught up</h2>
      <p>
        {total === 0 ? "Nothing was due when you opened Review." : `You reviewed ${plural(total, "sentence")} this sitting.`}
      </p>
      {#if nextDue !== null}
        <p>The next sentence is due {dueLabel(nextDue)}.</p>
      {:else}
        <p>Every saved sentence is learned.</p>
      {/if}
      {#if dueNow > 0}
        <button class="btn" type="button" onclick={startSitting}>Review {dueNow} due now</button>
      {/if}
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <SavedList />
    </div>
  {/if}
</section>

<style>
  .review {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    padding: 16px var(--gutter) 48px;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px 16px;
  }

  .count {
    margin: 0;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .due {
    margin: 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .due-items {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .strip {
    display: flex;
    gap: 4px;
  }

  .seg {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--line);
  }

  .seg.done {
    background: var(--ink);
  }

  .seg.now {
    background: var(--now);
  }

  .error {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--danger);
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 36rem;
    margin-top: 12vh;
  }

  .empty h2,
  .caught h2 {
    margin: 0;
    font-size: clamp(40px, 6vw, 64px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .empty p {
    margin: 0;
    font-size: 19px;
    line-height: 1.4;
    color: var(--ink-2);
  }

  .caught {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-top: 16px;
  }

  .caught > p {
    margin: 0;
    font-size: 18px;
    color: var(--ink-2);
  }

  .caught .btn {
    margin-top: 4px;
  }

  .caught :global(.saved) {
    align-self: stretch;
    margin-top: 28px;
  }
</style>
