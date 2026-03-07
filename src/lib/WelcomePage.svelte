<script lang="ts">
    import { store } from "./store.svelte";
    import { settings } from "./settings.svelte";

    function fileName(path: string) {
        return path.split("/").at(-1) ?? path;
    }

    function dirName(path: string) {
        const parts = path.split("/");
        parts.pop();
        return parts.join("/") || "/";
    }
</script>

<div
    class="flex flex-1 flex-col items-center justify-center gap-8 p-8 bg-base-100"
>
    <div class="text-center">
        <h1 class="text-3xl font-bold tracking-tight mb-1">clippy.ai</h1>
        <p class="text-base-content/50 text-sm">
            Your local-first bookmarking &amp; research tool
        </p>
    </div>

    <div class="flex flex-col gap-3 w-full max-w-sm">
        <button
            class="btn btn-primary w-full"
            onclick={() => store.openFolder()}
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
            Open Folder as Workspace…
        </button>
    </div>

    {#if settings.recentWorkspaces.length > 0}
        <div class="w-full max-w-sm">
            <p
                class="text-xs text-base-content/40 uppercase tracking-widest mb-2 font-medium"
            >
                Recent
            </p>
            <ul class="flex flex-col gap-1">
                {#each settings.recentWorkspaces as path (path)}
                    <li>
                        <div
                            class="flex items-center gap-1 rounded-btn hover:bg-base-200 transition-colors group"
                        >
                            <button
                                class="flex items-center gap-3 px-3 py-2 text-left flex-1 min-w-0"
                                onclick={() => store.openPath(path)}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="size-4 shrink-0 text-base-content/40 group-hover:text-base-content/70 transition-colors"
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
                                <div class="flex flex-col min-w-0 flex-1">
                                    <span class="text-sm font-medium truncate"
                                        >{fileName(path)}</span
                                    >
                                    <span
                                        class="text-xs text-base-content/40 truncate"
                                        >{dirName(path)}</span
                                    >
                                </div>
                            </button>
                            <button
                                class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-40 hover:opacity-100! hover:btn-error shrink-0 mr-1"
                                title="Remove from recents"
                                onclick={() =>
                                    settings.removeRecentWorkspace(path)}
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
</div>
