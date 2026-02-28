<script lang="ts">
  import { bookmarks } from "./bookmarks.svelte";
  import { store } from "./store.svelte";

  let url = $state("");
  let inputEl: HTMLInputElement;

  const duplicate = $derived(
    url.trim()
      ? (store.data.bookmarks.find((b) => b.url === url.trim()) ?? null)
      : null,
  );

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed || duplicate) return;

    bookmarks.hideAddDialog();
    if (!store.filePath) {
      await store.saveAs();
      if (!store.filePath) return;
    }
    const bookmark = store.addBookmark({
      url: trimmed,
      title: "",
      note: "",
      tags: [],
      summary: "",
    });
    bookmarks.setActiveBookmark(bookmark);
    await store.save();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") bookmarks.hideAddDialog();
    if (e.key === "Enter") submit();
  }

  $effect(() => {
    inputEl?.focus();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
  onclick={(e) => {
    if (e.target === e.currentTarget) bookmarks.hideAddDialog();
  }}
>
  <div
    class="bg-base-100 border border-base-300 rounded-md shadow-2xl p-6 flex flex-col gap-4"
    style="width: min(480px, calc(100vw - 48px));"
  >
    <h2 class="text-lg font-semibold">Add Bookmark</h2>

    <div class="flex flex-col gap-1">
      <label
        for="add-url"
        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
        >URL</label
      >
      <input
        id="add-url"
        bind:this={inputEl}
        bind:value={url}
        type="url"
        placeholder="https://…"
        class="input w-full {duplicate ? 'input-error' : ''}"
      />
      {#if duplicate}
        <p class="text-sm text-error">
          Already bookmarked as <span class="font-medium"
            >"{duplicate.title || duplicate.url}"</span
          >
          (#{duplicate.id})
        </p>
      {/if}
    </div>

    <div class="flex justify-end gap-2">
      <button class="btn btn-ghost" onclick={() => bookmarks.hideAddDialog()}
        >Cancel</button
      >
      <button
        class="btn btn-primary"
        onclick={submit}
        disabled={!url.trim() || !!duplicate}>Add</button
      >
    </div>
  </div>
</div>

<style></style>
