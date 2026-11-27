<script lang="ts">
  import { getTheme, setTheme } from "../../../../lib/theme";
  import type { ThemePref } from "../../../../lib/types";

  const OPTIONS: { id: ThemePref; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  let theme = $state<ThemePref>(getTheme());

  function handleChoose(id: ThemePref): void {
    theme = id;
    setTheme(id);
  }
</script>

<div class="panel">
  <h3>Appearance</h3>
  <p class="intro">System follows your computer's setting. Light and dark apply to this browser only.</p>

  <div class="theme-grid" role="group" aria-label="Theme">
    {#each OPTIONS as option (option.id)}
      <button
        type="button"
        class={["theme-card", option.id]}
        aria-pressed={theme === option.id}
        onclick={() => handleChoose(option.id)}
      >
        <span class={["preview", option.id]} aria-hidden="true">
          {#if option.id === "system"}
            <span class="half light-half">
              <i class="mini-card"></i>
              <i class="mini-tile red"></i>
            </span>
            <span class="half dark-half">
              <i class="mini-card"></i>
              <i class="mini-tile green"></i>
            </span>
          {:else}
            <span class="mini-top">
              <i class="mini-bar"></i>
              <i class="mini-ring"></i>
            </span>
            <span class="mini-row">
              <i class="mini-tile red"></i>
              <i class="mini-tile green"></i>
            </span>
          {/if}
        </span>

        <span class="card-foot">
          <b>{option.label}</b>
          <span class="check-dot" aria-hidden="true">
            {#if theme === option.id}
              <svg viewBox="0 0 12 12" width="10" height="10">
                <path d="M2 6.2 4.8 9 10 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {/if}
          </span>
        </span>
      </button>
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
    margin: -8px 0 4px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-2);
    max-width: 40em;
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 9px;
    border: 0;
    border-radius: 12px;
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line);
    text-align: start;
    transition: box-shadow 0.15s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .theme-card:hover {
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .theme-card:active {
    transform: scale(0.97);
  }

  .theme-card[aria-pressed="true"] {
    box-shadow: inset 0 0 0 1.5px var(--ink);
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 7px;
    height: 80px;
    padding: 9px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px light-dark(oklch(0 0 0 / 0.08), oklch(1 0 0 / 0.1));
  }

  .preview.light {
    background: #f7f5f0;
  }

  .preview.dark {
    background: #0e0d0c;
  }

  .preview.system {
    flex-direction: row;
    gap: 0;
    padding: 0;
  }

  .half {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 8px;
  }

  .light-half {
    background: #f7f5f0;
  }

  .dark-half {
    background: #0e0d0c;
  }

  .mini-card {
    display: block;
    height: 22px;
    border-radius: 5px;
  }

  .light-half .mini-card {
    background: #fff;
    box-shadow: 0 0 0 1px #e6e2d8;
  }

  .dark-half .mini-card {
    background: #171614;
    box-shadow: 0 0 0 1px #2a2825;
  }

  .mini-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 7px;
  }

  .preview.light .mini-top {
    background: #fff;
    box-shadow: 0 0 0 1px #e6e2d8;
  }

  .preview.dark .mini-top {
    background: #171614;
    box-shadow: 0 0 0 1px #2a2825;
  }

  .mini-bar {
    display: block;
    width: 44%;
    height: 9px;
    border-radius: 4px;
  }

  .preview.light .mini-bar {
    background: #141310;
  }

  .preview.dark .mini-bar {
    background: #f3f0e9;
  }

  .mini-ring {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid #1d7a4c;
    border-top-color: #c93a1e;
  }

  .mini-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    flex: 1;
  }

  .mini-tile {
    display: block;
    flex: 1;
    border-radius: 6px;
  }

  .mini-tile.red {
    background: #c93a1e;
  }

  .mini-tile.green {
    background: #1d7a4c;
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-inline: 3px;
  }

  .card-foot b {
    font-size: 13.5px;
    font-weight: 700;
  }

  .check-dot {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--line-2);
    color: var(--on-ink);
  }

  .theme-card[aria-pressed="true"] .check-dot {
    background: var(--ink);
    box-shadow: none;
  }

  @media (max-width: 520px) {
    .theme-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
