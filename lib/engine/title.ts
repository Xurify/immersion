/** Drops the unread count YouTube prefixes ("(3) ") and its " - YouTube" suffix. */
export function cleanTitle(raw: string): string {
  return raw.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim();
}
