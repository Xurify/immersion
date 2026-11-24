<script lang="ts">
  import { uid } from "../../../lib/format";
  import { send } from "../../../lib/messages";
  import LanguagePicker from "../../../ui/LanguagePicker.svelte";
  import Popover from "../../../ui/Popover.svelte";

  let {
    videoId,
    channel,
    title,
    anchor,
    suggested,
    onclose,
  }: {
    videoId: string;
    channel: string;
    title: string;
    anchor: HTMLElement;
    suggested: string[];
    onclose: () => void;
  } = $props();

  const scopeName = uid();
  let chosen = $state<"video" | "channel" | null>(null);
  // Whole channel is the default, so one fix covers the rest of that channel's videos.
  const scope = $derived(chosen ?? (channel ? "channel" : "video"));
  let problem = $state("");

  async function pick(lang: string) {
    problem = "";
    try {
      await send("lang:override", { videoId, channel, lang, scope });
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
      return;
    }
    onclose();
  }
</script>

<Popover {anchor} label="Set language" {onclose}>
  <div class="set">
    <p class="heading">Set language</p>
    <p class="for">{title}</p>

    <div class="scope" role="radiogroup" aria-label="Apply to">
      <label class="seg" class:on={scope === "video"}>
        <input type="radio" name={scopeName} value="video" checked={scope === "video"} onchange={() => (chosen = "video")} />
        <span class="seg-text">This video</span>
      </label>
      <label class="seg" class:on={scope === "channel"} class:off={!channel}>
        <input
          type="radio"
          name={scopeName}
          value="channel"
          checked={scope === "channel"}
          disabled={!channel}
          onchange={() => (chosen = "channel")}
        />
        <span class="seg-text">
          Whole channel{#if channel}<span class="channel">{` (${channel})`}</span>{/if}
        </span>
      </label>
    </div>

    <LanguagePicker label="Language" {suggested} onpick={pick} />

    {#if problem}
      <p class="problem" role="alert">Could not save that. {problem}</p>
    {/if}
  </div>
</Popover>

<style>
  .set {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .heading {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .for {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--dim);
    font-size: 13px;
    line-height: 1.35;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }

  .scope {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: var(--pill);
    background: var(--soft);
  }

  .seg {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    border-radius: var(--pill);
    color: var(--dim);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .seg.on {
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 1px 2px var(--shadow);
  }

  .seg.off {
    opacity: 0.5;
    cursor: default;
  }

  .seg:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .seg input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }

  .seg-text {
    min-width: 0;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel {
    font-weight: 500;
    opacity: 0.8;
  }

  .problem {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
</style>
