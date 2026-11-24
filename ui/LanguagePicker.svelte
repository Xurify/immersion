<script lang="ts">
  import { tick } from "svelte";
  import { uid } from "../lib/format";
  import { ALL_LANGS, englishName, nativeName } from "../lib/languages";
  import { langColor } from "../lib/colors.svelte";
  import LangName from "./LangName.svelte";
  import { placeFloating } from "./place";

  interface Props {
    /** Codes to leave out, such as languages that already have a goal. */
    exclude?: string[];
    /** Listed first under "Suggested" while the search is empty. */
    suggested?: string[];
    onpick: (lang: string) => void;
    placeholder?: string;
    /** Accessible name, for when there is no visible label. */
    label?: string;
    id?: string;
  }

  let { exclude = [], suggested = [], onpick, placeholder = "Search languages", label, id = uid() }: Props = $props();

  interface Entry {
    code: string;
    english: string;
    text: string;
  }
  interface Item {
    entry: Entry;
    index: number;
  }
  interface Section {
    title: string;
    items: Item[];
  }

  // Accents folded away, so "eesti" finds "Eesti" and "slovencina" finds "Slovenčina".
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  const ENTRIES: Entry[] = ALL_LANGS.map((code) => {
    const english = englishName(code);
    return { code, english, text: fold(`${nativeName(code)} ${english} ${code}`) };
  }).sort((a, b) => a.english.localeCompare(b.english, "en"));

  let query = $state("");
  let open = $state(false);
  let active = $state(0);
  let wrap = $state<HTMLDivElement>();
  let input = $state<HTMLInputElement>();
  let menu = $state<HTMLDivElement>();
  let pos = $state({ top: 0, left: 0, width: 280 });

  const listId = $derived(`${id}-list`);
  const optionId = (index: number) => `${id}-option-${index}`;
  const needle = $derived(fold(query.trim()));

  const sections = $derived.by((): Section[] => {
    const skip = new Set(exclude);
    const matches = ENTRIES.filter((entry) => !skip.has(entry.code) && (!needle || entry.text.includes(needle)));
    const head = needle ? [] : suggested.map((code) => matches.find((entry) => entry.code === code)).filter((entry): entry is Entry => entry !== undefined);
    const headed = new Set(head.map((entry) => entry.code));
    const groups: { title: string; entries: Entry[] }[] = head.length
      ? [
          { title: "Suggested", entries: head },
          { title: "All languages", entries: matches.filter((entry) => !headed.has(entry.code)) },
        ]
      : [{ title: "", entries: matches }];
    let index = 0;
    return groups
      .filter((group) => group.entries.length > 0)
      .map((group) => ({ title: group.title, items: group.entries.map((entry) => ({ entry, index: index++ })) }));
  });
  const items = $derived(sections.flatMap((section) => section.items));

  function pick(entry: Entry) {
    onpick(entry.code);
    query = "";
    open = false;
    active = 0;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        open = true;
        active = 0;
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = Math.min(Math.max(active + step, 0), Math.max(items.length - 1, 0));
    } else if (event.key === "Enter") {
      const entry = items[active]?.entry;
      if (!open || !entry) return;
      event.preventDefault();
      pick(entry);
    } else if (event.key === "Escape" && open) {
      // Closes the list only; a second Escape reaches the popover or dialog around it.
      event.preventDefault();
      event.stopPropagation();
      open = false;
    } else if (event.key === "Tab") {
      open = false;
    }
  }

  function place() {
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    pos = { ...placeFloating(rect, width, menu?.offsetHeight ?? 0), width };
  }

  $effect(() => {
    if (!open) return;
    void items.length;
    void tick().then(place);
  });

  $effect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, { capture: true });
    };
  });

  // Clicking anywhere outside the field and its list closes the list.
  $effect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrap?.contains(event.target)) open = false;
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  });

  $effect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="picker" bind:this={wrap}>
  <input
    bind:this={input}
    bind:value={query}
    {id}
    type="text"
    role="combobox"
    class="search"
    {placeholder}
    aria-label={label}
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={open ? listId : undefined}
    aria-activedescendant={open && items[active] ? optionId(active) : undefined}
    autocomplete="off"
    spellcheck="false"
    oninput={() => {
      open = true;
      active = 0;
    }}
    onfocus={() => {
      open = true;
      active = 0;
    }}
    {onkeydown}
  />

  {#if open}
    <div class="menu" bind:this={menu} style:top="{pos.top}px" style:left="{pos.left}px" style:width="{pos.width}px">
      {#if items.length}
        <div role="listbox" id={listId} aria-label={label ?? placeholder}>
          {#each sections as section}
            <div role="group" aria-label={section.title || "Languages"}>
              {#if section.title}
                <p class="group" aria-hidden="true">{section.title}</p>
              {/if}
              {#each section.items as item (item.entry.code)}
                <div
                  role="option"
                  id={optionId(item.index)}
                  tabindex="-1"
                  class="option"
                  class:active={item.index === active}
                  aria-selected={item.index === active}
                  onpointerenter={() => (active = item.index)}
                  onpointerdown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    pick(item.entry);
                  }}
                >
                  <i class="dot" style:background={langColor(item.entry.code)} aria-hidden="true"></i>
                  <LangName lang={item.entry.code} />
                  <span class="english">{item.entry.english}</span>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {:else}
        <p class="none" role="status">No language matches “{query}”.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    min-width: 0;
  }

  .search {
    width: 100%;
    min-height: 2.5rem;
    padding: 0 1rem;
    border: 1.5px solid var(--line);
    border-radius: var(--pill);
    background: var(--raised);
    font-size: 15px;
  }

  .search:focus-visible {
    outline: none;
    border-color: var(--ink);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 35%, transparent);
  }

  .menu {
    position: fixed;
    z-index: 100;
    max-height: 320px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
    border-radius: var(--r-md);
    background: var(--raised);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--line), 0 18px 40px var(--shadow);
  }

  .group {
    margin: 4px 0 0;
    padding: 6px 10px 4px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--dim);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 6px 10px;
    border-radius: 10px;
    cursor: pointer;
  }

  .option.active {
    background: var(--soft);
  }

  .option :global(.native) {
    font-size: 18px;
    white-space: nowrap;
  }

  .english {
    min-width: 0;
    margin-left: auto;
    overflow: hidden;
    color: var(--dim);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .none {
    margin: 0;
    padding: 12px 10px;
    font-size: 14px;
    color: var(--dim);
  }
</style>
