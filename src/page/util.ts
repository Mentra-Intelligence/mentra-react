/** Defensive accessors: page content is tenant data and may be malformed. */

/** A non-empty trimmed string, or `undefined`. */
export function str(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t : undefined;
}

/** The non-empty strings of a list. */
export function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str).filter((s): s is string => !!s) : [];
}

/** The object entries of a list, skipping `null` and non-object entries. */
export function list<T = Record<string, any>>(value: unknown): T[] {
  return Array.isArray(value)
    ? (value.filter((v) => v !== null && typeof v === "object" && !Array.isArray(v)) as T[])
    : [];
}

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const IMAGE_SCHEMES = new Set(["http:", "https:"]);

function hasSafeScheme(url: string, schemes: Set<string>): boolean {
  // Strip what browsers ignore before parsing a scheme (`java\tscript:`).
  const cleaned = url.replace(/[\u0000- \u007f]/g, "");
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
  if (!match) return true; // relative
  return schemes.has(match[1].toLowerCase() + ":");
}

/**
 * The URL when it is relative or uses http, https, mailto or tel (the same
 * set Mentra's `/v1` allows), otherwise `undefined`.
 */
export function safeHref(url: unknown): string | undefined {
  const s = str(url);
  return s && hasSafeScheme(s, SAFE_SCHEMES) ? s : undefined;
}

/** The URL when it is relative or http(s), otherwise `undefined`. */
export function safeImageSrc(url: unknown): string | undefined {
  const s = str(url);
  return s && hasSafeScheme(s, IMAGE_SCHEMES) ? s : undefined;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/**
 * Plain text of an HTML fragment, for rendering `rich_text` when the site
 * passes no sanitiser. Block-level closes become paragraph breaks. The output
 * is rendered as text by React, so nothing in it is ever executed.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr|section|article)\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
