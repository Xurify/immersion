# Language Immersion Tracker

A Chrome extension for learning languages by listening on YouTube.

- **Board** keeps videos, not tabs, in five columns: Inbox, Up next, Listening now, Done today and Later. **Stash all tabs** saves every YouTube tab to Inbox with its place, then closes it. Playing Up next opens one tab at a time, resumes each video where you left it, and closes it when it ends. **Fill to goals** queues enough of the languages you're behind on. You can drag cards between columns or use the keyboard (arrow keys, plus `N`, `L`, `D`, `I`, `Enter`, `S`, `P`).
- **All videos** sorts your open YouTube tabs into one column per language. You can start, save or close a selection.
- **Review** brings back the sentences you saved from captions, on a 1, 3, 7, 16 and 35-day ladder.
- **History** shows listening per day and per goal language, with goal days, streaks, hour milestones and how much was watched rather than played in a hidden tab. Time in other languages is listed apart, with a button to make any of them a goal. **Log time** adds listening from off YouTube, such as podcasts, audiobooks or a tutor.
- **Goals** can be minutes a day or a week. Settings also takes hours listened before tracking, which count toward totals and milestones.
- **Channels** you follow bring their new uploads into Inbox, checked every 6 hours.
- **Sentences** export per language for Anki or Clozemaster from Settings > Data.
- **The popup** gives the same plan at a glance, with a Play button per language, and files the current tab to Inbox, Up next or Later, sets its language or follows its channel. The toolbar badge shows the language being counted right now, or the minutes left today.

Time counts only while a video plays, under the video's spoken language. The language is detected from YouTube's caption tracks. You can override it per channel from All videos.

On YouTube, turn on captions and press **S** to save the line on screen for review.

## Develop

```sh
bun install
bun run dev      # Chrome with the extension loaded and hot reload
bun run check    # svelte-check + TypeScript
bun test
bun run build    # .output/chrome-mv3
```

## Layout

- `entrypoints/background.ts`: message router, listening log, session playback
- `entrypoints/youtube.content/` and `youtube-main.content.ts`: page metadata, language detection, play ticks, saving sentences
- `entrypoints/desk/`: the full-page app (Board, All videos, Review, History, Settings)
- `entrypoints/popup/`: toolbar popup
- `lib/`: shared types, the board model (`board.ts`), the message contract (`messages.ts`), storage, planning, review scheduling and stats
- `ui/` and `styles/base.css`: shared components and design tokens
