<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { Bookmark } from "./types";
  import { store } from "./store.svelte";
  import { settings } from "./settings.svelte";
  import { confirm } from "@tauri-apps/plugin-dialog";
  import { bookmarks } from "./bookmarks.svelte";
  import { formatRelativeTime } from "./utils";

  interface Props {
    bookmark: Bookmark;
    onclose: () => void;
  }

  let { bookmark, onclose }: Props = $props();

  // svelte-ignore state_referenced_locally
  let title = $state(bookmark.title);
  // svelte-ignore state_referenced_locally
  let note = $state(bookmark.note);
  // svelte-ignore state_referenced_locally
  let tagsInput = $state(bookmark.tags.join(", "));
  // svelte-ignore state_referenced_locally
  let summary = $state(bookmark.summary);
  let fetchingTitle = $state(false);
  let summarizing = $state(false);
  let summaryError = $state<string | null>(null);

  // Auto-fetch title if empty
  $effect(() => {
    if (!bookmark.title && bookmark.url) {
      fetchingTitle = true;
      invoke<string>("fetch_page_title", { url: bookmark.url })
        .then((t) => {
          if (!title) {
            title = t;
            save();
          }
        })
        .catch(() => {
          if (!title) title = bookmark.url;
        })
        .finally(() => {
          fetchingTitle = false;
        });
    }
  });

  // Auto-save (1.5 s debounced)
  $effect(() => {
    const _t = title,
      _n = note,
      _tags = tagsInput,
      _s = summary; // track deps
    const timer = setTimeout(() => save(), 1500);
    return () => clearTimeout(timer);
  });

  function save() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    store.updateBookmark({ ...bookmark, title, note, tags, summary });
    if (store.filePath) store.save();
  }

  async function fetchSummary() {
    if (!settings.geminiApiKey) return;
    summarizing = true;
    summaryError = null;
    try {
      const result = await invoke<string>("fetch_ai_summary", {
        url: bookmark.url,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
        promptTemplate: settings.geminiPrompt,
      });
      summary = result;
      save();
    } catch (e) {
      summaryError = String(e);
    } finally {
      summarizing = false;
    }
  }

  function openUrl() {
    invoke("open_url", { url: bookmark.url }).catch(() => {
      window.open(bookmark.url, "_blank");
    });
  }

  async function deleteBookmark() {
    const confirmation = await confirm(
      "Delete bookmark? This cannot be undone!",
      { title: "Delete bookmark?", kind: "warning" },
    );

    if (!confirmation) return;

    store.deleteBookmark(bookmark.id);
    if (store.filePath) store.save();
    onclose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && !bookmarks.addDialogOpen) {
      e.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex flex-col h-full border-l border-base-300 overflow-hidden">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0"
  >
    <span class="text-xs text-base-content/60 font-mono">#{bookmark.id}</span>
    <span class="text-xs text-base-content/60"
      >Last updated: {formatRelativeTime(bookmark.lastUpdated)}</span
    >
  </div>

  <div class="flex-1 overflow-y-auto flex flex-col">
    <!-- Title -->
    <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
      <label
        for="bm-title"
        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
        >Title</label
      >
      {#if fetchingTitle}
        <span class="text-sm text-base-content/60 italic">Fetching title…</span>
      {:else}
        <input
          id="bm-title"
          type="text"
          bind:value={title}
          placeholder="Enter title…"
          class="input input-sm w-full"
        />
      {/if}
    </div>

    <!-- URL -->
    <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label
        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
        >URL</label
      >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="text-sm text-primary font-mono cursor-pointer underline underline-offset-2 truncate block hover:opacity-80"
        onclick={openUrl}
        title="Open in browser">{bookmark.url}</span
      >
    </div>

    <!-- Tags -->
    <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
      <label
        for="bm-tags"
        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
        >Tags</label
      >
      <input
        id="bm-tags"
        type="text"
        bind:value={tagsInput}
        placeholder="tag1, tag2, tag3"
        class="input input-sm w-full"
      />
    </div>

    <!-- AI Summary -->
    <div
      class="flex flex-col gap-2 px-4 py-3 border-t border-base-300 shrink-0"
    >
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label
        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
        >AI Summary</label
      >
      {#if !settings.geminiApiKey}
        <p class="text-sm text-base-content/60 italic">
          Enter a Gemini API key in <span class="font-medium">Settings</span> to
          enable AI summaries.
        </p>
      {:else if summarizing}
        <div class="flex items-center gap-2 text-sm text-base-content/60">
          <span class="loading loading-spinner loading-xs"></span>
          Generating summary…
        </div>
      {:else}
        {#if summaryError}
          <p class="text-sm text-error">{summaryError}</p>
        {/if}
        {#if summary}
          <p class="text-sm text-base-content/80 whitespace-pre-wrap">
            {summary}
          </p>
        {/if}
        <button class="btn btn-xs btn-outline w-fit" onclick={fetchSummary}>
          {summary ? "Re-summarize" : "Summarize"}
        </button>
      {/if}
    </div>

    <!-- Note -->
    <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label
        class="text-xs uppercase tracking-widest text-base-content/50 font-mono shrink-0"
        for="bm-note">Note</label
      >
      <textarea bind:value={note} rows="4" class="textarea w-full" id="bm-note"
      ></textarea>
    </div>
  </div>

  <!-- Footer -->
  <div
    class="flex justify-end gap-2 px-4 py-3 border-t border-base-300 shrink-0"
  >
    <button class="btn btn-sm btn-error btn-outline" onclick={deleteBookmark}
      >Delete</button
    >
    <button
      class="btn btn-sm btn-primary"
      onclick={() => {
        save();
        onclose();
      }}>Close</button
    >
  </div>
</div>

<style></style>
