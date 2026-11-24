<script lang="ts">
  import { getTheme, setTheme } from "../../../../lib/theme";
  import type { ThemePref } from "../../../../lib/types";

  const OPTIONS: { id: ThemePref; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  let theme = $state<ThemePref>(getTheme());

  function choose(id: ThemePref) {
    theme = id;
    setTheme(id);
  }
</script>

<div class="panel">
  <h3>Appearance</h3>
  <p class="intro">System follows your computer's setting. Light and dark apply to this browser only.</p>
  <div class="seg" role="group" aria-label="Theme">
    {#each OPTIONS as option (option.id)}
      <button type="button" aria-pressed={theme === option.id} onclick={() => choose(option.id)}>
        {option.label}
      </button>
    {/each}
  </div>
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
    max-width: 38em;
  }

  .seg button {
    min-height: 2.25rem;
    padding: 0 18px;
  }
</style>
