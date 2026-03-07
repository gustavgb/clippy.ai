<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import type { Bookmark } from "./types";
    import { store } from "./store.svelte";
    import { settings } from "./settings.svelte";
    import { confirm } from "@tauri-apps/plugin-dialog";
    import { bookmarks } from "./bookmarks.svelte";
    import { formatRelativeTime } from "./utils";

    let scrollEl = $state<HTMLDivElement | null>(null);

    interface Props {
        bookmark: Bookmark;
        onclose: () => void;
    }

    let { bookmark, onclose }: Props = $props();

    // svelte-ignore state_referenced_locally
    let title = $state(bookmark.title);
    // svelte-ignore state_referenced_locally
    let tagsInput = $state(bookmark.tags.join(", "));
    let fetchingTitle = $state(false);
    let summarizing = $state(false);
    let summaryError = $state<string | null>(null);
    let mounted = false;
    let lastSeenMtime = store.mtimes.get(bookmark.id) ?? 0;

    // Sync local fields when the file watcher reloads bookmarks from disk.
    $effect(() => {
        const mtime = store.mtimes.get(bookmark.id) ?? 0;
        if (mtime !== lastSeenMtime) {
            lastSeenMtime = mtime;
            const b = store.bookmarkList.find((b) => b.id === bookmark.id);
            if (b) {
                mounted = false;
                title = b.title;
                tagsInput = b.tags.join(", ");
            }
        }
    });

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

    // Auto-save (1.5 s debounced) — skip the very first run (mount)
    $effect(() => {
        const _t = title,
            _tags = tagsInput; // track deps
        if (!mounted) {
            mounted = true;
            return;
        }
        const timer = setTimeout(() => save(), 1500);
        return () => clearTimeout(timer);
    });

    function save() {
        const tags = tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        const updated = { ...bookmark, title, tags };
        store.updateBookmark(updated);
        if (store.dirPath && store.dirty) {
            const saved =
                store.bookmarkList.find((b) => b.id === bookmark.id) ?? updated;
            store.persistBookmark(saved);
        }
    }

    async function fetchSummary() {
        if (!settings.geminiApiKey) return;
        summarizing = true;
        summaryError = null;
        try {
            const usedPrompt = settings.geminiPrompt;
            const result = await invoke<string>("fetch_ai_summary", {
                url: bookmark.url,
                apiKey: settings.geminiApiKey,
                model: settings.geminiModel,
                promptTemplate: usedPrompt,
            });
            const summarizedAt = new Date().toISOString();
            // Update or insert the Summary section directly in the store bookmark
            const current =
                store.bookmarkList.find((b) => b.id === bookmark.id) ??
                bookmark;
            const idx = current.sections.findIndex(
                (s) => s.heading === "Summary",
            );
            const updatedSection = {
                heading: "Summary",
                body: result,
                promptUsed: usedPrompt,
                summarizedAt,
            };
            const newSections =
                idx !== -1
                    ? current.sections.map((s, i) =>
                          i === idx ? updatedSection : s,
                      )
                    : [updatedSection, ...current.sections];
            const updated = { ...current, sections: newSections };
            store.updateBookmark(updated);
            if (store.dirPath) store.persistBookmark(updated);
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

    function openInEditor() {
        if (!store.dirPath) return;
        const filePath = `${store.dirPath}/bookmarks/${bookmark.id}.md`;
        invoke("open_path", { path: filePath }).catch(console.error);
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

    // The live bookmark from the store (updated by watcher)
    const liveBookmark = $derived(
        store.bookmarkList.find((b) => b.id === bookmark.id) ?? bookmark,
    );
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex flex-col h-full border-l border-base-300 overflow-hidden">
    <!-- Header -->
    <div
        class="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0"
    >
        <span class="text-xs text-base-content/60 font-mono"
            >#{bookmark.id}</span
        >
        <div class="flex items-center gap-2">
            <span class="text-xs text-base-content/60">
                {formatRelativeTime(store.mtimes.get(bookmark.id))}
            </span>
            <button
                class="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                title="Open in editor"
                onclick={openInEditor}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                </svg>
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col" bind:this={scrollEl}>
        <!-- Title -->
        <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
            <label
                for="bm-title"
                class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
                >Title</label
            >
            {#if fetchingTitle}
                <span class="text-sm text-base-content/60 italic"
                    >Fetching title…</span
                >
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

        <!-- Read-only sections -->
        {#each liveBookmark.sections as section}
            <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
                <div class="flex items-center justify-between">
                    <span
                        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
                        >{section.heading}</span
                    >
                    {#if section.heading === "Summary"}
                        {#if summarizing}
                            <span
                                class="loading loading-spinner loading-xs opacity-50"
                            ></span>
                        {:else}
                            <button
                                class="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                                title={section.body
                                    ? "Re-summarize with AI"
                                    : "Summarize with AI"}
                                disabled={!settings.geminiApiKey}
                                onclick={fetchSummary}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="size-3.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M12 20h9" />
                                    <path
                                        d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"
                                    />
                                </svg>
                            </button>
                        {/if}
                    {/if}
                </div>
                {#if summaryError && section.heading === "Summary"}
                    <p class="text-xs text-error">{summaryError}</p>
                {/if}
                {#if section.heading === "Summary" && section.summarizedAt}
                    <details class="text-xs text-base-content/50 mt-0.5">
                        <summary
                            class="cursor-pointer select-none hover:text-base-content/70 list-none flex items-center gap-1"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="size-3 transition-transform [[open]_&]:rotate-90"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                            <span class="font-mono">
                                AI metadata &middot; {new Date(
                                    section.summarizedAt,
                                ).toLocaleString()}
                            </span>
                        </summary>
                        <div
                            class="mt-2 pl-4 border-l border-base-300 flex flex-col gap-2"
                        >
                            <div>
                                <p
                                    class="font-mono uppercase tracking-widest text-[10px] text-base-content/40 mb-0.5"
                                >
                                    Prompt used
                                </p>
                                <pre
                                    class="whitespace-pre-wrap font-mono text-[11px] text-base-content/60 bg-base-200 rounded p-2 leading-relaxed">{section.promptUsed}</pre>
                            </div>
                        </div>
                    </details>
                {/if}
                {#if section.body}
                    <p class="text-sm text-base-content/80 whitespace-pre-wrap">
                        {section.body}
                    </p>
                {:else}
                    <p class="text-sm text-base-content/30 italic">Empty</p>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Footer -->
    <div
        class="flex justify-end gap-2 px-4 py-3 border-t border-base-300 shrink-0"
    >
        <button
            class="btn btn-sm btn-error btn-outline"
            onclick={deleteBookmark}>Delete</button
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
