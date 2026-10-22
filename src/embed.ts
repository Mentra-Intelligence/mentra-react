/**
 * The provider allowlist for article `embed` nodes.
 *
 * A port of Mentra's `frontend/src/utils/mediaEmbed.ts` (itself a mirror of
 * `backend/app/libs/page_block_media.py`). An `embed` node carries only the
 * URL the author pasted, so the renderer parses it here and frames the URL
 * the parser *builds*, never the stored one. Mentra refuses an off-list URL
 * on save; anything that reaches this package anyway is never framed.
 */

export type MediaProvider = 'youtube' | 'vimeo' | 'loom' | 'spotify' | 'google_maps';

/** No `allow-top-navigation*` (an embed can't redirect the page), no `allow-forms`. */
export const IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';
export const IFRAME_ALLOW = 'encrypted-media; picture-in-picture; fullscreen';
export const IFRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin';
/** Players that only start playback when the frame is delegated `autoplay`. */
export const ALWAYS_AUTOPLAY_PROVIDERS: ReadonlySet<string> = new Set(['spotify']);

const FORBIDDEN_PUNCT = new Set(['<', '>', '"', "'", '`', '\\']);
/** Control characters, space, DEL, or a character that could break out of an attribute. */
const hasForbiddenChar = (s: string) =>
  Array.from(s).some((c) => c.charCodeAt(0) <= 0x20 || c.charCodeAt(0) === 0x7f || FORBIDDEN_PUNCT.has(c));
const URL_PARTS = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DIGITS = /^[0-9]{1,20}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;
const LOOM_ID = /^[0-9a-f]{32}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_LOCALE = /^intl-[a-z]{2}(?:-[a-z]{2})?$/;
const SPOTIFY_KINDS = new Set(['artist', 'episode', 'show', 'track', 'album', 'playlist']);
const MAPS_QUERY = /^pb=[A-Za-z0-9!._*%-]{1,4000}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export interface Split {
  host: string;
  path: string;
  rawQuery: string;
  query: URLSearchParams;
}

/**
 * The whole authority as typed, lowercased: a DNS name in canonical ASCII form
 * (IDNs as `xn--` punycode) whose last label starts with a letter, and at most
 * an explicit `:443`. Same rule as `_CANONICAL_AUTHORITY` in the backend.
 */
const CANONICAL_AUTHORITY = /^((?:[a-z0-9-]+\.)*[a-z][a-z0-9-]*)(?::443)?$/;

/** `{host, path, rawQuery, query}` of an acceptable https URL. */
export function split(url: unknown): Split | null {
  if (typeof url !== 'string' || !url || url.length > 2048 || hasForbiddenChar(url)) return null;
  const m = URL_PARTS.exec(url);
  if (!m || m[1].toLowerCase() !== 'https') return null;
  const netloc = m[2];
  if (!netloc || netloc.includes('@')) return null;
  // The platform parser decides host and port, so a malformed authority
  // (`foo:bar:443`) is refused here as it is by the browser and the backend.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url as string);
  } catch {
    return null;
  }
  if (!parsedUrl.hostname || (parsedUrl.port !== '' && parsedUrl.port !== '443')) return null;
  // `URL()` decodes and maps the host (`www%2eyoutube.com` and fullwidth
  // letters become `www.youtube.com`, `127.1` becomes `127.0.0.1`) and drops
  // an empty or padded port (`host:`, `:0443`); the backend's `urlsplit`
  // doesn't. Accept only an authority already in that canonical form, so the
  // two agree on the host.
  const authority = CANONICAL_AUTHORITY.exec(netloc.toLowerCase());
  if (!authority || authority[1] !== parsedUrl.hostname) return null;
  const rawQuery = m[4] ?? '';
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(rawQuery);
  } catch {
    return null;
  }
  return { host: parsedUrl.hostname.toLowerCase(), path: m[3], rawQuery, query };
}

const segments = (path: string) => path.split('/').filter(Boolean);

function single(query: URLSearchParams, key: string): string | null {
  const values = query.getAll(key).filter((v) => v !== '');
  return values.length === 1 ? values[0] : null;
}

function youtube({ host, path, query }: Split): string | null {
  const segs = segments(path);
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = segs.length === 1 ? segs[0] : null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segs.length === 1 && segs[0] === 'watch') id = single(query, 'v');
    else if (segs.length === 2 && ['embed', 'shorts', 'live'].includes(segs[0])) id = segs[1];
  }
  return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

function vimeo({ host, path, query }: Split): string | null {
  const segs = segments(path);
  let id: string | null = null;
  let hash: string | null = null;
  if ((host === 'vimeo.com' || host === 'www.vimeo.com') && segs.length >= 1 && segs.length <= 2) {
    id = segs[0];
    hash = segs.length === 2 ? segs[1] : null;
  } else if (host === 'player.vimeo.com' && segs.length === 2 && segs[0] === 'video') {
    id = segs[1];
    hash = single(query, 'h');
  }
  if (!id || !DIGITS.test(id)) return null;
  if (hash !== null && !VIMEO_HASH.test(hash)) return null;
  return `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&dnt=1` : 'dnt=1'}`;
}

function loom({ host, path }: Split): string | null {
  const segs = segments(path);
  if ((host === 'loom.com' || host === 'www.loom.com') && segs.length === 2 && ['share', 'embed'].includes(segs[0])) {
    if (LOOM_ID.test(segs[1])) return `https://www.loom.com/embed/${segs[1]}`;
  }
  return null;
}

function spotify({ host, path }: Split): string | null {
  if (host !== 'open.spotify.com') return null;
  let segs = segments(path);
  // Spotify's localized links: `/intl-de/track/<id>`.
  if (segs.length && SPOTIFY_LOCALE.test(segs[0])) segs = segs.slice(1);
  if (segs[0] === 'embed') segs = segs.slice(1);
  if (segs.length === 2 && SPOTIFY_KINDS.has(segs[0]) && SPOTIFY_ID.test(segs[1])) {
    return `https://open.spotify.com/embed/${segs[0]}/${segs[1]}`;
  }
  return null;
}

function googleMaps({ host, path, rawQuery }: Split): string | null {
  if (host === 'www.google.com' && path === '/maps/embed' && MAPS_QUERY.test(rawQuery)) {
    return `https://www.google.com/maps/embed?${rawQuery}`;
  }
  return null;
}

const PROVIDERS: ReadonlyArray<[MediaProvider, (s: Split) => string | null]> = [
  ['youtube', youtube],
  ['vimeo', vimeo],
  ['loom', loom],
  ['spotify', spotify],
  ['google_maps', googleMaps],
];

/** The provider and iframe `src` for an allowlisted `url`, or `null`. */
export function parseEmbedUrl(url: unknown): { provider: MediaProvider; embedUrl: string } | null {
  const s = split(url);
  if (!s) return null;
  for (const [provider, parse] of PROVIDERS) {
    const embedUrl = parse(s);
    if (embedUrl) return { provider, embedUrl };
  }
  return null;
}

export function isSafeHttpsUrl(url: unknown): url is string {
  return split(url) !== null;
}

/** `allow` for a provider frame: `autoplay` only when the player requires it. */
export function iframeAllow(provider: string): string {
  return ALWAYS_AUTOPLAY_PROVIDERS.has(provider) ? `autoplay; ${IFRAME_ALLOW}` : IFRAME_ALLOW;
}
