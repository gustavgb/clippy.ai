import { Bookmark } from "./types";

class BookmarkStore {
  activeBookmark = $state<Bookmark | null>(null);
  addDialogOpen = $state(false);

  showAddDialog = () => this.addDialogOpen = true;
  hideAddDialog = () => this.addDialogOpen = false;

  setActiveBookmark = (bm: Bookmark) => this.activeBookmark = bm;
}

export const bookmarks = new BookmarkStore();