import { assignGoalColors, baseColor, PALETTE } from "./languages";
import type { Lang } from "./types";

/**
 * Goal languages get distinct colours: each keeps its usual colour unless an earlier
 * goal already has it, then takes the next free one. Reactive, so panels recolour when goals change.
 */
let assigned = $state<Record<Lang, string>>({});

export function setGoalLanguages(langs: Lang[]): void {
  assigned = assignGoalColors(langs);
}

export function langColor(lang: Lang | null | undefined): string {
  if (!lang) return baseColor(lang);
  const goal = assigned[lang];
  if (goal) return goal;
  // Other languages stay off the goal languages' colours while any are free.
  const base = baseColor(lang);
  const used = new Set(Object.values(assigned));
  if (!used.has(base)) return base;
  const free = PALETTE.filter((color) => !used.has(color));
  return free.length ? free[[...lang].reduce((hash, char) => hash + char.charCodeAt(0), 0) % free.length]! : base;
}
