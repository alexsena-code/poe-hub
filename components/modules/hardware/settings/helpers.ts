// Settings-specific helpers: proxy URL masking, date formatting, row styling.
// maskProxyUrl is security-sensitive — credentials must never appear in the table UI.

/**
 * Strips credentials from a proxy URL, exposing only host:port.
 * Handles both full URLs (http://user:pass@host:port) and bare host:port strings.
 *
 * Example: maskProxyUrl("http://u:p@1.2.3.4:8888") => "1.2.3.4:8888"
 */
export function maskProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    // If URL has user:pass@host:port format without protocol
    const atIndex = url.lastIndexOf("@");
    if (atIndex !== -1) return url.slice(atIndex + 1);
    return url;
  }
}

/** Returns a background class based on proxy fail count (red ≥5, yellow ≥1, none otherwise). */
export function proxyRowClass(failCount: number): string {
  if (failCount >= 5) return "bg-red-500/10";
  if (failCount >= 1) return "bg-yellow-500/10";
  return "";
}

/** Formats a nullable ISO datetime to dd/mm HH:MM in pt-BR locale. Returns "-" for null. */
export function formatSettingsDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
