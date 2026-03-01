import { open, save } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  watch,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { type Data, type Bookmark, EMPTY_DATA } from "./types";
import { settings } from "./settings.svelte";
import { bookmarks } from "./bookmarks.svelte";

// ─── Reactive Store ────────────────────────────────────────────────────────

class BookmarkStore {
  filePath = $state<string>("");
  data = $state<Data>(structuredClone(EMPTY_DATA));
  dirty = $state(false);
  saving = $state(false);
  error = $state("");

  private lastSaveAt = 0;
  private unwatchFn: (() => void) | null = null;

  // ─── Derived ──────────────────────────────────────────────────────────────

  readonly sortedBookmarks = $derived(
    [...this.data.bookmarks].sort((a, b) => b.id - a.id)
  );

  // ─── Window title ──────────────────────────────────────────────────────────

  updateTitle() {
    const name = this.filePath ? this.filePath.split("/").at(-1)! : "clippy.ai";
    const title = this.dirty ? `• ${name} — clippy.ai` : `${name} — clippy.ai`;
    document.title = title;
    invoke("set_title", { title });
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  async persist(path: string, data: Data) {
    if (!path || this.saving || !this.dirty) return;
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

  close() {
    this._stopWatcher();
    this.data = structuredClone(EMPTY_DATA);
    this.filePath = "";
    this.dirty = false;
    this.error = "";
    this.updateTitle();
  }

  async newFile() {
    this._stopWatcher();
    this.data = structuredClone(EMPTY_DATA);
    this.filePath = "";
    this.dirty = false;
    this.error = "";
    this.updateTitle();
    await this.saveAs();
  }

  async openPath(path: string) {
    this._stopWatcher();
    try {
      const text = await readTextFile(path);
      const parsed = JSON.parse(text) as Data;
      if (!parsed.bookmarks) parsed.bookmarks = [];
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
    bookmarks.activeBookmark = null;
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

  // ─── Bookmark CRUD ─────────────────────────────────────────────────────────

  addBookmark(partial: Omit<Bookmark, "id" | "lastUpdated">): Bookmark {
    const id = ++this.data.idCounter;
    const bookmark: Bookmark = { id, lastUpdated: new Date().toISOString(), ...partial };
    this.data.bookmarks = [bookmark, ...this.data.bookmarks];
    this.dirty = true;
    return bookmark;
  }

  updateBookmark(updated: Bookmark) {
    const idx = this.data.bookmarks.findIndex((b) => b.id === updated.id);
    if (idx === -1) return;
    const { lastUpdated: _a, ...current } = this.data.bookmarks[idx];
    const { lastUpdated: _b, ...incoming } = updated;
    if (JSON.stringify(current) === JSON.stringify(incoming)) return;
    this.data.bookmarks[idx] = { ...updated, lastUpdated: new Date().toISOString() };
    this.dirty = true;
  }

  deleteBookmark(id: number) {
    this.data.bookmarks = this.data.bookmarks.filter((b) => b.id !== id);
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
        if (!("modify" in kind) && !("remove" in kind)) return;
        try {
          const text = await readTextFile(path);
          const parsed = JSON.parse(text) as Data;
          if (!parsed.bookmarks) parsed.bookmarks = [];
          if (!parsed.idCounter) parsed.idCounter = 0;
          self.data = parsed;
          self.dirty = false;
        } catch {
          // ignore parse errors from external edits
        }
      },
      { delayMs: 300 }
    )
      .then((fn) => {
        if (cancelled) { fn(); return; }
        this.unwatchFn = () => { cancelled = true; fn(); };
      })
      .catch((e) => console.error("[watch] failed:", e));
  }
}

export const store = new BookmarkStore();
