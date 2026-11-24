<script lang="ts">
  import { duration } from "../../../../lib/format";
  import { englishName, langColor } from "../../../../lib/languages";
  import type { MixPart } from "./mix";

  let { parts, height = 12 }: { parts: MixPart[]; height?: number } = $props();

  const label = $derived(parts.map((part) => `${englishName(part.lang)} ${duration(part.seconds)}`).join(", "));
</script>

{#if parts.length}
  <div class="mix" role="img" aria-label="Time by language: {label}" style:height="{height}px">
    {#each parts as part (part.lang ?? "unknown")}
      <i style:flex-grow={part.seconds} style:background={langColor(part.lang)}></i>
    {/each}
  </div>
{/if}

<style>
  .mix {
    display: flex;
    gap: 3px;
    min-width: 0;
  }

  .mix i {
    flex: 0 0 auto;
    min-width: 4px;
    border-radius: 3px;
    flex-basis: 0;
  }
</style>
