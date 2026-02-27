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
<div class="backdrop" onclick={handleBackdropClick}>
  <div class="modal">
    <div class="modal-header">
      <span class="link-id">#{link.id}</span>
      <div class="header-actions">
        <button class="btn-icon" onclick={onclose}>✕</button>
      </div>
    </div>

    <div class="field">
      <label for="title">Title</label>
      {#if fetchingTitle}
        <span class="fetching">Fetching title…</span>
      {:else}
        <input
          id="title"
          type="text"
          bind:value={title}
          placeholder="Enter title…"
          class="input"
        />
      {/if}
    </div>

    <div class="field">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>URL</label>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="url-row">
        <span class="url-display" onclick={openUrl} title="Open in browser">
          {link.url}
        </span>
      </div>
    </div>

    <div class="field">
      <label for="tags">Tags</label>
      <input
        id="tags"
        type="text"
        bind:value={tagsInput}
        placeholder="tag1, tag2, tag3"
        class="input"
      />
    </div>

    <div class="field field-note">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Note</label>
      <div class="editor-container">
        <Editor
          content={note}
          onchange={(v) => {
            note = v;
          }}
        />
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-warning" onclick={deleteLink}>Delete link</button>
      <button class="btn-primary" onclick={save}>Save & Close</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(2px);
  }

  .modal {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(680px, calc(100vw - 48px));
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .link-id {
    font-size: 12px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .btn-icon:hover {
    color: var(--text);
    background: var(--border);
  }

  .field {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .field-note {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    font-size: 14px;
    padding: 6px 10px;
    width: 100%;
    font-family: var(--font-mono);
    transition: border-color 0.15s;
  }

  .input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .url-row {
    overflow: hidden;
  }

  .url-display {
    color: var(--accent);
    font-size: 13px;
    font-family: var(--font-mono);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  .url-display:hover {
    opacity: 0.8;
  }

  .fetching {
    font-size: 13px;
    color: var(--text-dim);
    font-style: italic;
  }

  .editor-container {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 160px;
    max-height: 300px;
  }

  .modal-footer {
    padding: 12px 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    gap: 8px;
  }

  .btn-primary {
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-mono);
    padding: 7px 16px;
    transition: opacity 0.15s;
  }

  .btn-primary:hover {
    opacity: 0.85;
  }

  .btn-warning {
    background: var(--warning);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-mono);
    padding: 7px 16px;
    transition: opacity 0.15s;
  }

  .btn-warning:hover {
    opacity: 0.85;
  }
</style>
