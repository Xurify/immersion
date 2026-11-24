<script lang="ts">
  import type { Snippet } from "svelte";
  import { placeFloating } from "./place";

  let {
    anchor,
    label,
    width = 340,
    onclose,
    children,
  }: { anchor: HTMLElement; label: string; width?: number; onclose: () => void; children: Snippet } = $props();

  let panel = $state<HTMLDivElement>();
  let placed = $state(false);
  let pos = $state({ top: 0, left: 0 });

  function place() {
    if (!panel) return;
    const size = Math.min(width, window.innerWidth - 16);
    pos = placeFloating(anchor.getBoundingClientRect(), size, panel.offsetHeight);
  }

  $effect(() => {
    if (!panel) return;
    place();
    placed = true;
    // The first input can be a radio; the search field is what the popover is for.
    (panel.querySelector<HTMLInputElement>("input[role='combobox']") ?? panel.querySelector<HTMLInputElement>("input"))?.focus();

    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && (panel?.contains(event.target) || anchor.contains(event.target))) return;
      onclose();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, { capture: true });
      document.removeEventListener("pointerdown", onPointer, true);
    };
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    // Stops here so the Escape does not also close a settings dialog around the popover.
    event.preventDefault();
    event.stopPropagation();
    if (anchor.isConnected) anchor.focus();
    onclose();
  }
</script>

<div
  class="panel"
  role="dialog"
  tabindex="-1"
  aria-label={label}
  bind:this={panel}
  style:top="{pos.top}px"
  style:left="{pos.left}px"
  style:width="{width}px"
  style:visibility={placed ? "visible" : "hidden"}
  {onkeydown}
>
  {@render children()}
</div>

<style>
  .panel {
    position: fixed;
    z-index: 90;
    max-width: calc(100vw - 16px);
    padding: 14px;
    border-radius: var(--r-md);
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--line), 0 18px 40px var(--shadow);
  }
</style>
