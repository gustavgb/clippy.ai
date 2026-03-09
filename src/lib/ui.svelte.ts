export type Tab = "bookmarks" | "settings";

class UIStore {
  activeBookmarkId = $state<number | null>(null);
  addDialogOpen = $state(false);
  activeTab = $state<Tab>("bookmarks");

  setActiveTab = (tab: Tab) => {
    this.activeTab = tab;
  };

  showAddDialog = () => (this.addDialogOpen = true);
  hideAddDialog = () => (this.addDialogOpen = false);
}

export const ui = new UIStore();
