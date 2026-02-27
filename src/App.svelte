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

<div class="flex flex-col h-full bg-base-100 overflow-hidden">
  <!-- ─── Toolbar ───────────────────────────────────────────────────────── -->
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
    <div
      class="flex items-center gap-2 px-4 py-2.5 border-b border-base-300 shrink-0"
    >
      <input
        bind:this={urlInputEl}
        bind:value={urlInput}
        type="url"
        placeholder="Paste a URL to bookmark…"
        class="input input-sm flex-1 min-w-0"
        onkeydown={onUrlKeydown}
      />
      <button
        class="btn btn-sm btn-primary shrink-0"
        onclick={addLink}
        disabled={!urlInput.trim()}>Add</button
      >
      <button
        class="btn btn-sm btn-ghost shrink-0"
        onclick={() => (searchOpen = true)}
        title="Quick Search (Ctrl+K)">⌕</button
      >
    </div>

    <!-- ─── File info bar ──────────────────────────────────────────────── -->
    {#if !store.filePath}
      <div
        class="px-4 py-2 text-xs text-base-content/60 border-b border-base-300 shrink-0"
      >
        No data file open.
        <button class="link link-primary text-xs" onclick={() => store.open()}
          >Open a file</button
        >
        or
        <button class="link link-primary text-xs" onclick={() => store.saveAs()}
          >create a new one</button
        >.
      </div>
    {/if}

    <!-- ─── Link list ──────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto">
      {#if store.sortedLinks.length === 0 && store.filePath}
        <div class="py-12 px-6 text-center text-base-content/60 text-sm">
          No bookmarks yet. Paste a URL above to get started.
        </div>
      {/if}

      {#each store.sortedLinks as link (link.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="px-4 py-3.5 border-b border-base-300 cursor-pointer transition-colors hover:bg-base-200"
          onclick={() => openLink(link)}
        >
          <div class="flex items-baseline gap-2 mb-1 flex-wrap">
            <span class="text-xs text-base-content/60 font-mono shrink-0"
              >#{link.id}</span
            >
            <span class="text-base flex-1 min-w-0"
              >{link.title || "(untitled)"}</span
            >
            <span class="text-xs text-base-content/60 font-mono shrink-0"
              >{formatDate(link.lastUpdated)}</span
            >
          </div>
          {#if link.tags.length > 0}
            <div class="flex flex-wrap gap-1 mb-1">
              {#each link.tags as tag}
                <span class="badge badge-outline badge-sm">{tag}</span>
              {/each}
            </div>
          {/if}
          {#if link.note}
            <div
              class="text-sm text-base-content/60 whitespace-pre-wrap break-words mb-1"
            >
              {link.note.slice(0, 200)}{link.note.length > 200 ? "…" : ""}
            </div>
          {/if}
          <div class="text-xs text-primary font-mono opacity-70 truncate">
            {link.url}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- ─── Link Modal ──────────────────────────────────────────────────────── -->
{#if activeLink}
  <LinkModal link={activeLink} onclose={closeModal} />
{/if}

<style></style>
