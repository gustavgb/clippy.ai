import { open, save } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  watch,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { type Data, type Link, EMPTY_DATA } from "./types";
import { settings } from "./settings.svelte";

// ─── Reactive Bookmarks Store ──────────────────────────────────────────────

class BookmarkStore {
  filePath = $state<string>("");
  data = $state<Data>(structuredClone(EMPTY_DATA));
  dirty = $state(false);
  saving = $state(false);
  error = $state("");

  // Timestamp of the most recent write — used to suppress our own watch events
  private lastSaveAt = 0;
  private unwatchFn: (() => void) | null = null;

  // ─── Derived ──────────────────────────────────────────────────────────────

  readonly sortedLinks = $derived(
    [...this.data.links].sort((a, b) => b.id - a.id)
  );

  // ─── Window title ──────────────────────────────────────────────────────────

  updateTitle() {
    const name = this.filePath
      ? this.filePath.split("/").at(-1)!
      : "holger.ai";
    const title = this.dirty ? `\u2022 ${name} \u2014 holger.ai` : `${name} \u2014 holger.ai`;
    document.title = title;
    invoke("set_title", { title });
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  async persist(path: string, data: Data) {
    if (!path || this.saving) return;
    try {
      this.saving = true;
      this.lastSaveAt = Date.now();
      await writeTextFile(path, JSON.stringify(data, null, 2));
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = String(e);
    } finally {
      this.saving = false;
    }
    this.updateTitle();
  }

  async save() {
    if (!this.filePath) {
      await this.saveAs();
      return;
    }
    await this.persist(this.filePath, this.data);
  }

  async saveAs() {
    const path = await save({
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    await this.persist(path, this.data);
    if (!this.error) {
      this.filePath = path;
      await settings.setLastFile(path);
      this.updateTitle();
      this._watchFile(path);
    }
  }

  async openPath(path: string) {
    this._stopWatcher();
    try {
      const text = await readTextFile(path);
      const parsed = JSON.parse(text) as Data;
      // Ensure arrays exist for forward compat
      if (!parsed.links) parsed.links = [];
      if (!parsed.collections) parsed.collections = [];
      if (!parsed.idCounter) parsed.idCounter = 0;
      this.data = parsed;
      this.filePath = path;
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = String(e);
    }
    this.updateTitle();
    if (this.filePath) this._watchFile(this.filePath);
    await settings.setLastFile(path);
  }

  async open() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    await this.openPath(path);
  }

  // ─── Link CRUD ─────────────────────────────────────────────────────────────

  addLink(partial: Omit<Link, "id" | "lastUpdated">): Link {
    const id = ++this.data.idCounter;
    const link: Link = {
      id,
      lastUpdated: new Date().toISOString(),
      ...partial,
    };
    this.data.links = [link, ...this.data.links];
    this.dirty = true;
    return link;
  }

  updateLink(updated: Link) {
    const idx = this.data.links.findIndex((l) => l.id === updated.id);
    if (idx === -1) return;
    this.data.links[idx] = { ...updated, lastUpdated: new Date().toISOString() };
    this.dirty = true;
  }

  deleteLink(id: number) {
    this.data.links = this.data.links.filter((l) => l.id !== id);
    this.dirty = true;
  }

  // ─── File watcher ──────────────────────────────────────────────────────────

  private _stopWatcher() {
    this.unwatchFn?.();
    this.unwatchFn = null;
  }

  private _watchFile(path: string) {
    let cancelled = false;
    const self = this;

    watch(
      path,
      async function (event: WatchEvent) {
        if (cancelled) return;
        if (Date.now() - self.lastSaveAt < 500) return;

        const kind = event.type as object;
        const isModify = "modify" in kind;
        const isRemove = "remove" in kind;
        if (!isModify && !isRemove) return;

        if (!cancelled) {
          try {
            const text = await readTextFile(path);
            const parsed = JSON.parse(text) as Data;
            if (!parsed.links) parsed.links = [];
            if (!parsed.collections) parsed.collections = [];
            if (!parsed.idCounter) parsed.idCounter = 0;
            self.data = parsed;
            self.dirty = false;
          } catch {
            // ignore parse errors from external edits
          }
        }
      },
      { delayMs: 300 }
    )
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        this.unwatchFn = () => {
          cancelled = true;
          fn();
        };
      })
      .catch((e) => {
        console.error("[watch] failed to start:", e);
      });
  }
}

export const store = new BookmarkStore();
