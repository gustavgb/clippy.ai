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
import {
  type WorkspaceFile,
  type Bookmark,
  NEW_WORKSPACE,
  type QuickPrompt,
} from "./types";
import {
  bookmarkToMarkdown,
  markdownToBookmark,
  bookmarkFilename,
} from "./mappers";
import { settings } from "./settings.svelte";
import { updateTitle } from "./native";
import { ui } from "./ui.svelte";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function indexPath(dirPath: string): string {
  return `${dirPath}/clippy.json`;
}

function bookmarkPath(dirPath: string, id: number): string {
  return `${dirPath}/bookmarks/${bookmarkFilename(id)}`;
}

// ─── Reactive Store ────────────────────────────────────────────────────────

class BookmarkStore {
  // Workspace state
  dirPath = $state<string>("");
  bookmarkIds = $state<number[]>([]);
  idCounter = $state<number>(0);
  quickPrompts = $state<QuickPrompt[]>([]);

  // Bookmarks state
  bookmarks = $state<Map<number, Bookmark>>(new Map());
  dirty = $state<number[]>([]);
  saving = $state(false);
  lastSaveTime = $state(0);

  private unwatchFns: Array<() => void> = [];
  private watchGeneration = 0;

  // ─── Low-level write helpers ───────────────────────────────────────────────

  private async _writeWorkspaceFile() {
    if (!this.dirPath) return;

    await writeTextFile(
      indexPath(this.dirPath),
      JSON.stringify(
        {
          idCounter: this.idCounter,
          quickPrompts: this.quickPrompts,
        },
        null,
        2,
      ),
    );
  }

  private async _writeBookmarkFile(bookmark: Bookmark) {
    const path = bookmarkPath(this.dirPath, bookmark.id);
    await writeTextFile(path, bookmarkToMarkdown(bookmark));
  }

  private async _deleteBookmarkFile(id: number) {
    try {
      await remove(bookmarkPath(this.dirPath, id));
    } catch {
      // already gone
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /** Save all dirty bookmarks */
  async saveBookmarks() {
    if (!this.dirPath || this.saving) return;
    try {
      this.saving = true;

      for (let i = this.dirty.length - 1; i >= 0; i--) {
        const id = this.dirty[i];
        const path = bookmarkPath(this.dirPath, id);
        const bookmark = this.bookmarks.get(id);
        if (bookmark) {
          await this._writeBookmarkFile(bookmark);
          this.dirty.splice(i, 1);

          const info = await stat(path);
          const mt = info.mtime?.getTime();
          this.bookmarks.set(id, {
            ...bookmark,
            mtime: mt && !isNaN(mt) ? mt : Date.now(),
          });
        }
      }

      this.lastSaveTime = Date.now();
    } catch (e) {
      console.error(String(e));
    } finally {
      this.saving = false;
    }
  }

  close() {
    this._stopWatchers();
    this.idCounter = 0;
    this.bookmarkIds = [];
    this.bookmarks = new Map();
    this.dirPath = "";
    this.dirty = [];
    updateTitle("clippy.ai");
  }

  async openPath(
    dirPath: string,
    { shouldWatchDir = true, silent = false, closeBookmark = true } = {},
  ) {
    if (shouldWatchDir) this._stopWatchers();
    try {
      const bookmarksDir = `${dirPath}/bookmarks`;

      this.dirPath = dirPath;

      // Initialise any missing workspace structure
      await mkdir(bookmarksDir, { recursive: true });

      if (!(await exists(indexPath(dirPath)))) {
        await writeTextFile(
          indexPath(this.dirPath),
          JSON.stringify(NEW_WORKSPACE, null, 2),
        );
      }

      // Read index
      const parsedWorkspaceFile = JSON.parse(
        await readTextFile(indexPath(dirPath)),
      ) as WorkspaceFile;

      // Read all bookmark markdown files
      const bookmarkFiles = await readDir(bookmarksDir);
      const bookmarkIds: number[] = [];
      const bookmarks: Map<number, Bookmark> = new Map();

      for (const entry of bookmarkFiles) {
        if (!entry.name.endsWith(".md")) continue;
        const filePath = `${bookmarksDir}/${entry.name}`;
        try {
          const [text, info] = await Promise.all([
            readTextFile(filePath),
            stat(filePath),
          ]);
          const bookmark = markdownToBookmark(text, info);
          bookmarks.set(bookmark.id, bookmark);
          bookmarkIds.push(bookmark.id);
        } catch (e) {
          console.warn(`[store] Failed to parse bookmark ${entry.name}:`, e);
        }
      }

      this.bookmarkIds = bookmarkIds;
      this.idCounter = parsedWorkspaceFile.idCounter;
      this.quickPrompts =
        parsedWorkspaceFile.quickPrompts || NEW_WORKSPACE.quickPrompts;
      this.bookmarks = bookmarks;
      this.dirPath = dirPath;
      this.dirty = [];
    } catch (e) {
      console.error("[store] openPath failed:", e);
      if (!silent) {
        await message(`Failed to open workspace:\n${e}`, {
          title: "Cannot open workspace",
          kind: "error",
        });
      }
      return; // do not add to recents or start watcher on failure
    } finally {
      updateTitle(
        this.dirPath
          ? `${this.dirPath.split("/").at(-1)!} - clippy.ai`
          : "clippy.ai",
      );
    }
    if (shouldWatchDir) this._watchDir(this.dirPath);
    await settings.setLastFile(dirPath);
    if (closeBookmark) ui.activeBookmarkId = null;
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

  addBookmark(partial: Omit<Bookmark, "id" | "mtime" | "date">): Bookmark {
    const id = ++this.idCounter;
    const bookmark: Bookmark = {
      id,
      mtime: Date.now(),
      date: new Date().toISOString(),
      ...partial,
    };
    this.bookmarkIds = [id, ...this.bookmarkIds];
    this.bookmarks = new Map(this.bookmarks).set(id, bookmark);
    this.dirty.push(id);

    this._writeWorkspaceFile();
    this.saveBookmarks();

    return bookmark;
  }

  updateBookmark(updated: Bookmark) {
    if (
      JSON.stringify(this.bookmarks.get(updated.id)) === JSON.stringify(updated)
    )
      return;
    // Reassign the Map reference so Svelte's $derived tracks the change
    this.bookmarks = new Map(this.bookmarks).set(updated.id, updated);
    if (this.dirty.indexOf(updated.id) === -1) {
      this.dirty.push(updated.id);
    }
  }

  deleteBookmark(id: number) {
    this.bookmarkIds = this.bookmarkIds.filter(
      (bookmarkId) => bookmarkId !== id,
    );
    // Delete the file from disk immediately
    if (this.dirPath) {
      this._deleteBookmarkFile(id).catch(() => {});
    }
  }

  // ─── File watcher ──────────────────────────────────────────────────────────

  private _stopWatchers() {
    this.watchGeneration++;
    for (const fn of this.unwatchFns) fn();
    this.unwatchFns = [];
  }

  private _watchDir(dirPath: string) {
    const generation = this.watchGeneration;

    const isStale = () => generation !== this.watchGeneration;

    // Watch the bookmarks sub-directory for individual file changes
    const watchPath = `${dirPath}/bookmarks`;

    watch(
      watchPath,
      async (event: WatchEvent) => {
        if (isStale() || this.saving || Date.now() - this.lastSaveTime < 500)
          return;
        const kind = event.type as object;
        if (!("modify" in kind) && !("remove" in kind)) return;

        this.openPath(dirPath, {
          silent: true,
          shouldWatchDir: false,
          closeBookmark: false,
        });
      },
      { delayMs: 300 },
    )
      .then((fn) => {
        if (isStale()) {
          fn();
          return;
        }
        this.unwatchFns.push(fn);
      })
      .catch((e) => console.error("[watch bookmarks] failed:", e));

    // Also watch clippy.json for idCounter changes
    watch(
      indexPath(dirPath),
      async (event: WatchEvent) => {
        if (isStale()) return;
        const kind = event.type as object;
        if (!("modify" in kind) && !("remove" in kind)) return;
        try {
          this.openPath(dirPath, {
            silent: true,
            shouldWatchDir: !!("remove" in kind),
            closeBookmark: false,
          });
        } catch {
          // ignore
        }
      },
      { delayMs: 300 },
    )
      .then((fn) => {
        if (isStale()) {
          fn();
          return;
        }
        this.unwatchFns.push(fn);
      })
      .catch((e) => console.error("[watch index] failed:", e));
  }
}

export const store = new BookmarkStore();

// Tear down all watchers when the JS context is destroyed (HMR / page reload).
// Without this, Rust keeps firing callbacks into dead callback IDs, which
// produces the "Couldn't find callback id" warning.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    store["_stopWatchers"]();
  });
}
