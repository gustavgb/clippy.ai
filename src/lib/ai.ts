import { invoke } from "@tauri-apps/api/core";
import { settings } from "./settings.svelte";
import { Bookmark } from "./types";
import { store } from "./store.svelte";
import { formatDateTime } from "./utils";
import { message } from "@tauri-apps/plugin-dialog";

export type AIPrompt = {
  title: string;
  promptTemplate: string;
};

export type QuickPrompt = AIPrompt & {
  label: string;
  labelFetching: string;
};

const QUESTION_TEMPLATE = `Answer the question regarding this webpage.\n\nWebpage content:\n{content}\n\n{question}`;

export const quickPrompts: QuickPrompt[] = [
  {
    label: "Summarize",
    labelFetching: "Summarizing",
    title: "AI Summary",
    promptTemplate:
      "Summarize the main content of the following webpage in 3-5 sentences.\n\nWebpage content:\n{content}",
  },
  {
    label: "Analyze credibility",
    labelFetching: "Analyzing credibility",
    title: "Credibility analysis",
    promptTemplate:
      "Analyze and judge the credibility of this content in 5-7 sentences. Be critical but fair.\n\nWebpage content:\n{content}",
  },
];

export function getQuestionPrompt(question: string): AIPrompt {
  return {
    promptTemplate: QUESTION_TEMPLATE.replace("{question}", question),
    title: question,
  };
}

export async function fetchAnswer(bookmark: Bookmark, prompt: AIPrompt) {
  if (!settings.geminiApiKey) return;
  let result;

  try {
    result = await invoke<string>("fetch_ai_summary", {
      url: bookmark.url,
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel,
      promptTemplate: prompt.promptTemplate,
    });
  } catch (err: any) {
    await message(String(err), { title: "AI error", kind: "error" });
    return;
  }

  // Update or insert the Summary section directly in the store bookmark
  const b = store.bookmarks.get(bookmark.id);
  if (!b) return;
  const updated = {
    ...b,
    sections: [
      {
        heading: `${prompt.title} (${formatDateTime(Date.now())} by ${settings.geminiModel.split("/").at(-1)})`,
        body: result,
      },
      ...b.sections,
    ],
  };
  store.updateBookmark(updated);
  store.saveBookmarks();
}
