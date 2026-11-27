<script lang="ts">
  interface Shortcut {
    keys: string[];
    text: string;
  }

  const GROUPS: { title: string; items: Shortcut[] }[] = [
    {
      title: "Global",
      items: [
        { keys: ["1", "2", "3", "4"], text: "Switch between Board, All videos, Review and History." },
        { keys: ["Esc"], text: "Clear the current selection." },
      ],
    },
    {
      title: "Board",
      items: [
        { keys: ["P"], text: "Play Up next." },
        { keys: ["S"], text: "Stash tabs in your goal languages into Inbox." },
        { keys: ["←", "→", "↑", "↓"], text: "Move between cards and columns." },
        { keys: ["Shift+↑", "Shift+↓"], text: "Reorder a card within its column." },
        { keys: ["Enter"], text: "Play the focused card." },
        { keys: ["N", "L", "D", "I"], text: "Send the card to Up next, Later, Done or Inbox." },
        { keys: ["Delete"], text: "Remove the card from the board." },
      ],
    },
    {
      title: "All videos & Review",
      items: [
        { keys: ["/"], text: "Focus video search on All videos." },
        { keys: ["Space"], text: "Hear the sentence clip again in Review." },
        { keys: ["T"], text: "Reveal the translation in Review." },
        { keys: ["1", "2", "3"], text: "Grade Again, Hard, or Got it in Review." },
      ],
    },
    {
      title: "YouTube",
      items: [{ keys: ["S"], text: "Save the caption you are currently hearing." }],
    },
  ];
</script>

<div class="panel">
  <h3>Keyboard</h3>
  <p class="intro">Shortcuts work whenever no text input has focus.</p>

  <div class="groups">
    {#each GROUPS as group (group.title)}
      <section class="group">
        <h4>{group.title}</h4>
        <dl class="list">
          {#each group.items as item (item.text)}
            <div class="row">
              <dt>
                {#each item.keys as key, keyIndex (keyIndex)}
                  {#if keyIndex > 0}<span class="sep" aria-hidden="true">/</span>{/if}
                  <kbd>{key}</kbd>
                {/each}
              </dt>
              <dd>{item.text}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
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
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .group {
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  h4 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--dim);
  }

  .list {
    margin: 0;
  }

  .row {
    display: grid;
    grid-template-columns: 11.5rem minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 8px 0;
  }

  .row + .row {
    border-top: 1px solid var(--line);
  }

  dt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  dd {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.4;
    color: var(--ink-2);
  }

  kbd {
    display: inline-block;
    min-width: 1.55rem;
    padding: 2px 6px;
    border: 1px solid var(--line-2);
    border-radius: 6px;
    background: var(--raised);
    box-shadow: inset 0 -1.5px 0 var(--line);
    font-family: inherit;
    font-size: 12px;
    font-weight: 750;
    text-align: center;
    color: var(--ink);
  }

  .sep {
    color: var(--dim);
    font-size: 12px;
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }
</style>
