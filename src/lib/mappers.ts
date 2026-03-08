import { type FileInfo } from "@tauri-apps/plugin-fs";
import { Bookmark, BookmarkSection } from "./types";

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

    if (section.body) {
      lines.push(section.body, "");
    }
  }

  return lines.join("\n");
}

// Parses a markdown bookmark file back into a Bookmark object.
export function markdownToBookmark(content: string, info: FileInfo): Bookmark {
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
  const sectionRe = /^(# .+)$/m;
  const parts = body.split(sectionRe);

  const sections: BookmarkSection[] = [];

  for (let i = 1; i < parts.length - 1; i += 2) {
    const heading = parts[i].replace(/^#+\s*/, "").trim();
    const sectionBody = (parts[i + 1] ?? "").trim();

    sections.push({ heading, body: sectionBody });
  }

  const tags = meta["tags"]
    ? meta["tags"]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const mt = info.mtime?.getTime();
  const ct = info.birthtime?.getTime();

  return {
    id: parseInt(meta["id"] ?? "0", 10),
    url: meta["url"] ?? "",
    title: meta["title"] ?? "",
    mtime: mt && !isNaN(mt) ? mt : Date.now(),
    ctime: ct && !isNaN(ct) ? ct : Date.now(),
    tags,
    sections,
  };
}

// Returns the filename for a bookmark (e.g. "42.md")
export function bookmarkFilename(id: number): string {
  return `${id}.md`;
}
