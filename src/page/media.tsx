/**
 * The markup of the `video` and `embed` blocks, without hooks, so both the
 * server-safe blocks in `blocks.tsx` and the client-only `motion.tsx` can
 * share it.
 *
 * Mentra checks the URL against its allowlist and returns what to play in
 * `block.resolved`; this module uses only that. A frame's `src` is never
 * built from `content.url`, and its `sandbox`, `allow` and `referrerPolicy`
 * are copied from `resolved` unchanged.
 */
import type { HTMLAttributeReferrerPolicy, ReactNode } from "react";
import type { ResolvedMedia } from "./types";
import { str } from "./util";

/** The `video` block fields this module reads. Plain data, so it can cross a client boundary. */
export interface VideoFields {
  title?: unknown;
  poster?: unknown;
  captionsUrl?: unknown;
  autoplay?: unknown;
  loop?: unknown;
}

export function httpsUrl(value: unknown): string | undefined {
  const s = str(value);
  return s && /^https:\/\//i.test(s) ? s : undefined;
}

/**
 * The provider frame for `resolved`, or `null` when it can't be framed safely.
 * A plain function, not a component, so the block can return `null` itself
 * instead of an empty `<figure>`.
 */
export function mediaFrame(
  r: Partial<ResolvedMedia>, title: string, aspectRatio: string, reducedMotion = false,
): ReactNode {
  // An autoplaying player has a still twin for a reduced-motion visitor.
  const src = httpsUrl(reducedMotion && r.reducedMotionEmbedUrl ? r.reducedMotionEmbedUrl : r.embedUrl);
  // A fixed-height player (Spotify) gets its height instead of a shape.
  const height = typeof r.height === "number" && r.height > 0 ? r.height : undefined;
  // Without a sandbox string the frame would get full rights, so don't render it.
  if (!src || typeof r.sandbox !== "string") return null;
  return (
    <iframe
      src={src}
      title={title}
      sandbox={r.sandbox}
      allow={typeof r.allow === "string" ? r.allow : undefined}
      referrerPolicy={typeof r.referrerPolicy === "string" ? (r.referrerPolicy as HTMLAttributeReferrerPolicy) : undefined}
      loading="lazy"
      style={height ? { width: "100%", border: 0, height } : { width: "100%", border: 0, aspectRatio }}
    />
  );
}

/** Whether the `video` block's output depends on the visitor's reduced-motion setting. */
export function videoNeedsMotionCheck(r: Partial<ResolvedMedia>, content: VideoFields): boolean {
  return r.provider === "file" ? content.autoplay === true : typeof r.reducedMotionEmbedUrl === "string";
}

/** The whole `video` block, or `null` when there is nothing safe to play. */
export function videoFigure(
  r: Partial<ResolvedMedia>, content: VideoFields, aspectRatio: string, reducedMotion: boolean,
): ReactNode {
  const title = str(content.title);
  let body: ReactNode;
  if (r.provider === "file") {
    const src = httpsUrl(r.fileUrl);
    if (!src) return null;
    const autoplay = content.autoplay === true && !reducedMotion;
    // No `crossOrigin`: it would put the video request in CORS mode, and a
    // host without CORS headers would then stop the video loading. So the
    // track loads when the browser allows it without CORS (same origin) and
    // otherwise the video plays without captions.
    const captions = httpsUrl(content.captionsUrl);
    body = (
      <video
        // Remount once the browser allows motion: a late `autoPlay` doesn't start playback.
        key={autoplay ? "autoplay" : "still"}
        src={src}
        controls
        poster={httpsUrl(content.poster)}
        muted={autoplay || undefined}
        autoPlay={autoplay || undefined}
        playsInline={autoplay || undefined}
        loop={content.loop === true || undefined}
        aria-label={title}
        style={{ width: "100%" }}
      >
        {captions && <track kind="captions" src={captions} label="Captions" default />}
      </video>
    );
  } else {
    body = mediaFrame(r, title ?? "Video", aspectRatio, reducedMotion);
    if (!body) return null;
  }
  return <figure className="mentra-block mentra-block-video">{body}</figure>;
}
