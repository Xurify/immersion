import { loadSession, saveSession } from "../storage";
import { runInTab, type TabCommand } from "./play";

const PLAY: TabCommand = { type: "video:play", payload: {} };

export async function startSession(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) {
    await saveSession("active", null);
    return;
  }
  await saveSession("active", { tabIds, index: 0, startedAt: Date.now() });
  await runInTab(tabIds[0]!, PLAY);
}

export async function advanceSession(tabId: number | undefined): Promise<void> {
  const active = await loadSession("active");
  if (!active || tabId === undefined || tabId !== active.tabIds[active.index]) return;
  const index = active.index + 1;
  if (index >= active.tabIds.length) {
    await saveSession("active", null);
    return;
  }
  await saveSession("active", { ...active, index });
  await runInTab(active.tabIds[index]!, PLAY);
}

/**
 * Takes closed tabs out of the session. If the video playing was closed, the next one plays.
 * Safe to call again for tabs already dropped.
 */
export async function dropFromSession(removed: number[]): Promise<void> {
  const active = await loadSession("active");
  if (!active || !active.tabIds.some((id) => removed.includes(id))) return;
  const current = active.tabIds[active.index];
  const tabIds = active.tabIds.filter((id) => !removed.includes(id));
  // Kept tabs before the current one: where the next kept tab sits if the current one was dropped.
  const index = active.tabIds.slice(0, active.index).filter((id) => !removed.includes(id)).length;
  if (index >= tabIds.length) {
    await saveSession("active", null);
    return;
  }
  await saveSession("active", { ...active, tabIds, index });
  if (current !== undefined && removed.includes(current)) await runInTab(tabIds[index]!, PLAY);
}
