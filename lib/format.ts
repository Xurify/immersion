/** "2026-11-24" in local time. */
export function dateKey(date: Date | number = Date.now()): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The last `count` date keys, oldest first, ending today. */
export function lastDays(count: number, now: number = Date.now()): string[] {
  const keys: string[] = [];
  const day = new Date(now);
  day.setHours(12, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(day);
    d.setDate(day.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

/** Video clock: 7:12, 1:04:09. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Whole minutes, rounding up so a few seconds left never reads as 0. */
export function minutes(seconds: number): number {
  return Math.max(0, Math.ceil(seconds / 60 - 0.01));
}

/** "4:12" hours:minutes for big totals. */
export function hoursClock(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** "1 h 04", "36 min", "0 min". */
export function duration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** "15:20" for a time `seconds` from now. */
export function endsAt(seconds: number, now: number = Date.now()): string {
  return new Date(now + seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function videoIdOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const short = u.pathname.match(/^\/shorts\/([\w-]{6,})/);
    return short?.[1] ?? null;
  } catch {
    return null;
  }
}

export function thumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
