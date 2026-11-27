<script lang="ts">
  import { langColor } from "../lib/colors.svelte";

  export interface RingSegment {
    lang: string;
    weight: number;
    percent: number;
  }

  interface Props {
    segments: RingSegment[];
    overallPercent: number;
    doneCount: number;
    totalCount: number;
    allMet: boolean;
    size?: number;
  }

  let { segments, overallPercent, doneCount, totalCount, allMet, size = 82 }: Props = $props();

  const RADIUS = 34;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  interface ComputedArc {
    lang: string;
    color: string;
    trackLength: number;
    fillLength: number;
    rotation: number;
    hasFill: boolean;
  }

  const arcs = $derived.by((): ComputedArc[] => {
    const count = segments.length;
    if (count === 0) return [];
    const totalWeight = segments.reduce((accumulator, segment) => accumulator + Math.max(segment.weight, 1), 0);
    const gapLength = count === 1 ? 0 : Math.min(11.5, (CIRCUMFERENCE * 0.42) / count);
    const availableArc = Math.max(12, CIRCUMFERENCE - count * gapLength);

    let offset = 0;
    return segments.map((segment) => {
      const share = Math.max(segment.weight, 1) / totalWeight;
      const trackLength = Math.max(2, availableArc * share);
      const clampedPercent = Math.max(0, Math.min(100, segment.percent));
      const hasFill = clampedPercent > 0;
      const fillLength = hasFill ? Math.max(0.2, trackLength * (clampedPercent / 100)) : 0;
      const rotation = -90 + ((offset + gapLength / 2) / CIRCUMFERENCE) * 360;
      offset += trackLength + gapLength;
      return {
        lang: segment.lang,
        color: langColor(segment.lang),
        trackLength,
        fillLength,
        rotation,
        hasFill,
      };
    });
  });

  const summaryLabel = $derived(
    allMet
      ? `All ${totalCount} daily language goals met`
      : `Today's goals: ${overallPercent}% complete, ${doneCount} of ${totalCount} languages met`,
  );
</script>

<div class="ring-wrap" style:width="{size}px" style:height="{size}px" role="img" aria-label={summaryLabel}>
  <svg viewBox="0 0 84 84" width={size} height={size} aria-hidden="true">
    {#each arcs as arc (arc.lang)}
      <circle
        class="track"
        cx="42"
        cy="42"
        r={RADIUS}
        fill="none"
        stroke-width="7"
        stroke-linecap="round"
        stroke-dasharray="{arc.trackLength} {CIRCUMFERENCE - arc.trackLength}"
        transform="rotate({arc.rotation} 42 42)"
        style:--arc-color={arc.color}
      />
      {#if arc.hasFill}
        <circle
          class="fill"
          cx="42"
          cy="42"
          r={RADIUS}
          fill="none"
          stroke-width="7"
          stroke-linecap="round"
          stroke-dasharray="{arc.fillLength} {CIRCUMFERENCE - arc.fillLength}"
          transform="rotate({arc.rotation} 42 42)"
          style:--arc-color={arc.color}
        />
      {/if}
    {/each}
  </svg>
  <div class="center" aria-hidden="true">
    {#if allMet}
      <svg class="check" viewBox="0 0 18 18" width="18" height="18">
        <path d="M3.5 9.5 7.2 13.2 14.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="sub">100%</span>
    {:else}
      <span class="pct">{overallPercent}<small>%</small></span>
      <span class="sub">{doneCount}/{totalCount}</span>
    {/if}
  </div>
</div>

<style>
  .ring-wrap {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
  }

  .track {
    stroke: light-dark(
      color-mix(in srgb, var(--arc-color) 16%, #e7e4dc),
      color-mix(in srgb, var(--arc-color) 20%, var(--soft))
    );
  }

  .fill {
    stroke: var(--arc-color);
    transition: stroke-dasharray 0.35s cubic-bezier(0.2, 0, 0, 1);
  }

  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    pointer-events: none;
  }

  .pct {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  .pct small {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.72;
  }

  .check {
    color: light-dark(#15803d, #4ade80);
  }

  .sub {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--dim);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
</style>
