export interface BookmarkSection {
  heading: string;
  body: string;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tags: string[];
  mtime: number;
  ctime: number;
  sections: BookmarkSection[];
}

export interface WorkspaceFile {
  idCounter: number;
}

export interface Workspace {
  dirPath: string;
  idCounter: number;
  bookmarks: number[];
}

export const EMPTY_INDEX: WorkspaceFile = {
  idCounter: 0,
};
