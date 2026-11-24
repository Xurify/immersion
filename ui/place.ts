/**
 * Top-left for a floating panel beside its anchor: below it, or above when the
 * space below is short, and always inside the viewport. Panels are position: fixed
 * so the scrolling columns and dialogs around them cannot clip them.
 */
export function placeFloating(anchor: DOMRect, width: number, height: number): { top: number; left: number } {
  const edge = 8;
  const gap = 6;
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - height;
  const fitsBelow = below + height <= window.innerHeight - edge;
  const top = !fitsBelow && above >= edge ? above : Math.max(edge, Math.min(below, window.innerHeight - edge - height));
  const left = Math.max(edge, Math.min(anchor.left, window.innerWidth - edge - width));
  return { top, left };
}
