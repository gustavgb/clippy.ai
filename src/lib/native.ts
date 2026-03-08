import { invoke } from "@tauri-apps/api/core";

export const updateTitle = (title: string) => {
  document.title = title;
  invoke("set_title", { title });
};
