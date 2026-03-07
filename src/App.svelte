<script lang="ts">
    import { onMount } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { listen } from "@tauri-apps/api/event";
    import { message } from "@tauri-apps/plugin-dialog";
    import { getVersion } from "@tauri-apps/api/app";
    import { store } from "./lib/store.svelte";
    import { settings } from "./lib/settings.svelte";
    import BookmarksPage from "./lib/BookmarksPage.svelte";
    import SettingsPage from "./lib/SettingsPage.svelte";
    import WelcomePage from "./lib/WelcomePage.svelte";
    import { tabs } from "./lib/tabs.svelte";
    import { bookmarks } from "./lib/bookmarks.svelte";
    import AddBookmarkDialog from "./lib/AddBookmarkDialog.svelte";

    let ready = $state(false);

    onMount(async () => {
        await settings.init();
        const initialPath = await invoke<string | null>("get_initial_file");
        if (initialPath) {
            await store.openPath(initialPath, { silent: true });
        } else if (settings.lastOpenedFile) {
            await store.openPath(settings.lastOpenedFile, { silent: true });
        }
        ready = true;
    });

    $effect(() => {
        const unlisten = listen<string>(
            "menu-action",
            async ({ payload: id }) => {
                if (id === "open") await store.openFolder();
                else if (id === "preferences") tabs.setActiveTab("settings");
                else if (id === "new_bookmark") {
                    if (store.filePath) bookmarks.showAddDialog();
                } else if (id === "source_code") {
                    invoke("open_url", {
                        url: "https://github.com/gustavgb/clippy.ai",
                    });
                } else if (id === "about") {
                    const version = await getVersion();
                    await message(`clippy.ai v${version}`, {
                        title: "About clippy.ai",
                        kind: "info",
                    });
                } else if (id === "quit") invoke("close_app");
                else if (id === "git_pull") {
                    if (!store.dirPath) {
                        await message("No workspace is open.", {
                            title: "Git Pull",
                            kind: "error",
                        });
                        return;
                    }
                    try {
                        const result = await invoke<string>("git_pull", {
                            filePath: store.dirPath,
                        });
                        await message(result || "Already up to date.", {
                            title: "Git Pull",
                            kind: "info",
                        });
                    } catch (e) {
                        await message(String(e), {
                            title: "Git Pull Failed",
                            kind: "error",
                        });
                    }
                } else if (id === "git_push") {
                    if (!store.dirPath) {
                        await message("No workspace is open.", {
                            title: "Git Push",
                            kind: "error",
                        });
                        return;
                    }
                    try {
                        const result = await invoke<string>("git_push", {
                            filePath: store.dirPath,
                        });
                        await message(result, {
                            title: "Git Push",
                            kind: "info",
                        });
                    } catch (e) {
                        await message(String(e), {
                            title: "Git Push Failed",
                            kind: "error",
                        });
                    }
                }
            },
        );
        return () => {
            unlisten.then((fn) => fn());
        };
    });
</script>

<div class="flex flex-col h-full bg-base-100 overflow-hidden">
    {#if !ready}
        <div class="flex flex-1 items-center justify-center">
            <span
                class="loading loading-spinner loading-md text-base-content/30"
            ></span>
        </div>
    {:else if tabs.activeTab === "bookmarks"}
        {#if store.filePath}
            <BookmarksPage />
        {:else}
            <WelcomePage />
        {/if}
    {:else if tabs.activeTab === "settings"}
        <SettingsPage />
    {/if}
</div>

{#if bookmarks.addDialogOpen}
    <AddBookmarkDialog />
{/if}

<style></style>
