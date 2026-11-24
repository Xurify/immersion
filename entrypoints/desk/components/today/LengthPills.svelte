<script lang="ts">
  import type { Budget } from "../../../../lib/plan";

  let {
    value,
    showFinish,
    onchange,
  }: {
    value: Budget;
    showFinish: boolean;
    onchange: (budget: Budget) => void;
  } = $props();

  const lengths = [20, 45, 90] as const;
</script>

<div class="lengths" role="group" aria-label="Session length">
  <span class="dim">Length</span>
  {#if showFinish}
    <button class="pill" type="button" aria-pressed={value === "goals"} onclick={() => onchange("goals")}>Finish goals</button>
  {/if}
  {#each lengths as length (length)}
    <button class="pill" type="button" aria-pressed={value === length} onclick={() => onchange(length)}>{length} min</button>
  {/each}
</div>

<style>
  .lengths {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

</style>
