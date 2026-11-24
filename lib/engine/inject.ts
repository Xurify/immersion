import type { ScriptPublicPath } from "wxt/utils/inject-script";
import { LIVE_FLAG } from "./page";

type World = "MAIN" | "ISOLATED";

/** A manifest content_scripts entry; WXT writes `world` for MAIN-world scripts, which the browser typings omit. */
interface DeclaredScript {
  matches?: string[];
  js?: ScriptPublicPath[];
  world?: World;
}

/**
 * Loads the YouTube content scripts the manifest declares into open tabs, which
 * have none when the extension was installed, reloaded or started after them.
 * `replace` also loads over a copy that is already there (after a reload, that
 * copy belongs to the old extension and is dead). The MAIN script goes first so
 * its listener is ready before the isolated script asks it for metadata.
 */
export async function injectIntoYouTubeTabs(replace: boolean): Promise<void> {
  const entries = (browser.runtime.getManifest().content_scripts ?? []) as DeclaredScript[];
  const declared = entries.filter((script) =>
    script.matches?.some((match) => match.startsWith("https://www.youtube.com")),
  );
  const scripts = [...declared.filter((script) => script.world === "MAIN"), ...declared.filter((script) => script.world !== "MAIN")];
  const tabs = await browser.tabs.query({ url: "https://www.youtube.com/*", discarded: false });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      for (const script of scripts) {
        const world: World = script.world === "MAIN" ? "MAIN" : "ISOLATED";
        if (!replace && (await isRunning(tab.id, world))) continue;
        await browser.scripting.executeScript({ target: { tabId: tab.id }, world, files: script.js ?? [] }).catch(() => {});
      }
    }),
  );
}

async function isRunning(tabId: number, world: World): Promise<boolean> {
  const [result] = await browser.scripting
    .executeScript({
      target: { tabId },
      world,
      func: (flag: string) => Boolean((window as unknown as Record<string, unknown>)[flag]),
      args: [LIVE_FLAG],
    })
    .catch(() => []);
  return result?.result === true;
}
