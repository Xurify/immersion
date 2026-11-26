<script lang="ts">
  const SHORTCUTS: { keys: string[]; text: string; where?: string }[] = [
    { keys: ["1", "2", "3", "4"], text: "Switch between Board, All videos, Review and History." },
    { keys: ["P"], text: "Play Up next.", where: "Board" },
    { keys: ["S"], text: "Stash tabs in your goal languages into Inbox.", where: "Board" },
    { keys: ["←", "→", "↑", "↓"], text: "Move between cards and columns.", where: "Board" },
    { keys: ["Shift+↑", "Shift+↓"], text: "Reorder a card within its column.", where: "Board" },
    { keys: ["Enter"], text: "Play the card.", where: "Board" },
    { keys: ["N", "L", "D", "I"], text: "Send the card to Up next, Later, Done or Inbox.", where: "Board" },
    { keys: ["Delete"], text: "Remove the card from the board.", where: "Board" },
    { keys: ["/"], text: "Search videos.", where: "All videos" },
    { keys: ["Esc"], text: "Clear the selection." },
    { keys: ["Space"], text: "Hear the sentence again.", where: "Review" },
    { keys: ["T"], text: "Show the translation.", where: "Review" },
    { keys: ["1", "2", "3"], text: "Again, Hard and Got it. These keys grade the card instead of switching views.", where: "Review" },
    { keys: ["S"], text: "Save the caption you are reading.", where: "YouTube" },
  ];
</script>

<div class="panel">
  <h3>Keyboard</h3>
  <p class="intro">Keys work when no text field has focus.</p>
  <dl class="list">
    {#each SHORTCUTS as item, i (i)}
      <div class="row">
        <dt>
          {#each item.keys as key, k (k)}
            {#if k > 0}<span class="sep" aria-hidden="true">/</span>{/if}
            <kbd>{key}</kbd>
          {/each}
        </dt>
        <dd>
          {item.text}
          {#if item.where}<span class="where">{item.where}</span>{/if}
        </dd>
      </div>
    {/each}
  </dl>
</div>

<style>
  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .intro {
    margin: 0 0 18px;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink-2);
  }

  .list {
    margin: 0;
    border-top: 1px solid var(--line);
  }

  .row {
    display: grid;
    grid-template-columns: 11.5rem minmax(0, 1fr);
    gap: 16px;
    align-items: baseline;
    padding: 11px 0;
    border-bottom: 1px solid var(--line);
  }

  dt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  dd {
    margin: 0;
    font-size: 15px;
    line-height: 1.4;
  }

  kbd {
    display: inline-block;
    min-width: 1.65rem;
    padding: 2px 6px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--soft);
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    text-align: center;
  }

  .sep {
    color: var(--dim);
  }

  .where {
    display: block;
    margin-top: 2px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--dim);
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }
</style>
