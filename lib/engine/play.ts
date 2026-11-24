import type { TabCommands } from "../messages";

/** A command for a YouTube tab, in the shape the content script receives. */
export type TabCommand = {
  [K in keyof TabCommands]: { type: K; payload: TabCommands[K] };
}[keyof TabCommands];

const pending = new Map<number, TabCommand>();

export async function focusTab(tabId: number): Promise<void> {
  const tab = await browser.tabs.update(tabId, { active: true });
  if (tab) await browser.windows.update(tab.windowId, { focused: true });
}

export function forgetTab(tabId: number): void {
  pending.delete(tabId);
}

/** Sends the command if the tab is listening; otherwise it waits for that tab's next message. */
export async function flushPending(tabId: number): Promise<void> {
  const command = pending.get(tabId);
  if (!command) return;
  try {
    await browser.tabs.sendMessage(tabId, command);
    if (pending.get(tabId) === command) pending.delete(tabId);
  } catch {
    // The tab has no content script yet, such as a discarded tab still reloading.
  }
}

/** Focuses the tab (which reloads a discarded one) and runs the command once it reports in. */
export async function runInTab(tabId: number, command: TabCommand): Promise<void> {
  await focusTab(tabId);
  pending.set(tabId, command);
  await flushPending(tabId);
}
