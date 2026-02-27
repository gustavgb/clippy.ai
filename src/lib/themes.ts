import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// ─── Shared / structural chrome ────────────────────────────────────────────

export const baseTheme = EditorView.baseTheme({
  "&": { height: "100%", fontSize: "15px" },
  "&.cm-focused": { outline: "none !important" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', ui-monospace, monospace",
    lineHeight: "1.75",
  },
  ".cm-content": {
    padding: "32px 0 128px",
    maxWidth: "740px",
    marginInline: "auto",
    paddingInline: "48px",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftWidth: "2px" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-tooltip": {
    borderRadius: "6px",
    fontSize: "13px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    overflow: "hidden",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    maxHeight: "220px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "4px 12px",
    lineHeight: "1.5",
  },
  ".cm-completionIcon": {
    fontSize: "11px",
    paddingRight: "4px",
    opacity: "0.6",
  },
});

// ─── Dark ──────────────────────────────────────────────────────────────────

const darkTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#1c1c1e", color: "#e0e0e0" },
    ".cm-content": { caretColor: "#9d86e9" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#9d86e9" },
    ".cm-selectionBackground, .cm-content ::selection": {
      background: "rgba(157, 134, 233, 0.22) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      background: "rgba(157, 134, 233, 0.22) !important",
    },
    ".cm-tooltip": { background: "#232326", border: "1px solid #3a3a3f" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { color: "#c0c0c6" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      background: "#3a3a5e",
      color: "#e0e0e0",
    },
  },
  { dark: true }
);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "#ffffff", fontWeight: "700", fontSize: "1.45em" },
  { tag: tags.heading2, color: "#f0f0f0", fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading3, color: "#e8e8e8", fontWeight: "600", fontSize: "1.1em" },
  { tag: tags.heading4, color: "#e0e0e0", fontWeight: "600" },
  { tag: tags.heading5, color: "#d8d8d8", fontWeight: "600" },
  { tag: tags.heading6, color: "#c8c8c8", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700", color: "#f2f2f2" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#d4d4d4" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#888" },
  { tag: tags.link, color: "#9d86e9", textDecoration: "underline" },
  { tag: tags.url, color: "#7a9fe8" },
  { tag: tags.monospace, color: "#78c1a1", background: "rgba(120,193,161,0.08)", borderRadius: "3px", padding: "0 2px" },
  { tag: tags.quote, color: "#888", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "#5a5a6a" },
  { tag: tags.contentSeparator, color: "#5a5a6a" },
  { tag: tags.labelName, color: "#9d86e9" },
  { tag: tags.list, color: "#9d86e9" },
  { tag: tags.tagName, color: "#e8845f" },
  { tag: tags.attributeName, color: "#dba56e" },
  { tag: tags.keyword, color: "#c792ea" },
  { tag: tags.string, color: "#c3e88d" },
  { tag: tags.number, color: "#f78c6c" },
  { tag: tags.comment, color: "#5a6a5a", fontStyle: "italic" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.typeName, color: "#FFCB6B" },
  { tag: tags.function(tags.variableName), color: "#82aaff" },
]);

// ─── Light ─────────────────────────────────────────────────────────────────

const lightTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#ffffff", color: "#1a1a1a" },
    ".cm-content": { caretColor: "#6a50c7" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#6a50c7" },
    ".cm-selectionBackground, .cm-content ::selection": {
      background: "rgba(106, 80, 199, 0.15) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      background: "rgba(106, 80, 199, 0.15) !important",
    },
    ".cm-tooltip": { background: "#ffffff", border: "1px solid #d0d0d0" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { color: "#333333" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      background: "#e0d8f8",
      color: "#1a1a1a",
    },
  },
  { dark: false }
);

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "#0d0d0d", fontWeight: "700", fontSize: "1.45em" },
  { tag: tags.heading2, color: "#1a1a1a", fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading3, color: "#222222", fontWeight: "600", fontSize: "1.1em" },
  { tag: tags.heading4, color: "#2a2a2a", fontWeight: "600" },
  { tag: tags.heading5, color: "#333333", fontWeight: "600" },
  { tag: tags.heading6, color: "#444444", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700", color: "#111111" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#333333" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#999" },
  { tag: tags.link, color: "#6a50c7", textDecoration: "underline" },
  { tag: tags.url, color: "#3a6fb5" },
  { tag: tags.monospace, color: "#2a7a5a", background: "rgba(42,122,90,0.08)", borderRadius: "3px", padding: "0 2px" },
  { tag: tags.quote, color: "#888", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "#aaaaaa" },
  { tag: tags.contentSeparator, color: "#aaaaaa" },
  { tag: tags.labelName, color: "#6a50c7" },
  { tag: tags.list, color: "#6a50c7" },
  { tag: tags.tagName, color: "#c0392b" },
  { tag: tags.attributeName, color: "#b7510a" },
  { tag: tags.keyword, color: "#7b2d9e" },
  { tag: tags.string, color: "#3a7a2a" },
  { tag: tags.number, color: "#c0392b" },
  { tag: tags.comment, color: "#888888", fontStyle: "italic" },
  { tag: tags.operator, color: "#1a6080" },
  { tag: tags.typeName, color: "#8a6000" },
  { tag: tags.function(tags.variableName), color: "#1a4faa" },
]);

// ─── Compartment + builder ─────────────────────────────────────────────────

export const themeCompartment = new Compartment();

export function buildThemeExtension(dark: boolean) {
  return dark
    ? [darkTheme, syntaxHighlighting(darkHighlight)]
    : [lightTheme, syntaxHighlighting(lightHighlight)];
}
