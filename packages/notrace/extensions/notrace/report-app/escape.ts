export function escapeHtml(v: unknown): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  };
  return String(v ?? "").replace(/[&<>'"]/g, c => map[c]);
}
