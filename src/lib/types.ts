export interface BookmarkSection {
  heading: string;
  body: string;
  /** The prompt that was sent to the AI when this section was last summarized. */
  promptUsed?: string;
  /** ISO-8601 timestamp of when the AI summary was last generated. */
  summarizedAt?: string;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tags: string[];
  sections: BookmarkSection[];
}

export interface WorkspaceIndex {
  idCounter: number;
}

export interface Workspace {
  dirPath: string;
  index: WorkspaceIndex;
  bookmarks: Bookmark[];
}

export const EMPTY_INDEX: WorkspaceIndex = {
  idCounter: 0,
};

// The HTML comment delimiters used to wrap AI metadata inside a section.
const AI_META_START = "<!-- ai-meta";
const AI_META_END = "-->";

/**
 * Serialises AI metadata (prompt + timestamp) into an HTML comment block
 * that lives at the very top of the section body, before the summary text.
 *
 * Example output:
 *
 *   <!-- ai-meta
 *   summarizedAt: 2025-01-15T10:30:00.000Z
 *   promptUsed: Summarize the main content…
 *   -->
 *   Actual summary text here.
 */
function serializeAiMeta(promptUsed: string, summarizedAt: string): string {
  // Escape any occurrence of "-->" inside the prompt so we don't break the comment.
  // Escape newlines so the prompt fits on one line, then escape "-->" so we
  // don't accidentally close the HTML comment early.
  const safePrompt = promptUsed
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/-->/g, "--&gt;");
  return [
    AI_META_START,
    `summarizedAt: ${summarizedAt}`,
    `promptUsed: ${safePrompt}`,
    AI_META_END,
  ].join("\n");
}

/**
 * Parses AI metadata out of a section body if the HTML comment block is
 * present.  Returns the metadata fields plus the body with the comment
 * stripped out.
 */
function parseAiMeta(rawBody: string): {
  body: string;
  promptUsed?: string;
  summarizedAt?: string;
} {
  const startIdx = rawBody.indexOf(AI_META_START);
  if (startIdx === -1) {
    return { body: rawBody };
  }

  const endIdx = rawBody.indexOf(AI_META_END, startIdx + AI_META_START.length);
  if (endIdx === -1) {
    return { body: rawBody };
  }

  const metaBlock = rawBody.slice(startIdx + AI_META_START.length, endIdx);
  const afterComment = rawBody.slice(endIdx + AI_META_END.length).trimStart();

  let promptUsed: string | undefined;
  let summarizedAt: string | undefined;

  for (const line of metaBlock.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("summarizedAt: ")) {
      summarizedAt = trimmed.slice("summarizedAt: ".length).trim();
    } else if (trimmed.startsWith("promptUsed: ")) {
      // Un-escape the prompt
      promptUsed = trimmed
        .slice("promptUsed: ".length)
        .trim()
        .replace(/--&gt;/g, "-->")
        .replace(/\\n/g, "\n")
        .replace(/\\\\/g, "\\");
    }
  }

  return { body: afterComment, promptUsed, summarizedAt };
}

// Serialises a Bookmark to its markdown file content.
export function bookmarkToMarkdown(bookmark: Bookmark): string {
  const tags = bookmark.tags.join(", ");
  const lines: string[] = [
    "---",
    `id: ${bookmark.id}`,
    `url: ${bookmark.url}`,
    `title: ${bookmark.title}`,
    `tags: ${tags}`,
    "---",
    "",
  ];

  for (const section of bookmark.sections) {
    lines.push(`# ${section.heading}`, "");

    // If this section has AI metadata, prepend the comment block.
    if (section.promptUsed && section.summarizedAt) {
      lines.push(serializeAiMeta(section.promptUsed, section.summarizedAt), "");
    }

    if (section.body) {
      lines.push(section.body, "");
    }
  }

  return lines.join("\n");
}

// Parses a markdown bookmark file back into a Bookmark object.
export function markdownToBookmark(content: string): Bookmark {
  // Split front-matter from body
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error("Invalid bookmark file: missing front-matter");
  }

  const frontMatter = fmMatch[1];
  const body = fmMatch[2] ?? "";

  // Parse front-matter key: value lines
  const meta: Record<string, string> = {};
  for (const line of frontMatter.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 2).trim();
      meta[key] = value;
    }
  }

  // Split the body on heading lines — parts alternates:
  // [preHeading, heading, body, heading, body, ...]
  const sectionRe = /^(#{1,6} .+)$/m;
  const parts = body.split(sectionRe);

  const sections: BookmarkSection[] = [];

  for (let i = 1; i < parts.length - 1; i += 2) {
    const heading = parts[i].replace(/^#+\s*/, "").trim();
    const rawSectionBody = (parts[i + 1] ?? "").trim();

    const {
      body: sectionBody,
      promptUsed,
      summarizedAt,
    } = parseAiMeta(rawSectionBody);

    sections.push({ heading, body: sectionBody, promptUsed, summarizedAt });
  }

  const tags = meta["tags"]
    ? meta["tags"]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    id: parseInt(meta["id"] ?? "0", 10),
    url: meta["url"] ?? "",
    title: meta["title"] ?? "",
    tags,
    sections,
  };
}

// Returns the filename for a bookmark (e.g. "42.md")
export function bookmarkFilename(id: number): string {
  return `${id}.md`;
}
