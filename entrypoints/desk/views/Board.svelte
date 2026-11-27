<script lang="ts">
  import { tick } from "svelte";
  import { data } from "../../../lib/data.svelte";
  import {
    asPlannable,
    columnSeconds,
    move,
    remove as removeCard,
    stashesLang,
    stashKeepTabIds,
    upsert,
    type Board as BoardState,
    type Column,
  } from "../../../lib/board";
  import { clock, duration, endsAt, minutes, thumbnail } from "../../../lib/format";
  import { englishName } from "../../../lib/languages";
  import { langColor } from "../../../lib/colors.svelte";
  import { send } from "../../../lib/messages";
  import { defaultBudget, planSession } from "../../../lib/plan";
  import GoalRing, { type RingSegment } from "../../../ui/GoalRing.svelte";
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
    playing: "Drop a video here to play, or start Up next.",
    done: "Videos you finish today show up here.",
    later: "Videos you are keeping for another day.",
  };

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
  let playingThumbFailed = $state(false);

  const board = $derived(optimistic ?? data.board);
  const lanes = $derived(buildLanes(board, data.tabs, data.nowPlaying?.videoId ?? null, data.watched));
  const goals = $derived(data.progress.filter((progressRow) => progressRow.isGoal));
  const doneGoalsCount = $derived(goals.filter((progressRow) => progressRow.done).length);
  const allMet = $derived(goals.length > 0 && doneGoalsCount === goals.length);
  const goalLangs = $derived(Object.keys(data.goals));
  const activeFilter = $derived(filter && goals.some((progressRow) => progressRow.lang === filter) ? filter : null);

  const shownRows = $derived.by((): Record<LaneKey, Row[]> => {
    const keep = (row: Row): boolean => !activeFilter || row.lang === activeFilter;
    const output = {} as Record<LaneKey, Row[]>;
    for (const lane of LANES) output[lane] = lanes[lane].filter(keep);
    return output;
  });

  const playing = $derived(lanes.playing[0] ?? null);
  const shownPlaying = $derived(shownRows.playing[0] ?? null);
  const playingColor = $derived(langColor(shownPlaying?.lang ?? null));
  const playingPercent = $derived(
    shownPlaying && shownPlaying.duration > 0 ? Math.min(100, (shownPlaying.position / shownPlaying.duration) * 100) : 0,
  );
  const playingEndsText = $derived(
    shownPlaying ? `ends ${endsAt(timeOf(shownPlaying) + (data.playing ? columnSeconds(board, "next") : 0), now)}` : "",
  );

  $effect(() => {
    void shownPlaying?.videoId;
    playingThumbFailed = false;
  });

  const otherTabs = $derived.by(() => {
    const keep = stashKeepTabIds(data.playing, data.tabs, goalLangs);
    return data.tabs.filter((tab) => !keep.includes(tab.tabId) && stashesLang(tab.lang, goalLangs));
  });

  const fill = $derived(
    planSession(
      lanes.inbox.map((row) => asPlannable(row.card, row.tab ?? undefined)),
      data.progress,
      defaultBudget(data.progress),
    ),
  );

  const filteredGoal = $derived(activeFilter ? goals.find((progressRow) => progressRow.lang === activeFilter) ?? null : null);
  const leftSeconds = $derived(filteredGoal ? filteredGoal.leftSeconds : data.leftToday);
  const totalListenedMinutes = $derived(
    Math.floor(
      (filteredGoal ? [filteredGoal] : goals).reduce(
        (accumulator, progressRow) => accumulator + progressRow.listenedSeconds,
        0,
      ) / 60,
    ),
  );
  const ringRows = $derived(filteredGoal ? [filteredGoal] : goals);
  const ringSegments = $derived<RingSegment[]>(
    ringRows.map((progressRow) => ({
      lang: progressRow.lang,
      weight: Math.max(progressRow.goalMinutes, 1),
      percent:
        progressRow.goalMinutes > 0
          ? Math.min(100, (progressRow.listenedSeconds / (progressRow.goalMinutes * 60)) * 100)
          : 100,
    })),
  );
  const ringDoneCount = $derived(ringRows.filter((progressRow) => progressRow.done).length);
  const ringAllMet = $derived(ringRows.length > 0 && ringDoneCount === ringRows.length);
  const ringOverallPercent = $derived.by((): number => {
    if (ringRows.length === 0) return 0;
    if (ringAllMet) return 100;
    const totalGoalMinutes = ringRows.reduce((accumulator, progressRow) => accumulator + progressRow.goalMinutes, 0);
    if (totalGoalMinutes <= 0) return Math.round((ringDoneCount / ringRows.length) * 100);
    const cappedSeconds = ringRows.reduce(
      (accumulator, progressRow) => accumulator + Math.min(progressRow.listenedSeconds, progressRow.goalMinutes * 60),
      0,
    );
    return Math.min(100, Math.round((cappedSeconds / (totalGoalMinutes * 60)) * 100));
  });

  const nextSeconds = $derived(columnSeconds(board, "next", activeFilter ?? undefined));
  const allNextSeconds = $derived(columnSeconds(board, "next"));
  const nextTitle = $derived(lanes.next[0]?.title ?? "");
  const playingHint = $derived(data.nowPlaying ? "Hidden by the language filter." : HINT.playing);

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(milliseconds: number, done: () => void): void {
    const timer = setTimeout(() => {
      timers.delete(timer);
      done();
    }, milliseconds);
    timers.add(timer);
  }
  $effect(() => () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  });

  function announce(text: string): void {
    announcement = text;
  }

  function metaOf(lane: LaneKey): string {
    if (lane === "playing") return playingEndsText;
    const rows = shownRows[lane];
    if (lane === "later") return rows.length ? `${rows.length} saved` : "";
    if (!rows.length) return "";
    if (lane === "done") {
      const watched = rows.reduce((accumulator, row) => accumulator + row.watched, 0);
      return watched >= 30 ? `${rows.length} · ${duration(watched)}` : `${rows.length}`;
    }
    const unknown = rows.filter((row) => row.duration <= 0).length;
    const known = rows.reduce((accumulator, row) => accumulator + (row.duration > 0 ? timeOf(row) : 0), 0);
    if (unknown === rows.length) return `${rows.length} ${rows.length === 1 ? "video" : "videos"}`;
    return `${rows.length} · ${duration(known)}${unknown ? "+" : ""}`;
  }

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

  async function attempt<T>(action: () => Promise<T>): Promise<T | null> {
    problem = "";
    try {
      return await action();
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  async function focusCard(videoId: string): Promise<void> {
    await tick();
    document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(videoId)}"]`)?.focus();
  }

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

  async function play(row: Row): Promise<void> {
    menuId = null;
    await attempt(async () => {
      if (row.source === null) await send("board:add", { videoIds: [row.videoId], column: "inbox" });
      await send("board:play", { videoId: row.videoId });
    });
  }

  function focusTab(tabId: number): void {
    void attempt(() => send("tabs:focus", { tabId }));
  }

  function open(row: Row): void {
    menuId = null;
    if (row.tab) focusTab(row.tab.tabId);
    else if (row.lane !== "playing") void play(row);
  }

  async function remove(row: Row): Promise<void> {
    menuId = null;
    if (row.source === null) {
      announce("Not on the board");
      return;
    }
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

  async function reorder(row: Row, direction: 1 | -1): Promise<void> {
    if (row.lane === "playing") return;
    const column = row.lane;
    const rows = shownRows[column];
    const at = rows.findIndex((other) => other.videoId === row.videoId);
    const neighbour = rows[at + direction];
    if (!neighbour) return;
    const others = board.columns[column].filter((cardId) => cardId !== row.videoId);
    const index = others.indexOf(neighbour.videoId) + (direction > 0 ? 1 : 0);
    if (await place(row, column, index)) void focusCard(row.videoId);
  }

  function sideRow(lane: LaneKey, direction: 1 | -1, index: number): Row | null {
    for (let cursor = LANES.indexOf(lane) + direction; cursor >= 0 && cursor < LANES.length; cursor += direction) {
      const rows = shownRows[LANES[cursor]!];
      if (rows.length) return rows[Math.min(index, rows.length - 1)] ?? null;
    }
    return null;
  }

  function handleCardKey(event: KeyboardEvent, row: Row): void {
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

  async function handleStash(): Promise<void> {
    const result = await attempt(() => send("board:stash", {}));
    if (!result) return;
    stashNote = result.stashed ? `Stashed ${result.stashed} ${result.stashed === 1 ? "tab" : "tabs"}` : "No tabs to stash";
    later(4000, () => (stashNote = ""));
  }

  async function handlePullReading(): Promise<void> {
    importing = true;
    const result = await attempt(() => send("board:import-reading", {}));
    importing = false;
    if (!result) return;
    importNote = result.added ? `Added ${result.added}` : "Nothing new on the reading list";
    later(4000, () => (importNote = ""));
  }

  async function handleFillToGoals(): Promise<void> {
    const picks = fill.videos
      .map((video) => lanes.inbox.find((row) => row.videoId === video.videoId))
      .filter((row): row is Row => Boolean(row));
    for (const row of picks) {
      if (!(await place(row, "next"))) break;
    }
  }

  function handlePlayUpNext(): void {
    void attempt(() => send("board:play", {}));
  }

  function handlePause(): void {
    void attempt(() => send("board:pause", {}));
  }

  function handleSkip(): void {
    void attempt(() => send("board:skip", {}));
  }

  function handleWindowKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], dialog")) return;
    const key = event.key.toLowerCase();
    if (key === "s" && otherTabs.length) {
      event.preventDefault();
      void handleStash();
    } else if (key === "p" && !data.playing && lanes.next.length) {
      event.preventDefault();
      handlePlayUpNext();
    }
  }

  function handleDragStart(event: DragEvent, row: Row): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", row.videoId);
    event.dataTransfer.effectAllowed = "move";
    dragId = row.videoId;
    menuId = null;
  }

  function handleDragEnd(): void {
    dragId = null;
    slot = null;
  }

  function handleDragOver(event: DragEvent, lane: LaneKey): void {
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
    for (let index = 0; index < cards.length; index++) {
      const box = cards[index]!.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        at = index;
        break;
      }
    }
    if (slot?.lane !== lane || slot.at !== at) slot = { lane, at };
  }

  function handleDrop(event: DragEvent, lane: LaneKey): void {
    event.preventDefault();
    const droppedId = dragId;
    const at = slot?.lane === lane ? slot.at : null;
    dragId = null;
    slot = null;
    if (!droppedId) return;
    const row = LANES.flatMap((laneName) => lanes[laneName]).find((other) => other.videoId === droppedId);
    if (!row) return;
    if (lane === "playing") {
      void play(row);
      return;
    }
    const before = at === null ? undefined : shownRows[lane].filter((other) => other.videoId !== droppedId)[at];
    const others = board.columns[lane].filter((other) => other !== droppedId);
    const index = before ? others.indexOf(before.videoId) : undefined;
    void place(row, lane, index).then((ok) => {
      if (ok) void focusCard(droppedId);
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
    key: handleCardKey,
    focus: (row) => {
      stops = { ...stops, [row.lane]: row.videoId };
    },
    dragstart: handleDragStart,
    dragend: handleDragEnd,
  };
</script>

<svelte:window onkeydown={handleWindowKey} />

<section class="board" aria-busy={!data.loaded}>
  {#if data.loaded}
    <h1 class="sr-only">Board</h1>

    <div class="top-band">
      <div class="command-row">
        <div class={["hero-card", ringAllMet && "celebrating"]}>
          {#if goals.length}
            <div class="hero-main">
              <GoalRing
                segments={ringSegments}
                overallPercent={ringOverallPercent}
                doneCount={ringDoneCount}
                totalCount={ringRows.length}
                allMet={ringAllMet}
                size={74}
              />
              <div class="hero-copy">
                <p class="eyebrow">
                  {activeFilter
                    ? ringAllMet
                      ? `${englishName(activeFilter)} goal met`
                      : `Left today in ${englishName(activeFilter)}`
                    : allMet
                      ? "Every goal met today"
                      : "Left today"}
                </p>
                <p class="big hero-figure">
                  {ringAllMet ? totalListenedMinutes : minutes(leftSeconds)}<span class="unit">min</span>
                </p>
                <p class="hero-sub">
                  {#if ringAllMet}
                    <span>{ringRows.length} of {ringRows.length} completed</span>
                    {#if nextSeconds > 0}
                      <span aria-hidden="true">·</span>
                      <span class="num">{minutes(nextSeconds)} min in Up next</span>
                    {/if}
                  {:else}
                    <span>Up next covers {minutes(nextSeconds)} min</span>
                    <span aria-hidden="true">·</span>
                    <span class="num">{totalListenedMinutes} min listened</span>
                  {/if}
                </p>
              </div>
            </div>
          {:else}
            <div class="copy">
              <h2 class="headline">Set a daily goal</h2>
              <p class="hero-sub">Goals decide how much of each language a plan includes.</p>
              <button class="btn small" type="button" onclick={onsettings}>Set a goal</button>
            </div>
          {/if}
        </div>

        <section
          class={["player", shownPlaying ? "live" : "idle", slot?.lane === "playing" && "targeted"]}
          style:--now-c={playingColor}
          aria-labelledby="stage-title"
          ondragover={(event) => handleDragOver(event, "playing")}
          ondrop={(event) => handleDrop(event, "playing")}
        >
          {#if shownPlaying}
            <div
              class="player-hit"
              role="button"
              tabindex={stopFor("playing") === shownPlaying.videoId ? 0 : -1}
              data-card-id={shownPlaying.videoId}
              aria-label={shownPlaying.title}
              onclick={() => open(shownPlaying)}
              onfocus={() => (stops = { ...stops, playing: shownPlaying.videoId })}
              onkeydown={(event) => handleCardKey(event, shownPlaying)}
            >
              <span class="player-thumb" style:background={`linear-gradient(135deg, ${playingColor}, color-mix(in srgb, ${playingColor} 45%, #000))`}>
                {#if !playingThumbFailed}
                  <img
                    src={thumbnail(shownPlaying.videoId)}
                    alt=""
                    width="104"
                    height="58"
                    onerror={() => (playingThumbFailed = true)}
                  />
                {/if}
              </span>

              <div class="player-copy">
                <span class="player-eyebrow">
                  <span id="stage-title">Listening now</span>
                  {#if playingEndsText}
                    <span aria-hidden="true">·</span>
                    <span class="num">{playingEndsText}</span>
                  {/if}
                </span>
                <b class="player-title">{shownPlaying.title}</b>
                <span class="player-meta">
                  <i class="dot" style:background={playingColor} aria-hidden="true"></i>
                  {#if shownPlaying.lang}<LangName lang={shownPlaying.lang} />{:else}<span>Unknown</span>{/if}
                  {#if shownPlaying.card.channel}<span class="channel">· {shownPlaying.card.channel}</span>{/if}
                  {#if shownPlaying.duration > 0}
                    <span aria-hidden="true">·</span>
                    <span class="num">{clock(shownPlaying.left)} left</span>
                  {/if}
                </span>
              </div>
            </div>

            <div class="player-actions">
              {#if data.playing}
                <button class="player-btn primary" type="button" onclick={handlePause}>Pause</button>
                <button class="player-btn" type="button" onclick={handleSkip}>Skip</button>
              {:else if shownPlaying.tab}
                <button class="player-btn" type="button" onclick={() => open(shownPlaying)}>
                  Show tab
                  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                    <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              {/if}
            </div>

            <span class="player-progress" aria-hidden="true">
              <i style:width="{playingPercent}%"></i>
            </span>
          {:else}
            <div class="player-empty">
              <div class="player-empty-copy">
                <span id="stage-title" class="player-eyebrow">Listening now</span>
                <p class="player-hint">{playingHint}</p>
              </div>
              {#if !data.playing && lanes.next.length}
                <button class="player-btn primary" type="button" onclick={handlePlayUpNext}>
                  Play {allNextSeconds ? `${minutes(allNextSeconds)}m` : "Up next"}
                </button>
              {/if}
            </div>
          {/if}
        </section>
      </div>

      {#if goals.length}
        <div class="chips" class:filtering={activeFilter !== null} role="group" aria-label="Filter by language">
          <button class="goal all" type="button" aria-pressed={activeFilter === null} onclick={() => (filter = null)}>All</button>
          {#each goals as progressRow (progressRow.lang)}
            {@const share =
              progressRow.goalMinutes > 0
                ? Math.min(100, Math.round((progressRow.listenedSeconds / (progressRow.goalMinutes * 60)) * 100))
                : 100}
            {@const listened = Math.floor(progressRow.listenedSeconds / 60)}
            {@const bonus = progressRow.goalMinutes > 0 ? Math.max(0, listened - progressRow.goalMinutes) : 0}
            <button
              class={["goal", progressRow.done && "done"]}
              type="button"
              style:--c={langColor(progressRow.lang)}
              aria-pressed={activeFilter === progressRow.lang}
              onclick={() => (filter = activeFilter === progressRow.lang ? null : progressRow.lang)}
            >
              <span class="goal-top">
                <span class="goal-name">
                  {#if progressRow.done}
                    <span class="done-dot" aria-hidden="true">
                      <svg viewBox="0 0 12 12" width="9" height="9">
                        <path d="M2 6.2 4.8 9 10 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                  {/if}
                  <LangName lang={progressRow.lang} />
                </span>
                {#if progressRow.done}
                  <span class="count bonus">{bonus > 0 ? `+${bonus}m` : "Done"}</span>
                {:else}
                  <span class="count">{minutes(progressRow.leftSeconds)}m left</span>
                {/if}
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
          <b>{otherTabs.length} {otherTabs.length === 1 ? "tab" : "tabs"} open in {goalLangs.length ? "your languages" : "YouTube"}</b>
          <span class="dim">
            Moves them to Inbox with their place saved and closes the tabs.{goalLangs.length ? " Other languages stay open." : ""}
          </span>
        </p>
        <button class="btn soft small" type="button" onclick={handleStash}>Stash tabs</button>
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
        onover={handleDragOver}
        ondrop={handleDrop}
      >
        {#snippet footer()}
          <button class="btn soft small" type="button" disabled={importing} onclick={handlePullReading}>Pull reading list</button>
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
        onover={handleDragOver}
        ondrop={handleDrop}
      >
        {#snippet top()}
          {#if !data.playing}
            <button class="btn small play-cta" type="button" disabled={!lanes.next.length} onclick={handlePlayUpNext}>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M3 1.5v9l7.5-4.5z" /></svg>
              {allNextSeconds ? `Play ${minutes(allNextSeconds)} min` : "Play Up next"}
            </button>
          {/if}
        {/snippet}
        {#snippet footer()}
          <button class="btn soft small" type="button" disabled={!fill.videos.length} onclick={handleFillToGoals}>Fill to goals</button>
          <span class="dim">{fill.videos.length ? `+${minutes(fill.seconds)} min` : data.leftToday > 0 ? "Nothing matching in Inbox" : "Goals covered"}</span>
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
        onover={handleDragOver}
        ondrop={handleDrop}
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
        onover={handleDragOver}
        ondrop={handleDrop}
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
    gap: 16px;
    height: calc(100dvh - 64px);
    min-height: 580px;
    padding: 20px var(--gutter) 20px;
  }

  .top-band {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .command-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px 28px;
  }

  .hero-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .hero-card.celebrating .eyebrow {
    color: light-dark(#15803d, #4ade80);
  }

  .hero-main {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }

  .hero-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .hero-figure {
    margin: 2px 0 0;
    font-size: 46px;
    line-height: 0.88;
  }

  .hero-figure .unit {
    margin-inline-start: 4px;
    font-size: 0.36em;
    color: var(--ink-2);
  }

  .hero-sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 2px 0 0;
    color: var(--dim);
    font-size: 13px;
    font-weight: 500;
  }

  .copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .headline {
    margin: 0;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .goal {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    min-width: 126px;
    min-height: 2.75rem;
    padding: 7px 11px;
    border: 0;
    border-radius: 10px;
    background: var(--raised);
    box-shadow: var(--lift);
    text-align: start;
    transition: box-shadow 0.15s ease, background-color 0.15s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .goal:hover {
    box-shadow: 0 0 0 1px var(--line-2), 0 2px 6px -2px var(--shadow);
  }

  .goal:active {
    transform: scale(0.96);
  }

  .goal.done {
    background: light-dark(var(--raised), color-mix(in srgb, var(--c) 8%, var(--raised)));
    box-shadow: var(--lift);
  }

  .goal:not(.all)[aria-pressed="true"] {
    background: light-dark(var(--raised), color-mix(in srgb, var(--c) 14%, var(--raised)));
    box-shadow: inset 0 0 0 1.5px var(--c);
  }

  .filtering .goal:not([aria-pressed="true"]) {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line);
    opacity: 0.68;
  }

  .filtering .goal:not([aria-pressed="true"]):hover {
    opacity: 1;
  }

  .goal.all {
    min-width: 0;
    align-items: center;
    padding-inline: 13px;
    font-size: 13px;
    font-weight: 700;
  }

  .goal.all[aria-pressed="true"] {
    background: var(--ink);
    box-shadow: inset 0 0 0 1px var(--ink);
    color: var(--on-ink);
  }

  .goal-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .goal-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .done-dot {
    display: inline-grid;
    place-items: center;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    flex: none;
  }

  .goal-top :global(.native) {
    font-size: 15.5px;
  }

  .goal .count {
    color: var(--dim);
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .goal .count.bonus {
    color: light-dark(
      color-mix(in srgb, var(--c) 84%, var(--ink)),
      color-mix(in srgb, var(--c) 44%, var(--ink))
    );
  }

  .goal-bar {
    display: block;
    height: 3.5px;
    border-radius: var(--pill);
    background: color-mix(in srgb, var(--c) 20%, var(--line));
    overflow: hidden;
  }

  .goal-bar i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c);
  }

  .player {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(100%, 540px);
    min-width: 0;
    padding: 10px 12px 12px 10px;
    overflow: hidden;
    border-radius: 12px;
    transition: box-shadow 0.15s ease;
  }

  .player.live {
    background: var(--raised);
    box-shadow: var(--lift);
  }

  .player.idle {
    background: transparent;
    border: 1.5px dashed var(--line-2);
    padding: 12px 16px;
  }

  .player.targeted {
    box-shadow: inset 0 0 0 2px var(--focus);
  }

  .player-hit {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 2px;
    margin: -2px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.14s ease;
  }

  .player-hit:hover {
    background: color-mix(in srgb, var(--ink) 4%, transparent);
  }

  .player-thumb {
    flex: none;
    width: 104px;
    aspect-ratio: 16 / 9;
    border-radius: 6px;
    overflow: hidden;
    outline: 1px solid light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.12));
    outline-offset: -1px;
  }

  .player-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .player-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .player-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--dim);
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.2;
  }

  .player-title {
    overflow: hidden;
    font-size: 13.5px;
    font-weight: 700;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--dim);
    font-size: 12px;
  }

  .player-meta .dot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }

  .player-meta :global(.native) {
    color: var(--ink-2);
    font-size: 13px;
  }

  .channel {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .player-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 30px;
    padding-inline: 11px;
    border: 0;
    border-radius: 8px;
    background: light-dark(var(--bg), var(--soft));
    box-shadow: inset 0 0 0 1px var(--line-2);
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 650;
    white-space: nowrap;
    transition: background-color 0.14s ease, opacity 0.14s ease, transform 0.12s cubic-bezier(0.2, 0, 0, 1);
  }

  .player-btn:hover {
    background: var(--soft);
  }

  .player-btn.primary {
    background: var(--ink);
    box-shadow: none;
    color: var(--on-ink);
  }

  .player-btn.primary:hover {
    opacity: 0.9;
  }

  .player-btn:active {
    transform: scale(0.96);
  }

  .player-progress {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 2.5px;
    background: var(--soft);
  }

  .player-progress i {
    display: block;
    height: 100%;
    background: var(--now-c);
  }

  .player-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
  }

  .player-empty-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .player-hint {
    margin: 0;
    color: var(--dim);
    font-size: 13px;
    line-height: 1.35;
  }

  .stash {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 10px 9px 16px;
    border-radius: 12px;
    background: var(--raised-2);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .stash-text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    margin: 0;
    font-size: 13.5px;
  }

  .note {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink-2);
  }

  .problem {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--danger);
  }

  .lanes {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
  }

  .play-cta {
    flex: 1;
    min-height: 2.2rem;
    border-radius: 9px;
    font-size: 13.5px;
  }

  .link {
    margin-inline-start: auto;
    padding: 0 4px;
    border: 0;
    background: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--dim);
  }

  .link:hover {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 1100px) {
    .player {
      width: 100%;
    }

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

    .lanes {
      min-height: 460px;
    }
  }
</style>
