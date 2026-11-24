import type { ThemePref } from "./types";

/** localStorage so public/theme-init.js can apply it before first paint. */
const KEY = "theme";

export function getTheme(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref): void {
  if (pref === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}

export function setTheme(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  applyTheme(pref);
}

/** Keeps the desk and popup in step when the theme changes on the other. */
export function followTheme(): void {
  applyTheme(getTheme());
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) applyTheme(getTheme());
  });
}
