<script lang="ts">
  import type { Link } from "./types";

  interface Props {
    links: Link[];
    onselect: (link: Link) => void;
    onclose: () => void;
  }

  let { links, onselect, onclose }: Props = $props();

  let query = $state("");
  let inputEl: HTMLInputElement;

  // ─── Fuzzy search ─────────────────────────────────────────────────────────

  function fuzzyScore(query: string, target: string): number {
    if (!query) return 1;
    const q = query.toLowerCase();
    const t = target.toLowerCase();

    // Exact substring match gets highest score
    if (t.includes(q)) return 1000 - t.indexOf(q);

    // Character-by-character fuzzy match
    let qi = 0;
    let score = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        // Bonus for consecutive matches and matches after word boundaries
        const consecutive = lastMatch === ti - 1;
        const wordBoundary = ti === 0 || /[\s\-_.,]/.test(t[ti - 1]);
        score += consecutive ? 10 : wordBoundary ? 8 : 1;
        lastMatch = ti;
        qi++;
      }
    }
    return qi === q.length ? score : -1;
  }

  function scoreLink(q: string, link: Link): number {
    if (!q.trim()) return 0;

    // Search by ID prefix
    if (q.startsWith("#")) {
      const idQuery = q.slice(1);
      if (String(link.id).startsWith(idQuery)) return 2000;
      return -1;
    }

    const scores = [
      fuzzyScore(q, link.title) * 3,
      fuzzyScore(q, link.url) * 2,
      ...link.tags.map((t) => fuzzyScore(q, t) * 2.5),
      fuzzyScore(q, link.note),
      fuzzyScore(q, String(link.id)),
    ];

    return Math.max(...scores);
  }

  const results = $derived.by(() => {
    if (!query.trim()) return links.slice(0, 20);

    return links
      .map((link) => ({ link, score: scoreLink(query, link) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.link);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }

  // Focus input on mount
  $effect(() => {
    inputEl?.focus();
  });
</script>

<div
  class="flex items-center gap-2 px-3 py-2 border-b border-base-300 shrink-0"
>
  <input
    bind:this={inputEl}
    bind:value={query}
    type="text"
    placeholder="Search by title, URL, tags, note, or #id…"
    class="input input-sm input-ghost flex-1 font-mono"
    onkeydown={handleKeydown}
  />
  <button
    class="btn btn-ghost btn-sm btn-circle"
    onclick={onclose}
    title="Close search (Esc)">✕</button
  >
</div>

{#if results.length > 0}
  <ul class="menu p-0 overflow-y-auto flex-1">
    {#each results as link (link.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <li onclick={() => onselect(link)}>
        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="badge badge-outline badge-sm font-mono"
              >#{link.id}</span
            >
            <span class="font-medium">{link.title || link.url}</span>
            {#if link.tags.length > 0}
              <span class="text-xs text-primary font-mono"
                >{link.tags.join(", ")}</span
              >
            {/if}
          </div>
          <div class="text-xs text-primary font-mono opacity-75 truncate">
            {link.url}
          </div>
          {#if link.note}
            <div class="text-xs text-base-content/60">
              {link.note.slice(0, 120)}{link.note.length > 120 ? "…" : ""}
            </div>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{:else if query.trim()}
  <div class="py-8 text-center text-base-content/60 text-sm font-mono">
    No results for "{query}"
  </div>
{/if}

<style></style>
