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
  date: string;
  sections: BookmarkSection[];
}

export interface WorkspaceFile {
  idCounter: number;
  quickPrompts: QuickPrompt[];
}

export interface Workspace {
  dirPath: string;
  idCounter: number;
  bookmarks: number[];
}

export const NEW_WORKSPACE: WorkspaceFile = {
  idCounter: 0,
  quickPrompts: [
    {
      label: "Summarize",
      labelFetching: "Summarizing",
      title: "AI Summary",
      promptTemplate:
        "Summarize the main content of the following webpage in 3-5 sentences.\n\nWebpage content:\n{content}",
    },
    {
      label: "Analyze credibility",
      labelFetching: "Analyzing credibility",
      title: "Credibility analysis",
      promptTemplate:
        "Analyze and judge the credibility of this content in 5-7 sentences. Be critical but fair.\n\nWebpage content:\n{content}",
    },
  ],
};

export type AIPrompt = {
  title: string;
  promptTemplate: string;
};

export type QuickPrompt = AIPrompt & {
  label: string;
  labelFetching: string;
};
