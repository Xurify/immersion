export interface MixPart {
  lang: string | null;
  seconds: number;
}

export function mixOf(items: MixPart[]): MixPart[] {
  const totals = new Map<string | null, number>();
  for (const item of items) totals.set(item.lang, (totals.get(item.lang) ?? 0) + item.seconds);
  return [...totals]
    .map(([lang, seconds]) => ({ lang, seconds }))
    .filter((part) => part.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}
