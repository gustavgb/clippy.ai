<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import Editor from "./Editor.svelte";
  import type { Link } from "./types";
  import { store } from "./store.svelte";

  interface Props {
    link: Link;
    onclose: () => void;
  }

  let { link, onclose }: Props = $props();

  // Local editable copy — intentionally captures initial prop values
  // svelte-ignore state_referenced_locally
  let title = $state(link.title);
  // svelte-ignore state_referenced_locally
  let note = $state(link.note);
  // svelte-ignore state_referenced_locally
  let tagsInput = $state(link.tags.join(", "));
  let fetchingTitle = $state(false);

  // Auto-fetch title if empty
  $effect(() => {
    if (!link.title && link.url) {
      fetchingTitle = true;
      invoke<string>("fetch_page_title", { url: link.url })
        .then((t) => {
          if (!title) title = t;
        })
        .catch(() => {
          if (!title) title = link.url;
        })
        .finally(() => {
          fetchingTitle = false;
        });
    }
  });

  function save() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    store.updateLink({ ...link, title, note, tags });
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      save();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      save();
    }
  }

  function openUrl() {
    invoke("open_url", { url: link.url }).catch(() => {
      window.open(link.url, "_blank");
    });
  }

  function deleteLink() {
    store.deleteLink(link.id);
    onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
  onclick={handleBackdropClick}
>
  <div
    class="bg-base-100 border border-base-300 rounded-xl flex flex-col shadow-2xl overflow-hidden"
    style="width: min(680px, calc(100vw - 48px)); max-height: calc(100vh - 80px);"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-5 py-3.5 border-b border-base-300 shrink-0"
    >
      <span class="text-xs text-base-content/60 font-mono">#{link.id}</span>
      <button class="btn btn-ghost btn-xs btn-circle" onclick={onclose}
        >✕</button
      >
    </div>

    <!-- Title -->
    <div
      class="flex flex-col gap-1.5 px-5 py-3 border-b border-base-300 shrink-0"
    >
      <label
        for="title"
        class="text-xs uppercase tracking-widest text-base-content/60 font-mono"
        >Title</label
      >
      {#if fetchingTitle}
        <span class="text-sm text-base-content/60 italic">Fetching title…</span>
      {:else}
        <input
          id="title"
          type="text"
          bind:value={title}
          placeholder="Enter title…"
          class="input input-sm w-full"
        />
      {/if}
    </div>

    <!-- URL -->
    <div
      class="flex flex-col gap-1.5 px-5 py-3 border-b border-base-300 shrink-0 overflow-hidden"
    >
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label
        class="text-xs uppercase tracking-widest text-base-content/60 font-mono"
        >URL</label
      >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="text-sm text-primary font-mono cursor-pointer underline underline-offset-[3px] truncate block hover:opacity-80"
        onclick={openUrl}
        title="Open in browser">{link.url}</span
      >
    </div>

    <!-- Tags -->
    <div
      class="flex flex-col gap-1.5 px-5 py-3 border-b border-base-300 shrink-0"
    >
      <label
        for="tags"
        class="text-xs uppercase tracking-widest text-base-content/60 font-mono"
        >Tags</label
      >
      <input
        id="tags"
        type="text"
        bind:value={tagsInput}
        placeholder="tag1, tag2, tag3"
        class="input input-sm w-full"
      />
    </div>

    <!-- Note -->
    <div
      class="flex flex-col gap-1.5 px-5 py-3 border-b border-base-300 flex-1 min-h-0 overflow-hidden"
    >
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label
        class="text-xs uppercase tracking-widest text-base-content/60 font-mono shrink-0"
        >Note</label
      >
      <div
        class="border border-base-300 rounded flex flex-col overflow-hidden"
        style="min-height: 160px; max-height: 300px;"
      >
        <Editor
          content={note}
          onchange={(v) => {
            note = v;
          }}
        />
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex justify-end gap-2 px-5 py-3 border-t border-base-300 shrink-0"
    >
      <button class="btn btn-sm btn-error btn-outline" onclick={deleteLink}
        >Delete</button
      >
      <button class="btn btn-sm btn-primary" onclick={save}>Save & Close</button
      >
    </div>
  </div>
</div>

<style></style>
