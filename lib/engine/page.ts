/** Tags messages between the page-world and the isolated content script. */
export const BRIDGE = "language-immersion-tracker";

/** Caption segments as one line, whitespace collapsed. */
export function captionLine(segments: (string | null)[]): string {
  return segments
    .filter((segment): segment is string => !!segment)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
}
