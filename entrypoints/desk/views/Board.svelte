<script lang="ts">
  import { tick } from "svelte";
  import { data } from "../../../lib/data.svelte";
  import { asPlannable, columnSeconds, move, remove as removeCard, upsert, type Board as BoardState, type Column } from "../../../lib/board";
  import { duration, endsAt, minutes } from "../../../lib/format";
  import { englishName } from "../../../lib/languages";
  import { langColor } from "../../../lib/colors.svelte";
  import { send } from "../../../lib/messages";
  import { defaultBudget, planSession } from "../../../lib/plan";
  import LangName from "../../../ui/LangName.svelte";
  import Lane from "../components/board/Lane.svelte";
  import { LANES, LANE_NAME, buildLanes, timeOf, type CardActions, type LaneKey, type Row } from "../components/board/rows";
  import SetLanguagePopover from "../components/SetLanguagePopover.svelte";

  interface LangTarget {
    videoId: string;
    channel: string;
    title: string;
    anchor: HTMLElement;
  }

  interface Props {
    onnavigate: (id: "board" | "videos" | "review" | "history") => void;
    onsettings: () => void;
  }

  let { onnavigate, onsettings }: Props = $props();

  const COLUMN_KEYS: Partial<Record<string, Column>> = { n: "next", l: "later", d: "done", i: "inbox" };
  const HINT: Record<LaneKey, string> = {
    inbox: "Open YouTube videos and saved ones land here.",
    next: "Drag videos here, or use Fill to goals.",
    playing: "Nothing playing. Play Up next to start.",
    done: "Videos you finish today show up here.",
    later: "Videos you are keeping for another day.",
  };

  // Shown until the background's write lands in data.board.
  let optimistic = $state<BoardState | null>(null);
  let filter = $state<string | null>(null);
  let dragId = $state<string | null>(null);
  let slot = $state<{ lane: LaneKey; at: number } | null>(null);
  let menuId = $state<string | null>(null);
  let langTarget = $state<LangTarget | null>(null);
  let stops = $state<Partial<Record<LaneKey, string>>>({});
  let problem = $state("");
  let announcement = $state("");
  let stashNote = $state("");
  let importNote = $state("");
  let importing = $state(false);
  let now = $state(Date.now());

  const board = $derived(optimistic ?? data.board);
  const lanes = $derived(buildLanes(board, data.tabs, data.nowPlaying?.videoId ?? null, data.watched));
  const goals = $derived(data.progress.filter((row) => row.isGoal));
  const goalLangs = $derived(Object.keys(data.goals));
  const activeFilter = $derived(filter && goals.some((row) => row.lang === filter) ? filter : null);
  const shownRows = $derived.by(() => {
    const keep = (row: Row) => !activeFilter || row.lang === activeFilter;
    const out = {} as Record<LaneKey, Row[]>;
    for (const lane of LANES) out[lane] = lanes[lane].filter(keep);
    return out;
  });
  const playing = $derived(lanes.playing[0] ?? null);
  const otherTabs = $derived(data.tabs.filter((tab) => tab.tabId !== data.nowPlaying?.tabId));
  const fill = $derived(
    planSession(
      lanes.inbox.map((row) => asPlannable(row.card, row.tab ?? undefined)),
      data.progress,
      defaultBudget(data.progress),
    ),
  );
  const leftSeconds = $derived(
    activeFilter ? (data.progress.find((row) => row.lang === activeFilter)?.leftSeconds ?? 0) : data.leftToday,
  );
  const nextSeconds = $derived(columnSeconds(board, "next", activeFilter ?? undefined));
  const allNextSeconds = $derived(columnSeconds(board, "next"));
  const nextTitle = $derived(lanes.next[0]?.title ?? "");
  const playingHint = $derived(data.nowPlaying ? "Hidden by the language filter." : HINT.playing);

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(ms: number, done: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      done();
    }, ms);
    timers.add(timer);
  }
  $effect(() => () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  });

  function announce(text: string) {
    announcement = text;
  }

  function metaOf(lane: LaneKey): string {
    if (lane === "playing") return playing ? `ends ${endsAt(timeOf(playing) + (data.playing ? allNextSeconds : 0), now)}` : "";
    const rows = shownRows[lane];
    if (lane === "later") return rows.length ? `${rows.length} saved` : "";
    if (!rows.length) return "";
    const count = `${rows.length} ${rows.length === 1 ? "video" : "videos"}`;
    if (lane === "done") {
      const watched = rows.reduce((sum, row) => sum + row.watched, 0);
      return watched >= 30 ? `${count} · ${duration(watched)} watched` : count;
    }
    const unknown = rows.filter((row) => row.duration <= 0).length;
    const known = rows.reduce((sum, row) => sum + (row.duration > 0 ? timeOf(row) : 0), 0);
    if (unknown === rows.length) return `${rows.length} ${rows.length === 1 ? "video" : "videos"}`;
    // A "+" marks a total that leaves out videos whose length has not arrived; the lane's tooltip gives the count.
    return `${rows.length} ${rows.length === 1 ? "video" : "videos"} · ${duration(known)}${unknown ? "+" : ""}`;
  }

  /** Spells out what the "+" in a lane's total leaves out. */
  function metaNote(lane: LaneKey): string {
    if (lane === "playing" || lane === "later" || lane === "done") return "";
    const rows = shownRows[lane];
    const unknown = rows.filter((row) => row.duration <= 0).length;
    if (!unknown) return "";
    if (unknown === rows.length) return `${unknown} ${unknown === 1 ? "video has" : "videos have"} no length yet`;
    return `${unknown} ${unknown === 1 ? "video has" : "videos have"} no length yet, so the total leaves ${unknown === 1 ? "it" : "them"} out`;
  }

  function slotFor(lane: LaneKey): number | null {
    return lane !== "playing" && slot?.lane === lane ? slot.at : null;
  }

  function stopFor(lane: LaneKey): string | null {
    const rows = shownRows[lane];
    const remembered = stops[lane];
    if (remembered && rows.some((row) => row.videoId === remembered)) return remembered;
    return rows[0]?.videoId ?? null;
  }

  /** Runs a request; returns null and shows the problem when it fails. */
  async function attempt<T>(action: () => Promise<T>): Promise<T | null> {
    problem = "";
    try {
      return await action();
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  async function focusCard(videoId: string) {
    await tick();
    document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(videoId)}"]`)?.focus();
  }

  /** Puts a row in a column (appended when index is omitted). Shows the move at once, then lets data.board catch up. */
  async function place(row: Row, column: Column, index?: number): Promise<boolean> {
    const base = row.source === null ? upsert(board, row.card, "inbox") : board;
    const placed = move(base, row.videoId, column, index);
    optimistic = placed;
    const sent = await attempt(() =>
      row.source === null
        ? send("board:add", { videoIds: [row.videoId], column, index })
        : send("board:move", { videoId: row.videoId, column, index }),
    );
    if (sent === null) {
      if (optimistic === placed) optimistic = null;
      return false;
    }
    later(600, () => {
      if (optimistic === placed) optimistic = null;
    });
    announce(`Moved to ${LANE_NAME[column]}, position ${placed.columns[column].indexOf(row.videoId) + 1}`);
    return true;
  }

  async function play(row: Row) {
    menuId = null;
    await attempt(async () => {
      // An open tab with no card is added to Inbox first, so the background has a card to play.
      if (row.source === null) await send("board:add", { videoIds: [row.videoId], column: "inbox" });
      await send("board:play", { videoId: row.videoId });
    });
  }

  function focusTab(tabId: number) {
    void attempt(() => send("tabs:focus", { tabId }));
  }

  function open(row: Row) {
    menuId = null;
    if (row.tab) focusTab(row.tab.tabId);
    else if (row.lane !== "playing") void play(row);
  }

  async function remove(row: Row) {
    menuId = null;
    if (row.source === null) {
      announce("Not on the board");
      return;
    }
    // Inbox cards with an open tab keep the tab; everything else closes it.
    const closeTab = !(row.source === "inbox" && row.tab);
    const placed = removeCard(board, row.videoId);
    optimistic = placed;
    const sent = await attempt(() => send("board:remove", { videoId: row.videoId, closeTab }));
    if (sent === null) {
      if (optimistic === placed) optimistic = null;
      return;
    }
    announce(`Removed ${row.title}`);
  }

  async function reorder(row: Row, direction: 1 | -1) {
    if (row.lane === "playing") return;
    const column = row.lane;
    const rows = shownRows[column];
    const at = rows.findIndex((other) => other.videoId === row.videoId);
    const neighbour = rows[at + direction];
    if (!neighbour) return;
    // The board moves a card out of its column before inserting it, so the index counts the other cards.
    const others = board.columns[column].filter((id) => id !== row.videoId);
    const index = others.indexOf(neighbour.videoId) + (direction > 0 ? 1 : 0);
    if (await place(row, column, index)) void focusCard(row.videoId);
  }

  /** The card in the next lane that has rows, at the same height as the current one. */
  function sideRow(lane: LaneKey, direction: 1 | -1, index: number): Row | null {
    for (let i = LANES.indexOf(lane) + direction; i >= 0 && i < LANES.length; i += direction) {
      const rows = shownRows[LANES[i]!];
      if (rows.length) return rows[Math.min(index, rows.length - 1)] ?? null;
    }
    return null;
  }

  function onkey(event: KeyboardEvent, row: Row) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    const rows = shownRows[row.lane];
    const index = rows.findIndex((other) => other.videoId === row.videoId);

    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      const direction = key === "ArrowDown" ? 1 : -1;
      if (event.shiftKey) {
        void reorder(row, direction);
      } else {
        const target = rows[index + direction];
        if (target) void focusCard(target.videoId);
      }
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const target = sideRow(row.lane, key === "ArrowRight" ? 1 : -1, Math.max(index, 0));
      if (target) void focusCard(target.videoId);
      return;
    }
    if (key === "Escape") {
      menuId = null;
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      if (row.lane === "playing") open(row);
      else void play(row);
      return;
    }
    if (key === "Delete") {
      event.preventDefault();
      void remove(row);
      return;
    }
    if (row.lane === "playing") return;
    const column = COLUMN_KEYS[key.toLowerCase()];
    if (!column) return;
    event.preventDefault();
    if (row.source === column) {
      announce(`Already in ${LANE_NAME[column]}`);
      return;
    }
    void place(row, column).then((ok) => {
      if (ok) void focusCard(row.videoId);
    });
  }

  async function stash() {
    const result = await attempt(() => send("board:stash", {}));
    if (!result) return;
    stashNote = result.stashed ? `Stashed ${result.stashed} ${result.stashed === 1 ? "tab" : "tabs"}` : "No tabs to stash";
    later(4000, () => (stashNote = ""));
  }

  async function pullReading() {
    importing = true;
    const result = await attempt(() => send("board:import-reading", {}));
    importing = false;
    if (!result) return;
    importNote = result.added ? `Added ${result.added}` : "Nothing new on the reading list";
    later(4000, () => (importNote = ""));
  }

  async function fillToGoals() {
    const picks = fill.videos
      .map((video) => lanes.inbox.find((row) => row.videoId === video.videoId))
      .filter((row): row is Row => Boolean(row));
    for (const row of picks) {
      if (!(await place(row, "next"))) break;
    }
  }

  function playUpNext() {
    void attempt(() => send("board:play", {}));
  }

  function pause() {
    void attempt(() => send("board:pause", {}));
  }

  function skip() {
    void attempt(() => send("board:skip", {}));
  }

  function onwindowkey(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], dialog")) return;
    const key = event.key.toLowerCase();
    if (key === "s" && otherTabs.length) {
      event.preventDefault();
      void stash();
    } else if (key === "p" && !data.playing && lanes.next.length) {
      event.preventDefault();
      playUpNext();
    }
  }

  function dragStart(event: DragEvent, row: Row) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", row.videoId);
    event.dataTransfer.effectAllowed = "move";
    dragId = row.videoId;
    menuId = null;
  }

  function dragEnd() {
    dragId = null;
    slot = null;
  }

  function dragOver(event: DragEvent, lane: LaneKey) {
    if (!dragId) return;
    event.preventDefault();
    if (lane === "playing") {
      slot = { lane, at: 0 };
      return;
    }
    const list = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(".list");
    const cards = [...(list?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [])].filter(
      (card) => card.dataset.cardId !== dragId,
    );
    let at = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const box = cards[i]!.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        at = i;
        break;
      }
    }
    if (slot?.lane !== lane || slot.at !== at) slot = { lane, at };
  }

  function drop(event: DragEvent, lane: LaneKey) {
    event.preventDefault();
    const id = dragId;
    const at = slot?.lane === lane ? slot.at : null;
    dragId = null;
    slot = null;
    if (!id) return;
    const row = LANES.flatMap((name) => lanes[name]).find((other) => other.videoId === id);
    if (!row) return;
    if (lane === "playing") {
      void play(row);
      return;
    }
    const before = at === null ? undefined : shownRows[lane].filter((other) => other.videoId !== id)[at];
    const others = board.columns[lane].filter((other) => other !== id);
    const index = before ? others.indexOf(before.videoId) : undefined;
    void place(row, lane, index).then((ok) => {
      if (ok) void focusCard(id);
    });
  }

  const actions: CardActions = {
    open,
    play: (row) => void play(row),
    move: (row, column) => {
      menuId = null;
      void place(row, column);
    },
    setLang: (row, anchor) => {
      menuId = null;
      langTarget = { videoId: row.videoId, channel: row.card.channel, title: row.title, anchor };
    },
    remove: (row) => void remove(row),
    follow: (row) => {
      menuId = null;
      void attempt(() => send("channels:follow", { videoId: row.videoId })).then((result) => {
        if (!result) return;
        stashNote = `Following ${result.name}${result.added ? `, ${result.added} new in Inbox` : ""}`;
        later(4000, () => (stashNote = ""));
      });
    },
    menu: (row) => {
      menuId = menuId === row.videoId ? null : row.videoId;
    },
    key: onkey,
    focus: (row) => {
      stops = { ...stops, [row.lane]: row.videoId };
    },
    dragstart: dragStart,
    dragend: dragEnd,
  };
</script>

<svelte:window onkeydown={onwindowkey} />

<section class="board" aria-busy={!data.loaded}>
  {#if data.loaded}
    <h1 class="sr-only">Board</h1>

    <div class="top">
      <div class="stat">
        {#if goals.length}
          <p class="eyebrow">{activeFilter ? `Left today in ${englishName(activeFilter)}` : "Left today"}</p>
          <p class="big">{minutes(leftSeconds)}<span class="unit">min</span></p>
          <p class="sentence">Up next covers {minutes(nextSeconds)} min of it</p>
        {:else}
          <div class="copy">
            <h2 class="headline">Set a daily goal</h2>
            <p class="sentence">Goals decide how much of each language a plan includes.</p>
            <button class="btn small" type="button" onclick={onsettings}>Set a goal</button>
          </div>
        {/if}
      </div>

      {#if goals.length}
        <div class="chips" class:filtering={activeFilter !== null} role="group" aria-label="Filter by language">
          <button class="goal all" type="button" aria-pressed={activeFilter === null} onclick={() => (filter = null)}>All</button>
          {#each goals as row (row.lang)}
            {@const share = row.goalMinutes > 0 ? Math.min(100, Math.round((1 - row.leftSeconds / (row.goalMinutes * 60)) * 100)) : 100}
            <button
              class="goal"
              type="button"
              style:--c={langColor(row.lang)}
              aria-pressed={activeFilter === row.lang}
              onclick={() => (filter = activeFilter === row.lang ? null : row.lang)}
            >
              <span class="goal-top">
                <LangName lang={row.lang} />
                <span class="count">{row.done ? "Done" : `${minutes(row.leftSeconds)} min left`}</span>
              </span>
              <span class="goal-bar" aria-hidden="true"><i style:width="{share}%"></i></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if stashNote}
      <p class="note" role="status">{stashNote}</p>
    {:else if otherTabs.length}
      <div class="stash">
        <p class="stash-text">
          <b>{otherTabs.length} YouTube {otherTabs.length === 1 ? "tab" : "tabs"} open</b>
          <span class="dim">They move to Inbox with their place saved, and the tabs close.</span>
        </p>
        <button class="btn small" type="button" onclick={stash}>Stash all tabs</button>
      </div>
    {/if}

    {#if problem}
      <p class="problem" role="alert">Could not do that. {problem}</p>
    {/if}

    <div class="lanes">
      <Lane
        lane="inbox"
        title={LANE_NAME.inbox}
        meta={metaOf("inbox")}
        metaNote={metaNote("inbox")}
        rows={shownRows.inbox}
        hint={HINT.inbox}
        slot={slotFor("inbox")}
        {dragId}
        stop={stopFor("inbox")}
        {menuId}
        targeted={slot?.lane === "inbox"}
        {actions}
        onover={dragOver}
        ondrop={drop}
      >
        {#snippet footer()}
          <button class="btn ghost small" type="button" disabled={importing} onclick={pullReading}>Pull in reading list</button>
          {#if importNote}<span class="dim" role="status">{importNote}</span>{/if}
          <button class="link" type="button" onclick={() => onnavigate("videos")}>All videos →</button>
        {/snippet}
      </Lane>

      <Lane
        lane="next"
        title={LANE_NAME.next}
        meta={metaOf("next")}
        metaNote={metaNote("next")}
        rows={shownRows.next}
        hint={HINT.next}
        slot={slotFor("next")}
        {dragId}
        stop={stopFor("next")}
        {menuId}
        targeted={slot?.lane === "next"}
        {actions}
        onover={dragOver}
        ondrop={drop}
      >
        {#snippet top()}
          {#if !data.playing}
            <button class="btn play" type="button" disabled={!lanes.next.length} onclick={playUpNext}>
              {allNextSeconds ? `Play ${minutes(allNextSeconds)} min →` : "Play →"}
            </button>
          {/if}
        {/snippet}
        {#snippet footer()}
          <button class="btn ghost small" type="button" disabled={!fill.videos.length} onclick={fillToGoals}>Fill to goals</button>
          <span class="dim">{fill.videos.length ? `Adds ${minutes(fill.seconds)} min` : data.leftToday > 0 ? "Nothing in Inbox for the goals left" : "Goals are covered"}</span>
        {/snippet}
      </Lane>

      <Lane
        lane="playing"
        title={LANE_NAME.playing}
        meta={metaOf("playing")}
        rows={shownRows.playing}
        hint={playingHint}
        slot={null}
        {dragId}
        stop={stopFor("playing")}
        {menuId}
        targeted={slot?.lane === "playing"}
        {actions}
        onover={dragOver}
        ondrop={drop}
      >
        {#snippet footer()}
          {#if data.playing}
            <button class="btn small" class:inverse={shownRows.playing.length > 0} type="button" onclick={pause}>Pause session</button>
            <button class="btn ghost small" type="button" onclick={skip}>Skip</button>
            <p class="caption">{nextTitle ? `Next: ${nextTitle}` : "Nothing after this one"}</p>
          {/if}
        {/snippet}
      </Lane>

      <Lane
        lane="done"
        title={LANE_NAME.done}
        meta={metaOf("done")}
        metaNote={metaNote("done")}
        rows={shownRows.done}
        hint={HINT.done}
        slot={slotFor("done")}
        {dragId}
        stop={stopFor("done")}
        {menuId}
        targeted={slot?.lane === "done"}
        {actions}
        onover={dragOver}
        ondrop={drop}
      />

      <Lane
        lane="later"
        title={LANE_NAME.later}
        meta={metaOf("later")}
        metaNote={metaNote("later")}
        rows={shownRows.later}
        hint={HINT.later}
        slot={slotFor("later")}
        {dragId}
        stop={stopFor("later")}
        {menuId}
        targeted={slot?.lane === "later"}
        {actions}
        onover={dragOver}
        ondrop={drop}
      >
        {#snippet footer()}
          <span class="dim">Drop here to close the tab and keep the video</span>
        {/snippet}
      </Lane>
    </div>

    {#if langTarget}
      <SetLanguagePopover
        videoId={langTarget.videoId}
        channel={langTarget.channel}
        title={langTarget.title}
        anchor={langTarget.anchor}
        suggested={goalLangs}
        onclose={() => (langTarget = null)}
      />
    {/if}

    <p class="sr-only" aria-live="polite">{announcement}</p>
  {/if}
</section>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: 24px;
    height: calc(100dvh - 64px);
    min-height: 560px;
    padding: 24px var(--gutter) 24px;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px 32px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .big {
    margin: 0;
    font-size: 72px;
    font-weight: 800;
    letter-spacing: -0.06em;
    line-height: 0.8;
    font-variant-numeric: tabular-nums;
  }

  .big .unit {
    margin-left: 4px;
    font-size: 0.38em;
    letter-spacing: -0.02em;
  }

  .sentence {
    max-width: 30em;
    margin: 2px 0 0;
    color: var(--dim);
    font-size: 15px;
    line-height: 1.35;
  }

  .copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .copy .sentence {
    margin: 0 0 8px;
  }

  .headline {
    margin: 0;
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
  }

  .goal {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    min-width: 150px;
    min-height: 3.5rem;
    padding: 10px 14px;
    border: 0;
    border-radius: 16px;
    background: var(--raised);
    box-shadow: var(--lift);
    text-align: start;
    transition: box-shadow 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
  }

  .goal:hover {
    box-shadow: 0 0 0 1px var(--line-2), 0 8px 20px -12px var(--shadow);
  }

  .goal:not(.all)[aria-pressed="true"] {
    background: color-mix(in srgb, var(--c) 14%, var(--raised));
    box-shadow: 0 0 0 1.5px var(--c), 0 8px 20px -12px var(--c);
  }

  /* While one language is picked, the others step back. */
  /* While one language is picked, the others drop to an outline; their text stays readable. */
  .filtering .goal:not([aria-pressed="true"]) {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .filtering .goal:not([aria-pressed="true"]):hover {
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .filtering .goal:not([aria-pressed="true"]) .goal-bar {
    opacity: 0.4;
  }

  /* "All" matches the other chips while everything is included, and goes quiet once a language is picked. */
  .goal.all {
    min-width: 0;
    align-items: center;
    padding: 0 18px;
    font-size: 14px;
    font-weight: 700;
  }

  .filtering .goal.all {
    color: var(--dim);
  }

  .filtering .goal.all:hover {
    color: var(--ink);
  }

  .goal-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .goal-top :global(.native) {
    font-size: 17px;
  }

  .goal .count {
    color: var(--dim);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .goal-bar {
    display: block;
    height: 4px;
    border-radius: var(--pill);
    background: color-mix(in srgb, var(--c) 20%, var(--soft));
    overflow: hidden;
  }

  .goal-bar i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c);
  }

  .stash {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 12px 12px 20px;
    border-radius: var(--r-md);
    background: var(--soft);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .stash-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    font-size: 14px;
  }

  .note {
    margin: 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .problem {
    margin: 0;
    font-size: 14px;
    color: var(--danger);
  }

  .lanes {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
  }

  .play {
    flex: 1;
  }

  .inverse {
    background: var(--on-ink);
    color: var(--ink);
  }

  .caption {
    margin: 0;
    font-size: 13px;
    opacity: 0.8;
  }

  .link {
    padding: 0 4px;
    border: 0;
    background: none;
    font-size: 14px;
    color: var(--dim);
  }

  .link:hover {
    color: var(--ink);
    text-decoration: underline;
  }

  /* The one horizontal scroll allowed: columns keep a usable width and snap into view. */
  @media (max-width: 1360px) {
    .lanes {
      display: flex;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
    }
  }

  @media (max-width: 720px) {
    .board {
      height: auto;
      min-height: calc(100dvh - 64px);
      padding-top: 16px;
    }

    /* Bleeds to the screen edges so rings and shadows are not clipped by the scroller. */
    .chips {
      flex-wrap: nowrap;
      max-width: none;
      margin: -6px calc(var(--gutter) * -1);
      padding: 6px var(--gutter) 12px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .goal {
      flex: none;
    }

    .lanes {
      min-height: 460px;
    }
  }
</style>
