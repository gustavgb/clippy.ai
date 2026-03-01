export function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return formatDate(iso);
  } catch {
    return "";
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function fuzzyScore(q: string, target: string): number {
  const ql = q.toLowerCase(),
    tl = target.toLowerCase();
  if (tl.includes(ql)) return 1000 - tl.indexOf(ql);
  let qi = 0,
    score = 0,
    last = -1;
  for (let ti = 0; ti < tl.length && qi < ql.length; ti++) {
    if (tl[ti] === ql[qi]) {
      score +=
        last === ti - 1 ? 10 : /[\s\-_.]/.test(tl[ti - 1] ?? "") ? 8 : 1;
      last = ti;
      qi++;
    }
  }
  return qi === ql.length ? score : -1;
}
