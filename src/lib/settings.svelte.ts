import { invoke } from "@tauri-apps/api/core";
import {
  readTextFile,
  writeTextFile,
  watch,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";

interface Settings {
  lastOpenedFile?: string;
}

class SettingsStore {
  private configPath = $state<string>("");
  lastOpenedFile = $state<string | undefined>(undefined);

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
      };
      await writeTextFile(this.configPath, JSON.stringify(settings, null, 2));
    } catch {
      // ignore
    }
  }

  async setLastFile(path: string) {
    this.lastOpenedFile = path;
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
