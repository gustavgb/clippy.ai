import { open, message } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  mkdir,
  readDir,
  remove,
  exists,
  stat,
  watch,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import {
  type Workspace,
  type WorkspaceIndex,
  type Bookmark,
  EMPTY_INDEX,
  bookmarkToMarkdown,
  markdownToBookmark,
  bookmarkFilename,
} from "./types";
import { settings } from "./settings.svelte";
import { bookmarks } from "./bookmarks.svelte";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function indexPath(dirPath: string): string {
  return `${dirPath}/clippy.json`;
}

function bookmarkPath(dirPath: string, id: number): string {
  return `${dirPath}/bookmarks/${bookmarkFilename(id)}`;
}

// ─── Reactive Store ────────────────────────────────────────────────────────

class BookmarkStore {
  dirPath = $state<string>("");
  index = $state<WorkspaceIndex>(structuredClone(EMPTY_INDEX));
  bookmarkList = $state<Bookmark[]>([]);
  /** Maps bookmark id → file mtime (ms). Updated on load, own writes, and watcher reloads. */
  mtimes = $state<Map<number, number>>(new Map());
  /** Increments every time the watcher reloads bookmarks from disk. */
  reloadCount = $state(0);
  dirty = $state(false);
  saving = $state(false);
  error = $state("");

  private pendingWrites = 0;
  private unwatchFns: Array<() => void> = [];

  // ─── Derived ──────────────────────────────────────────────────────────────

  readonly sortedBookmarks = $derived(
    [...this.bookmarkList].sort((a, b) => b.id - a.id),
  );

  // Expose a unified `data`-shaped object so existing UI code keeps working
  readonly data = $derived({
    idCounter: this.index.idCounter,
    bookmarks: this.bookmarkList,
  });

  get filePath(): string {
    return this.dirPath;
  }

  // ─── Window title ──────────────────────────────────────────────────────────

  updateTitle() {
    const name = this.dirPath ? this.dirPath.split("/").at(-1)! : "clippy.ai";
    const title = this.dirty ? `• ${name} — clippy.ai` : `${name} — clippy.ai`;
    document.title = title;
    invoke("set_title", { title });
  }

  // ─── Low-level write helpers ───────────────────────────────────────────────

  private async _writeIndex(dirPath: string, index: WorkspaceIndex) {
    await writeTextFile(indexPath(dirPath), JSON.stringify(index, null, 2));
  }

  private async _writeBookmarkFile(dirPath: string, bookmark: Bookmark) {
    const path = bookmarkPath(dirPath, bookmark.id);
    await writeTextFile(path, bookmarkToMarkdown(bookmark));
  }

  private async _deleteBookmarkFile(dirPath: string, id: number) {
    try {
      await remove(bookmarkPath(dirPath, id));
    } catch {
      // already gone
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /** Persist a single bookmark to disk (called by autosave). */
  async persistBookmark(bookmark: Bookmark) {
    if (!this.dirPath || this.saving) return;
    try {
      this.saving = true;
      this.pendingWrites++;
      const path = bookmarkPath(this.dirPath, bookmark.id);
      await this._writeBookmarkFile(this.dirPath, bookmark);
      // Record the mtime of the file we just wrote so the UI shows the right timestamp
      const info = await stat(path);
      const mt = info.mtime?.getTime();
      const newMtimes = new Map(this.mtimes);
      newMtimes.set(bookmark.id, mt && !isNaN(mt) ? mt : Date.now());
      this.mtimes = newMtimes;
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = String(e);
    } finally {
      this.saving = false;
      this.pendingWrites--;
    }
    this.updateTitle();
  }

  /** Write the current index.json to disk unconditionally (e.g. after idCounter changes). */
  async writeIndex() {
    if (!this.dirPath) return;
    try {
      this.pendingWrites++;
      await this._writeIndex(this.dirPath, this.index);
    } catch (e) {
      this.error = String(e);
    } finally {
      this.pendingWrites--;
    }
  }

  /** Persist the full workspace (index + all changed bookmarks). */
  async save() {
    if (!this.dirPath || this.saving || !this.dirty) return;
    try {
      this.saving = true;
      this.pendingWrites++;
      await this._writeIndex(this.dirPath, this.index);
      // Write all bookmarks (a bulk save — used after structural changes)
      for (const bm of this.bookmarkList) {
        await this._writeBookmarkFile(this.dirPath, bm);
      }
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = String(e);
    } finally {
      this.saving = false;
      this.pendingWrites--;
    }
    this.updateTitle();
  }

  close() {
    this._stopWatchers();
    this.index = structuredClone(EMPTY_INDEX);
    this.bookmarkList = [];
    this.dirPath = "";
    this.dirty = false;
    this.error = "";
    this.updateTitle();
  }

  async openPath(dirPath: string, { silent = false } = {}) {
    this._stopWatchers();
    try {
      const bookmarksDir = `${dirPath}/bookmarks`;

      // Initialise any missing workspace structure
      await mkdir(bookmarksDir, { recursive: true });

      if (!(await exists(indexPath(dirPath)))) {
        await this._writeIndex(dirPath, structuredClone(EMPTY_INDEX));
      }

      // Read index
      const indexText = await readTextFile(indexPath(dirPath));
      const parsedIndex = JSON.parse(indexText) as WorkspaceIndex;

      // Read all bookmark markdown files
      const bookmarkFiles = await readDir(bookmarksDir);
      const loadedBookmarks: Bookmark[] = [];
      const loadedMtimes = new Map<number, number>();
      for (const entry of bookmarkFiles) {
        if (!entry.name.endsWith(".md")) continue;
        const filePath = `${bookmarksDir}/${entry.name}`;
        try {
          const [text, info] = await Promise.all([
            readTextFile(filePath),
            stat(filePath),
          ]);
          const bookmark = markdownToBookmark(text);
          loadedBookmarks.push(bookmark);
          const mt = info.mtime?.getTime();
          loadedMtimes.set(bookmark.id, mt && !isNaN(mt) ? mt : Date.now());
        } catch (e) {
          console.warn(`[store] Failed to parse bookmark ${entry.name}:`, e);
        }
      }

      this.index = parsedIndex;
      this.bookmarkList = loadedBookmarks;
      this.mtimes = loadedMtimes;
      this.dirPath = dirPath;
      this.dirty = false;
      this.error = "";
    } catch (e) {
      console.error("[store] openPath failed:", e);
      if (!silent) {
        await message(`Failed to open workspace:\n${e}`, {
          title: "Cannot open workspace",
          kind: "error",
        });
      }
      this.updateTitle();
      return; // do not add to recents or start watcher on failure
    }
    this.updateTitle();
    this._watchDir(this.dirPath);
    await settings.setLastFile(dirPath);
    bookmarks.activeBookmark = null;
  }

  async openFolder() {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    await this.openPath(path);
  }

  // ─── Bookmark CRUD ─────────────────────────────────────────────────────────

  addBookmark(partial: Omit<Bookmark, "id">): Bookmark {
    const id = ++this.index.idCounter;
    const bookmark: Bookmark = {
      id,
      ...partial,
    };
    this.bookmarkList = [bookmark, ...this.bookmarkList];
    this.dirty = true;
    return bookmark;
  }

  updateBookmark(updated: Bookmark) {
    const idx = this.bookmarkList.findIndex((b) => b.id === updated.id);
    if (idx === -1) return;
    if (JSON.stringify(this.bookmarkList[idx]) === JSON.stringify(updated))
      return;
    this.bookmarkList[idx] = updated;
    this.dirty = true;
  }

  deleteBookmark(id: number) {
    this.bookmarkList = this.bookmarkList.filter((b) => b.id !== id);
    this.dirty = true;
    // Delete the file from disk immediately
    if (this.dirPath) {
      this._deleteBookmarkFile(this.dirPath, id).catch(() => {});
    }
  }

  // ─── File watcher ──────────────────────────────────────────────────────────

  private _stopWatchers() {
    for (const fn of this.unwatchFns) fn();
    this.unwatchFns = [];
  }

  private _watchDir(dirPath: string) {
    let cancelled = false;
    const self = this;

    // Watch the bookmarks sub-directory for individual file changes
    const watchPath = `${dirPath}/bookmarks`;

    watch(
      watchPath,
      async function (event: WatchEvent) {
        if (cancelled) return;
        if (self.pendingWrites > 0) return;
        const kind = event.type as object;
        if (!("modify" in kind) && !("remove" in kind)) return;

        // Reload all bookmarks from disk
        try {
          const bookmarkFiles = await readDir(watchPath);
          const loadedBookmarks: Bookmark[] = [];
          const loadedMtimes = new Map<number, number>();
          for (const entry of bookmarkFiles) {
            if (!entry.name?.endsWith(".md")) continue;
            const filePath = `${watchPath}/${entry.name}`;
            try {
              const [text, info] = await Promise.all([
                readTextFile(filePath),
                stat(filePath),
              ]);
              const bookmark = markdownToBookmark(text);
              loadedBookmarks.push(bookmark);
              const mt = info.mtime?.getTime();
              loadedMtimes.set(bookmark.id, mt && !isNaN(mt) ? mt : Date.now());
            } catch {
              // skip unparseable files
            }
          }
          self.bookmarkList = loadedBookmarks;
          self.mtimes = loadedMtimes;
          self.reloadCount++;
          self.dirty = false;
        } catch {
          // ignore
        }
      },
      { delayMs: 300 },
    )
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        self.unwatchFns.push(() => {
          cancelled = true;
          fn();
        });
      })
      .catch((e) => console.error("[watch bookmarks] failed:", e));

    // Also watch clippy.json for idCounter changes
    let indexCancelled = false;
    watch(
      indexPath(dirPath),
      async function (event: WatchEvent) {
        if (indexCancelled) return;
        if (self.pendingWrites > 0) return;
        const kind = event.type as object;
        if (!("modify" in kind) && !("remove" in kind)) return;
        try {
          const text = await readTextFile(indexPath(dirPath));
          self.index = JSON.parse(text) as WorkspaceIndex;
        } catch {
          // ignore
        }
      },
      { delayMs: 300 },
    )
      .then((fn) => {
        if (indexCancelled) {
          fn();
          return;
        }
        self.unwatchFns.push(() => {
          indexCancelled = true;
          fn();
        });
      })
      .catch((e) => console.error("[watch index] failed:", e));
  }
}

export const store = new BookmarkStore();
