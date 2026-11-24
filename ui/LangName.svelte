<script lang="ts">
  import { englishName, isCjk, nativeName } from "../lib/languages";

  let { lang, class: className = "" }: { lang: string | null; class?: string } = $props();
</script>

<span class="native {className}" class:cjk={isCjk(lang)} lang={lang ?? undefined} title={englishName(lang)}>{nativeName(lang)}</span>
