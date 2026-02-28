import { invoke } from "@tauri-apps/api/core";
import {
  readTextFile,
  writeTextFile,
  watch,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";

interface Settings {
  lastOpenedFile?: string;
  recentWorkspaces?: string[];
  geminiApiKey?: string;
  geminiModel?: string;
  geminiPrompt?: string;
}

const DEFAULT_MODEL = "models/gemini-2.5-flash-lite";
const DEFAULT_PROMPT =
  "Summarize the main content of the following webpage in 3-5 sentences.\n\nIMPORTANT: Detect the language of the webpage. If the webpage is written in Danish, you MUST write the entire summary in Danish. If it is written in English, write in English. For any other language, write in English.\n\nWebpage content:\n{content}\n\nRemember: if the webpage above is in Danish, your summary MUST be in Danish.";

const MAX_RECENT = 10;

function sortByFilename(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const nameA = a.split("/").at(-1)!.toLowerCase();
    const nameB = b.split("/").at(-1)!.toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

class SettingsStore {
  private configPath = $state<string>("");
  lastOpenedFile = $state<string | undefined>(undefined);
  recentWorkspaces = $state<string[]>([]);
  geminiApiKey = $state<string>("");
  geminiModel = $state<string>(DEFAULT_MODEL);
  geminiPrompt = $state<string>(DEFAULT_PROMPT);

  private unwatchFn: (() => void) | null = null;
  private lastSaveAt = 0;

  async init() {
    const configPath = await invoke<string>("get_settings_path");
    this.configPath = configPath;

    // Load or create settings file
    try {
      const text = await readTextFile(configPath);
      const parsed = JSON.parse(text) as Settings;
      this.lastOpenedFile = parsed.lastOpenedFile;
      if (parsed.recentWorkspaces && parsed.recentWorkspaces.length > 0) {
        this.recentWorkspaces = sortByFilename(parsed.recentWorkspaces.slice(0, MAX_RECENT));
      } else if (parsed.lastOpenedFile) {
        // Migrate from old single-file format
        this.recentWorkspaces = [parsed.lastOpenedFile];
      }
      this.geminiApiKey = parsed.geminiApiKey ?? "";
      this.geminiModel = parsed.geminiModel ?? DEFAULT_MODEL;
      this.geminiPrompt = parsed.geminiPrompt ?? DEFAULT_PROMPT;
    } catch {
      // File doesn't exist yet — write defaults
      await this._write();
    }

    this._watchFile();
  }

  private async _write() {
    if (!this.configPath) return;
    try {
      this.lastSaveAt = Date.now();
      const settings: Settings = {
        lastOpenedFile: this.lastOpenedFile,
        recentWorkspaces: this.recentWorkspaces,
        geminiApiKey: this.geminiApiKey || undefined,
        geminiModel: this.geminiModel,
        geminiPrompt: this.geminiPrompt,
      };
      await writeTextFile(this.configPath, JSON.stringify(settings, null, 2));
    } catch {
      // ignore
    }
  }

  async setLastFile(path: string) {
    this.lastOpenedFile = path;
    // Add to set, cap at MAX_RECENT, then sort alphabetically by filename
    const updated = [path, ...this.recentWorkspaces.filter((p) => p !== path)].slice(0, MAX_RECENT);
    this.recentWorkspaces = sortByFilename(updated);
    await this._write();
  }

  async setGeminiApiKey(key: string) {
    this.geminiApiKey = key;
    await this._write();
  }

  async setGeminiModel(model: string) {
    this.geminiModel = model;
    await this._write();
  }

  async setGeminiPrompt(prompt: string) {
    this.geminiPrompt = prompt;
    await this._write();
  }

  private _watchFile() {
    const configPath = this.configPath;
    if (!configPath) return;

    let cancelled = false;
    const self = this;

    watch(
      configPath,
      async function (event: WatchEvent) {
        if (cancelled) return;
        if (Date.now() - self.lastSaveAt < 500) return;

        const kind = event.type as object;
        const isModify = "modify" in kind;
        const isRemove = "remove" in kind;
        if (!isModify && !isRemove) return;

        try {
          const text = await readTextFile(configPath);
          const parsed = JSON.parse(text) as Settings;
          self.lastOpenedFile = parsed.lastOpenedFile;
          if (parsed.recentWorkspaces && parsed.recentWorkspaces.length > 0) {
            self.recentWorkspaces = sortByFilename(parsed.recentWorkspaces.slice(0, MAX_RECENT));
          } else if (parsed.lastOpenedFile) {
            self.recentWorkspaces = [parsed.lastOpenedFile];
          }
          self.geminiApiKey = parsed.geminiApiKey ?? "";
          self.geminiModel = parsed.geminiModel ?? DEFAULT_MODEL;
          self.geminiPrompt = parsed.geminiPrompt ?? DEFAULT_PROMPT;
        } catch {
          // ignore
        }
      },
      { delayMs: 200 }
    )
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        self.unwatchFn = () => {
          cancelled = true;
          fn();
        };
      })
      .catch((e) => {
        console.error("[settings watch] failed:", e);
      });
  }
}

export const settings = new SettingsStore();
