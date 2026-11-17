"use client";
/**
 * The one client component in the page renderer: a `video` block whose
 * output depends on the visitor's reduced-motion setting. Everything else
 * stays server-safe, so `MentraPage` still renders in a React Server
 * Component; this boundary is kept as its own file in the build
 * (`tsup.config.ts`) so the directive survives bundling.
 *
 * Its props are plain JSON from the page response, so a server component
 * can pass them across the boundary.
 */
import { useEffect, useState } from "react";
import type { ResolvedMedia } from "./types";
import { videoFigure, type VideoFields } from "./media";

/**
 * Whether the visitor asked their OS for reduced motion. `true` until the
 * browser has said otherwise, so a server render never autoplays.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function MotionVideo(
  { resolved, content, aspectRatio }: { resolved: Partial<ResolvedMedia>; content: VideoFields; aspectRatio: string },
) {
  const reducedMotion = usePrefersReducedMotion();
  return <>{videoFigure(resolved, content, aspectRatio, reducedMotion)}</>;
}
