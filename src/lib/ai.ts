import { invoke } from "@tauri-apps/api/core";
import { settings } from "./settings.svelte";
import { Bookmark } from "./types";
import { store } from "./store.svelte";

export async function fetchSummary(bookmark: Bookmark) {
  if (!settings.geminiApiKey) return;

  const usedPrompt = settings.geminiPrompt;
  const result = await invoke<string>("fetch_ai_summary", {
    url: bookmark.url,
    apiKey: settings.geminiApiKey,
    model: settings.geminiModel,
    promptTemplate: usedPrompt,
  });
  const summarizedAt = new Date().toISOString();
  // Update or insert the Summary section directly in the store bookmark
  const idx = bookmark.sections.findIndex((s) => s.heading === "Summary");
  const updatedSection = {
    heading: "Summary",
    body: result,
    promptUsed: usedPrompt,
    summarizedAt,
  };
  const newSections =
    idx !== -1
      ? bookmark.sections.map((s, i) => (i === idx ? updatedSection : s))
      : [updatedSection, ...bookmark.sections];
  const updated = { ...bookmark, sections: newSections };
  store.updateBookmark(updated);
  store.saveBookmarks();
}
