<script lang="ts">
  import { store } from "./store.svelte";
  import { settings } from "./settings.svelte";
  import BookmarkPanel from "./BookmarkPanel.svelte";
  import { fuzzyScore } from "./utils";
  import { bookmarks } from "./bookmarks.svelte";

  let listEl = $state<HTMLDivElement | null>(null);
  let searchEl = $state<HTMLInputElement | null>(null);

  function fileName(path: string) {
    return path.split("/").at(-1) ?? path;
  }

  let search = $state("");

  const filtered = $derived.by(() => {
    const q = search.trim();
    if (!q) return store.sortedBookmarks;
    return store.sortedBookmarks
      .map((b) => ({
        b,
        score: Math.max(
          fuzzyScore(q, b.title) * 3,
          fuzzyScore(q, b.url) * 2,
          ...b.tags.map((t) => fuzzyScore(q, t) * 2.5),
          fuzzyScore(q, b.note),
          fuzzyScore(q, String(b.id)),
        ),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.b);
  });

  $effect(() => {
    filtered;
    if (listEl) {
      listEl.scrollTop = 0;
    }
  });

  const onSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      search = "";
    }
  };

  const onkeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      searchEl?.focus();
    }
  };
</script>

<svelte:window {onkeydown} />

<!-- Toolbar -->
<div
  class="flex items-center gap-2 px-3 py-2 border-b border-base-300 shrink-0"
>
  <input
    type="search"
    bind:value={search}
    onkeydown={onSearchKeyDown}
    placeholder="Search bookmarks…"
    class="input input-sm flex-1 min-w-0"
    bind:this={searchEl}
  />
  {#if settings.recentWorkspaces.length > 0}
    <div class="dropdown dropdown-end shrink-0">
      <button
        tabindex="0"
        class="btn btn-sm btn-ghost"
        title="Switch workspace"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-3 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 rounded-box z-50 shadow border border-base-300 w-72 p-1 mt-1"
      >
        {#each settings.recentWorkspaces as path (path)}
          <li>
            <div
              class="flex items-center gap-1 px-2 py-1 rounded-btn {store.filePath ===
              path
                ? 'bg-base-content/10'
                : ''}"
            >
              <button
                class="flex items-center gap-2 text-left flex-1 min-w-0 hover:text-base-content"
                onclick={() => {
                  store.openPath(path);
                  (document.activeElement as HTMLElement)?.blur();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-3.5 shrink-0 opacity-60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                  />
                </svg>
                <span class="truncate flex-1 text-sm">{fileName(path)}</span>
                {#if store.filePath === path}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                {/if}
              </button>
              <button
                class="btn btn-ghost btn-xs shrink-0 opacity-40 hover:opacity-100 hover:btn-error"
                title="Remove from recents"
                onclick={(e) => {
                  e.stopPropagation();
                  if (store.filePath === path) store.close();
                  settings.removeRecentWorkspace(path);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  <button
    class="btn btn-sm btn-primary shrink-0"
    onclick={bookmarks.showAddDialog}>+ Add</button
  >
</div>

<!-- Split pane -->
<div class="flex flex-1 overflow-hidden">
  <!-- List -->
  <div
    class="flex flex-col overflow-y-auto border-r border-base-300"
    style="width: 300px; min-width: 220px;"
    bind:this={listEl}
  >
    {#if filtered.length === 0 && store.filePath}
      <div class="py-12 px-4 text-center text-base-content/60 text-sm">
        {search
          ? "No results."
          : "No bookmarks yet. Click + Add to get started."}
      </div>
    {/if}
    {#each filtered as b (b.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="px-3 py-3 border-b border-base-300 cursor-pointer transition-colors hover:bg-base-200 {bookmarks
          .activeBookmark?.id === b.id
          ? 'bg-base-200'
          : ''}"
        onclick={() => (bookmarks.activeBookmark = b)}
      >
        <div class="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span class="text-xs text-base-content/50 font-mono shrink-0"
            >#{b.id}</span
          >
          <span
            class="text-sm font-medium flex-1 min-w-0 truncate"
            title={b.title || "(untitled)"}>{b.title || "(untitled)"}</span
          >
        </div>
        {#if b.tags.length > 0}
          <div class="flex flex-wrap gap-1 mb-2">
            {#each b.tags as tag}
              <span class="badge badge-outline badge-xs">{tag}</span>
            {/each}
          </div>
        {/if}
        <div class="text-xs text-primary font-mono truncate opacity-70 mb-1">
          {b.url}
        </div>
        {#if b.note}
          <div
            class="text-xs text-base-content/50 mt-1 line-clamp-3 whitespace-pre-wrap"
          >
            {b.note}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Detail panel -->
  <div class="flex-1 overflow-hidden">
    {#if bookmarks.activeBookmark}
      {#key bookmarks.activeBookmark.id}
        <BookmarkPanel
          bookmark={store.data.bookmarks.find(
            (b) => b.id === bookmarks.activeBookmark!.id,
          ) ?? bookmarks.activeBookmark}
          onclose={() => (bookmarks.activeBookmark = null)}
        />
      {/key}
    {:else}
      <div
        class="h-full flex items-center justify-center text-base-content/40 text-sm"
      >
        Select a bookmark to view it
      </div>
    {/if}
  </div>
</div>

<style></style>
