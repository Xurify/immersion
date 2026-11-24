import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "Language Immersion Tracker",
    description: "Plan and track your language listening on YouTube: minutes left on today's goals, one-click sessions from your open tabs, and sentences to review.",
    permissions: ["tabs", "storage", "scripting", "readingList", "alarms"],
    host_permissions: ["https://www.youtube.com/*"],
    action: { default_title: "Language Immersion Tracker" },
    commands: {
      "open-desk": { suggested_key: { default: "Alt+Shift+L" }, description: "Open the desk" },
    },
  },
});
