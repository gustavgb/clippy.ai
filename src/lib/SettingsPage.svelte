<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { settings } from "./settings.svelte";
  import { tabs } from "./tabs.svelte";

  let keyInput = $state(settings.geminiApiKey);
  let modelInput = $state(settings.geminiModel);
  let promptInput = $state(settings.geminiPrompt);
  let saved = $state(false);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  let listingModels = $state(false);
  let availableModels = $state<string[] | null>(null);
  let modelsError = $state<string | null>(null);

  async function handleSave() {
    await settings.setGeminiApiKey(keyInput);
    await settings.setGeminiModel(modelInput);
    await settings.setGeminiPrompt(promptInput);
    saved = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => (saved = false), 2000);
  }

  async function listModels() {
    if (!keyInput) return;
    listingModels = true;
    availableModels = null;
    modelsError = null;
    try {
      availableModels = await invoke<string[]>("list_gemini_models", {
        apiKey: keyInput,
      });
    } catch (e) {
      modelsError = String(e);
    } finally {
      listingModels = false;
    }
  }

  function resetPrompt() {
    promptInput = settings.geminiPrompt;
    // Reset to the store default by importing the constant isn't possible directly,
    // so we use the known default value:
    promptInput =
      "Summarize the main content of the following webpage in 3-5 sentences.\n\nIMPORTANT: Detect the language of the webpage. If the webpage is written in Danish, you MUST write the entire summary in Danish. If it is written in English, write in English. For any other language, write in English.\n\nWebpage content:\n{content}\n\nRemember: if the webpage above is in Danish, your summary MUST be in Danish.";
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      tabs.setActiveTab("bookmarks");
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex-1 overflow-y-auto p-6">
  <div class="flex items-center w-full mb-6 justify-between">
    <h2 class="text-xl font-semibold">Settings</h2>
    <button
      type="button"
      class="btn btn-circle btn-ghost"
      onclick={() => tabs.setActiveTab("bookmarks")}
      title="Close settings"
      ><svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="feather feather-x"
        ><line x1="18" y1="6" x2="6" y2="18"></line><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        ></line></svg
      ></button
    >
  </div>

  <!-- API Key -->
  <div class="form-control mb-4">
    <label class="label" for="gemini-key">
      <span class="label-text font-medium">Gemini API Key</span>
    </label>
    <input
      id="gemini-key"
      type="password"
      class="input input-bordered w-full font-mono"
      placeholder="AIza..."
      bind:value={keyInput}
    />
    <div class="label">
      <span class="label-text-alt text-base-content/60">
        Get a key at
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          class="link link-primary">aistudio.google.com</a
        >.
      </span>
    </div>
  </div>

  <!-- Model -->
  <div class="form-control mb-2">
    <label class="label" for="gemini-model">
      <span class="label-text font-medium">Model</span>
    </label>
    <div class="flex gap-2">
      <input
        id="gemini-model"
        type="text"
        class="input input-bordered flex-1 font-mono text-sm"
        placeholder="models/gemini-2.0-flash-lite"
        bind:value={modelInput}
      />
      <button
        class="btn btn-outline"
        disabled={!keyInput || listingModels}
        onclick={listModels}
        title="Fetch available models from the API"
      >
        {#if listingModels}
          <span class="loading loading-spinner loading-xs"></span>
        {:else}
          Browse
        {/if}
      </button>
    </div>
    <div class="label">
      <span class="label-text-alt text-base-content/60"
        >Click a model below to select it.</span
      >
    </div>
  </div>

  {#if modelsError}
    <p class="text-sm text-error mb-3">{modelsError}</p>
  {/if}

  {#if availableModels}
    <div class="bg-base-200 rounded p-3 mb-4 max-h-48 overflow-y-auto">
      <p
        class="text-xs font-mono text-base-content/60 mb-2 uppercase tracking-widest"
      >
        {availableModels.length} models — click to select
      </p>
      <ul class="space-y-0.5">
        {#each availableModels as model}
          <li>
            <button
              class="text-sm font-mono text-left w-full hover:text-primary px-1 rounded
                     {modelInput === model ? 'text-primary font-bold' : ''}"
              onclick={() => (modelInput = model)}>{model}</button
            >
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Prompt -->
  <div class="form-control mb-4">
    <div class="flex items-center justify-between mb-1">
      <label class="label-text font-medium" for="gemini-prompt"
        >Summary Prompt</label
      >
      <button class="btn btn-ghost btn-xs" onclick={resetPrompt}
        >Reset to default</button
      >
    </div>
    <textarea
      id="gemini-prompt"
      class="textarea textarea-bordered w-full font-mono text-sm min-h-32"
      bind:value={promptInput}
    ></textarea>
    <div class="label">
      <span class="label-text-alt text-base-content/60"
        >Use <code class="font-mono bg-base-300 px-1 rounded"
          >{"{content}"}</code
        > as the placeholder for the page text.</span
      >
    </div>
  </div>

  <div class="flex items-center gap-3">
    <button class="btn btn-primary" onclick={handleSave}>Save</button>
    {#if saved}
      <span class="text-sm text-success">Saved!</span>
    {/if}
  </div>
</div>

<style></style>
