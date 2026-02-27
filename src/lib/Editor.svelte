<script lang="ts">
  import { onMount } from "svelte";
  import { EditorState } from "@codemirror/state";
  import {
    EditorView,
    keymap,
    drawSelection,
    dropCursor,
  } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
  import { languages } from "@codemirror/language-data";
  import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
  import { baseTheme, themeCompartment, buildThemeExtension } from "./themes";

  interface Props {
    content: string;
    onchange?: (value: string) => void;
  }

  let { content, onchange }: Props = $props();

  let editorEl: HTMLDivElement;
  let view: EditorView | undefined;
  // Tracks the last content value we pushed INTO the editor from outside.
  // Only update the editor when content diverges from this — never on keystrokes.
  // svelte-ignore state_referenced_locally
  let lastExternalContent = content;
  // Set to true during programmatic dispatches to suppress the onchange callback.
  let suppressChange = false;

  // ─── System colour-scheme ──────────────────────────────────────────────────
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  let isDark = $state(mq.matches);

  onMount(() => {
    function onSchemeChange(e: MediaQueryListEvent) {
      isDark = e.matches;
      view?.dispatch({
        effects: themeCompartment.reconfigure(buildThemeExtension(e.matches)),
      });
    }
    mq.addEventListener("change", onSchemeChange);
    return () => mq.removeEventListener("change", onSchemeChange);
  });

  // ─── Editor lifecycle ──────────────────────────────────────────────────────
  onMount(() => {
    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap]),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          addKeymap: true,
        }),
        closeBrackets(),
        themeCompartment.of(buildThemeExtension(isDark)),
        baseTheme,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressChange) {
            const text = update.state.doc.toString();
            lastExternalContent = text; // keep in sync so $effect won't re-push
            onchange?.(text);
          }
        }),
      ],
    });

    view = new EditorView({ state, parent: editorEl });

    return () => {
      view?.destroy();
      view = undefined;
    };
  });

  // Sync external content changes into the editor (file open, watcher reload).
  // Comparing against lastExternalContent (not the live doc) avoids re-pushing
  // content that the user just typed, which would reset the cursor to position 0.
  $effect(() => {
    if (!view || content === lastExternalContent) return;
    lastExternalContent = content;
    const current = view.state.doc.toString();
    suppressChange = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content },
      selection: { anchor: 0 },
      scrollIntoView: true,
    });
    suppressChange = false;
  });
</script>

<div
  bind:this={editorEl}
  class="flex-1 min-h-0 overflow-hidden flex flex-col"
></div>

<style></style>
