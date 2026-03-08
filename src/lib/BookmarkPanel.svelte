<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { store } from "./store.svelte";
    import { confirm } from "@tauri-apps/plugin-dialog";
    import { ui } from "./ui.svelte";
    import { formatRelativeTime } from "./utils";
    import {
        fetchAnswer,
        getQuestionPrompt,
        type QuickPrompt,
        quickPrompts,
    } from "./ai";
    import { settings } from "./settings.svelte";

    let scrollEl = $state<HTMLDivElement | null>(null);

    interface Props {
        bookmarkId: number;
        onclose: () => void;
    }

    let { bookmarkId, onclose }: Props = $props();

    const bookmark = $derived(store.bookmarks.get(bookmarkId));
    // svelte-ignore state_referenced_locally
    let title = $state(bookmark?.title);
    // svelte-ignore state_referenced_locally
    let tagsInput = $state(bookmark?.tags.join(", "));
    let fetchingTitle = $state(false);
    let lastSeenMtime = $state(0);
    const sections = $derived(bookmark?.sections);
    const tags = $derived(bookmark?.tags);
    let question = $state("");
    let fetchingAnswer = $state(false);
    let runningQuickPrompts = $state<string[]>([]);

    function isNote(heading: string) {
        return /note/i.test(heading);
    }

    const note = $derived(sections?.find((s) => isNote(s.heading)));

    // Sync local fields when the file watcher reloads bookmarks from disk.
    $effect(() => {
        const mtime = bookmark?.mtime ?? 0;
        if (mtime !== lastSeenMtime) {
            lastSeenMtime = mtime;
            if (bookmark) {
                title = bookmark.title;
                tagsInput = bookmark.tags.join(", ");
            }
        }
    });

    // Auto-save (0.5 s debounced)
    $effect(() => {
        const _t = title,
            _tags = tagsInput; // track deps
        const timer = setTimeout(() => save(), 500);
        return () => {
            clearTimeout(timer);
        };
    });

    // Save on unmount
    $effect(() => () => save());

    function save() {
        const tags = tagsInput
            ?.split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        if (bookmark) {
            const updated = {
                ...bookmark,
                title: title || "",
                tags: tags || [],
            };
            store.updateBookmark(updated);
            store.saveBookmarks();
        }
    }

    function clearSection(index: number) {
        if (!bookmark || !sections) return;

        store.updateBookmark({
            ...bookmark,
            sections: sections.filter((_, idx) => idx !== index),
        });

        store.saveBookmarks();
    }

    function openUrl() {
        invoke("open_url", { url: bookmark?.url }).catch(() => {
            window.open(bookmark?.url, "_blank");
        });
    }

    function openInEditor() {
        if (!store.dirPath) return;
        const filePath = `${store.dirPath}/bookmarks/${bookmarkId}.md`;
        invoke("open_path", { path: filePath }).catch(console.error);
    }

    async function deleteBookmark() {
        const confirmation = await confirm(
            "Delete bookmark? This cannot be undone!",
            { title: "Delete bookmark?", kind: "warning" },
        );
        if (!confirmation) return;
        store.deleteBookmark(bookmarkId);
        onclose();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && !ui.addDialogOpen) {
            e.preventDefault();
            onclose();
        }
    }

    async function askQuestion(e: SubmitEvent) {
        e.preventDefault();

        if (!bookmark) return;
        fetchingAnswer = true;
        await fetchAnswer(bookmark, getQuestionPrompt(question));
        fetchingAnswer = false;
        question = "";
    }

    async function runQuickPrompt(prompt: QuickPrompt) {
        if (!bookmark || runningQuickPrompts.indexOf(prompt.label) > -1) return;
        runningQuickPrompts.push(prompt.label);
        await fetchAnswer(bookmark, prompt);
        runningQuickPrompts.splice(
            runningQuickPrompts.indexOf(prompt.label),
            1,
        );
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex flex-col h-full border-l border-base-300 overflow-hidden">
    <!-- Header -->
    <div
        class="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0"
    >
        <span class="text-xs text-base-content/60 font-mono">#{bookmarkId}</span
        >
        <div class="flex items-center gap-2">
            <span class="text-xs text-base-content/60">
                {formatRelativeTime(bookmark?.ctime)}
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
        <!-- Bookmark details -->
        <div
            class="flex flex-col gap-1 px-4 py-3 border-b border-base-300 w-full min-w-0"
        >
            <p class="text-sm w-full min-w-0 truncate" {title}>{title}</p>
            <!-- {#if tags?.length}
                <div class="flex flex-wrap gap-1 mb-2">
                    {#each tags as tag}
                        <span class="badge badge-outline badge-xs">{tag}</span>
                    {/each}
                </div>
            {/if} -->
            <button
                class="text-sm text-primary font-mono underline underline-offset-2 w-full min-w-0 truncate text-left cursor-pointer"
                onclick={openUrl}
                type="button"
                tabindex={-1}
                title="Open in browser"
            >
                {bookmark?.url}
            </button>
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

        <!-- Note -->
        {#if note}
            <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
                <div class="flex items-center justify-between">
                    <span
                        class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
                        >{note.heading}</span
                    >
                </div>
                {#if note.body}
                    <p class="text-sm text-base-content/80 whitespace-pre-wrap">
                        {note.body}
                    </p>
                {:else}
                    <p class="text-sm text-base-content/30 italic">Empty</p>
                {/if}
            </div>
        {/if}

        <!-- Ask question -->
        <div class="flex flex-col gap-1 px-4 py-3 border-b border-base-300">
            <label
                for="ai-prompt"
                class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
                >Ask AI ({settings.geminiModel.split("/").at(-1)})</label
            >
            <form onsubmit={askQuestion} class="flex items-center gap-2">
                <input
                    id="ai-prompt"
                    type="text"
                    bind:value={question}
                    placeholder=""
                    class="input input-sm w-full"
                    disabled={fetchingAnswer}
                />
                <button class="btn btn-sm"
                    >{fetchingAnswer ? "Loading..." : "Ask"}</button
                >
            </form>

            <!-- Quick prompts -->
            <div class="flex items-center gap-2 mt-2">
                {#each quickPrompts as prompt}
                    <button
                        class="btn btn-sm btn-outline btn-secondary"
                        onclick={() => runQuickPrompt(prompt)}
                        disabled={runningQuickPrompts.indexOf(prompt.label) >
                            -1}
                        >{runningQuickPrompts.indexOf(prompt.label) > -1
                            ? prompt.labelFetching
                            : prompt.label}</button
                    >
                {/each}
            </div>
        </div>

        <!-- Read-only sections -->
        {#each sections as section, i}
            {#if !isNote(section.heading)}
                <div
                    class="flex flex-col gap-1 px-4 py-3 border-b border-base-300"
                >
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs uppercase tracking-widest text-base-content/50 font-mono"
                            >{section.heading}</span
                        >
                        <button
                            class="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                            onclick={() => clearSection(i)}
                        >
                            Clear
                        </button>
                    </div>
                    {#if section.body}
                        <p
                            class="text-sm text-base-content/80 whitespace-pre-wrap"
                        >
                            {section.body}
                        </p>
                    {:else}
                        <p class="text-sm text-base-content/30 italic">Empty</p>
                    {/if}
                </div>
            {/if}
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
