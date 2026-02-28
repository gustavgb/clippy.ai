<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { store } from "./lib/store.svelte";
  import { settings } from "./lib/settings.svelte";
  import BookmarksPage from "./lib/BookmarksPage.svelte";
  import SettingsPage from "./lib/SettingsPage.svelte";
  import { tabs } from "./lib/tabs.svelte";
  import { bookmarks } from "./lib/bookmarks.svelte";
  import AddBookmarkDialog from "./lib/AddBookmarkDialog.svelte";

  onMount(async () => {
    await settings.init();
    const initialPath = await invoke<string | null>("get_initial_file");
    if (initialPath) {
      await store.openPath(initialPath);
    } else if (settings.lastOpenedFile) {
      await store.openPath(settings.lastOpenedFile);
    }
  });

  $effect(() => {
    const unlisten = listen<string>("menu-action", async ({ payload: id }) => {
      if (id === "new") await store.newFile();
      else if (id === "open") await store.open();
      else if (id === "save") await store.save();
      else if (id === "save_as") await store.saveAs();
      else if (id === "preferences") tabs.setActiveTab("settings");
      else if (id === "new_bookmark") bookmarks.showAddDialog();
      else if (id === "quit") invoke("close_app");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  });

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      store.newFile();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
      e.preventDefault();
      store.saveAs();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      store.save();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      store.open();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex flex-col h-full bg-base-100 overflow-hidden">
  {#if tabs.activeTab === "bookmarks"}
    <BookmarksPage />
  {:else if tabs.activeTab === "settings"}
    <SettingsPage />
  {/if}
</div>

{#if bookmarks.addDialogOpen}
  <AddBookmarkDialog />
{/if}

<style></style>
