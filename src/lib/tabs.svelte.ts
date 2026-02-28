export type Tab = "bookmarks" | "settings";

class TabStore {
  activeTab = $state<Tab>("bookmarks");

  setActiveTab = (tab: Tab) => {
    console.log('Set tab: ' + tab);
    this.activeTab = tab;
  };
}

export const tabs = new TabStore()