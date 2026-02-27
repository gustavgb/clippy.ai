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

<div class="search-bar">
  <input
    bind:this={inputEl}
    bind:value={query}
    type="text"
    placeholder="Search by title, URL, tags, note, or #id…"
    class="search-input"
    onkeydown={handleKeydown}
  />
  <button class="btn-close" onclick={onclose} title="Close search (Esc)">
    ✕
  </button>
</div>

{#if results.length > 0}
  <ul class="results">
    {#each results as link (link.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <li class="result-item" onclick={() => onselect(link)}>
        <div class="result-header">
          <span class="result-id">#{link.id}</span>
          <span class="result-title">{link.title || link.url}</span>
          {#if link.tags.length > 0}
            <span class="result-tags">{link.tags.join(", ")}</span>
          {/if}
        </div>
        <div class="result-url">{link.url}</div>
        {#if link.note}
          <div class="result-note">
            {link.note.slice(0, 120)}{link.note.length > 120 ? "…" : ""}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{:else if query.trim()}
  <div class="no-results">No results for "{query}"</div>
{/if}

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text);
    font-size: 15px;
    font-family: var(--font-mono);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-dim);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    transition: color 0.15s;
    flex-shrink: 0;
  }

  .btn-close:hover {
    color: var(--text);
  }

  .results {
    list-style: none;
    overflow-y: auto;
    flex: 1;
  }

  .result-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.1s;
  }

  .result-item:hover {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .result-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
    flex-wrap: wrap;
  }

  .result-id {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .result-title {
    font-size: 14px;
    color: var(--text);
    font-weight: 500;
    word-break: break-word;
  }

  .result-tags {
    font-size: 11px;
    color: var(--accent);
    font-family: var(--font-mono);
  }

  .result-url {
    font-size: 12px;
    color: var(--accent);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.75;
  }

  .result-note {
    font-size: 12px;
    color: var(--text-dim);
    margin-top: 3px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .no-results {
    padding: 32px 16px;
    color: var(--text-dim);
    text-align: center;
    font-size: 14px;
    font-family: var(--font-mono);
  }
</style>
