<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { confirm } from "@tauri-apps/plugin-dialog";
  import { store } from "./lib/store.svelte";
  import { settings } from "./lib/settings.svelte";
  import LinkModal from "./lib/LinkModal.svelte";
  import SearchOverlay from "./lib/SearchOverlay.svelte";
  import type { Link } from "./lib/types";

  // ─── State ────────────────────────────────────────────────────────────────
  let urlInput = $state("");
  let searchOpen = $state(false);
  let activeLink = $state<Link | null>(null);
  let urlInputEl = $state<HTMLInputElement | undefined>(undefined);

  // ─── Init ─────────────────────────────────────────────────────────────────
  onMount(async () => {
    await settings.init();

    // Try to open from CLI arg first
    const initialPath = await invoke<string | null>("get_initial_file");
    if (initialPath) {
      await store.openPath(initialPath);
    } else if (settings.lastOpenedFile) {
      await store.openPath(settings.lastOpenedFile);
    }
  });

  // ─── Auto-save (debounced 1.5 s) ──────────────────────────────────────────
  $effect(() => {
    if (!store.filePath || !store.dirty) return;
    const data = store.data;
    const path = store.filePath;
    const timer = setTimeout(() => store.persist(path, data), 1500);
    return () => clearTimeout(timer);
  });

  // ─── Menu actions from Rust ───────────────────────────────────────────────
  $effect(() => {
    const unlisten = listen<string>("menu-action", async ({ payload: id }) => {
      if (id === "open") {
        await store.open();
      } else if (id === "save") {
        await store.save();
      } else if (id === "save_as") {
        await store.saveAs();
      } else if (id === "quit") {
        if (store.dirty) {
          const ok = await confirm("Save changes before quitting?", {
            title: "Unsaved changes",
            kind: "warning",
          });
          if (ok) await store.save();
        }
        invoke("close_app");
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  });

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchOpen = !searchOpen;
    }
  }

  // ─── Add link ─────────────────────────────────────────────────────────────
  async function addLink() {
    const url = urlInput.trim();
    if (!url) return;
    urlInput = "";

    // Ensure we have a file to save to
    if (!store.filePath) {
      await store.saveAs();
      if (!store.filePath) return; // user cancelled
    }

    const link = store.addLink({ url, title: "", note: "", tags: [] });
    activeLink = link;
  }

  function onUrlKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") addLink();
  }

  function openLink(link: Link) {
    activeLink = link;
  }

  function closeModal() {
    activeLink = null;
    // Persist after closing the modal
    if (store.filePath && store.dirty) {
      store.save();
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app">
  <!-- ─── Toolbar ─────────────────────────────────────────────────────────── -->
  {#if searchOpen}
    <SearchOverlay
      links={store.sortedLinks}
      onselect={(link) => {
        searchOpen = false;
        activeLink = link;
      }}
      onclose={() => (searchOpen = false)}
    />
  {:else}
    <div class="toolbar">
      <input
        bind:this={urlInputEl}
        bind:value={urlInput}
        type="url"
        placeholder="Paste a URL to bookmark…"
        class="url-input"
        onkeydown={onUrlKeydown}
      />
      <button class="btn-add" onclick={addLink} disabled={!urlInput.trim()}>
        Add
      </button>
      <button
        class="btn-search"
        onclick={() => (searchOpen = true)}
        title="Quick Search (Ctrl+K)"
      >
        ⌕
      </button>
    </div>

    <!-- ─── File info bar ────────────────────────────────────────────────── -->
    {#if !store.filePath}
      <div class="no-file-hint">
        No data file open.
        <button class="link-btn" onclick={() => store.open()}
          >Open a file</button
        >
        or
        <button class="link-btn" onclick={() => store.saveAs()}
          >create a new one</button
        >.
      </div>
    {/if}

    <!-- ─── Link list ────────────────────────────────────────────────────── -->
    <div class="link-list">
      {#if store.sortedLinks.length === 0 && store.filePath}
        <div class="empty">
          No bookmarks yet. Paste a URL above to get started.
        </div>
      {/if}

      {#each store.sortedLinks as link (link.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="link-card" onclick={() => openLink(link)}>
          <div class="link-top">
            <span class="link-id">#{link.id}</span>
            <span class="link-title">{link.title || "(untitled)"}</span>
            <span class="link-date">{formatDate(link.lastUpdated)}</span>
          </div>
          {#if link.tags.length > 0}
            <div class="link-tags">
              {#each link.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
          {#if link.note}
            <div class="link-note">
              {link.note.slice(0, 200)}{link.note.length > 200 ? "…" : ""}
            </div>
          {/if}
          <div class="link-url">{link.url}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- ─── Link Modal ────────────────────────────────────────────────────────── -->
{#if activeLink}
  <LinkModal link={activeLink} onclose={closeModal} />
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
    overflow: hidden;
  }

  /* ─── Toolbar ─────────────────────────────────────────────────────────── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .url-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 14px;
    font-family: var(--font-mono);
    padding: 7px 12px;
    transition: border-color 0.15s;
  }

  .url-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .url-input::placeholder {
    color: var(--text-dim);
  }

  .btn-add {
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-mono);
    padding: 7px 16px;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .btn-add:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-add:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-search {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 18px;
    padding: 4px 10px;
    transition:
      color 0.15s,
      border-color 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }

  .btn-search:hover {
    color: var(--text);
    border-color: var(--accent);
  }

  /* ─── No file hint ────────────────────────────────────────────────────── */
  .no-file-hint {
    padding: 8px 16px;
    font-size: 13px;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    font-family: var(--font-mono);
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-mono);
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ─── Link list ───────────────────────────────────────────────────────── */
  .link-list {
    flex: 1;
    overflow-y: auto;
  }

  .empty {
    padding: 48px 24px;
    text-align: center;
    color: var(--text-dim);
    font-size: 14px;
    font-family: var(--font-mono);
  }

  .link-card {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.1s;
  }

  .link-card:hover {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }

  .link-top {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .link-id {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .link-title {
    font-size: 15px;
    color: var(--text);
    flex: 1;
    min-width: 0;
  }

  .link-date {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .link-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }

  .tag {
    font-size: 11px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border-radius: 4px;
    padding: 1px 7px;
    font-family: var(--font-mono);
  }

  .link-note {
    font-size: 13px;
    color: var(--text-dim);
    white-space: pre-wrap;
    word-break: break-word;
    margin-bottom: 4px;
    font-family: var(--font-mono);
  }

  .link-url {
    font-size: 12px;
    color: var(--accent);
    font-family: var(--font-mono);
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
