/**
 * TypeScript types for Mentra CMS content rendering.
 */
import { ReactNode } from "react";

/** Inline formatting mark applied to a text node. */
export interface TipTapMark {
  type: "bold" | "italic" | "underline" | "strike" | "code" | "link";
  attrs?: {
    href?: string;
    target?: string | null;
    /**
     * Set on an internal link: the id of the Mentra article it points to.
     * The API has already checked that the article is yours and published.
     */
    contentId?: string | null;
    /** The target article's current slug. Present on a resolved internal link. */
    slug?: string;
  };
}

/** An internal link to another of your Mentra articles. */
export interface InternalLink {
  contentId: string;
  /** The target's current slug, from the API. */
  slug?: string;
  /** `/{slug}`, relative to the site root. */
  href?: string;
}

/** A single node in the TipTap/ProseMirror document tree. */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
}

/** Image-specific attributes on an image node. */
export interface ImageAttrs {
  src: string;
  /** Alt text. When empty, the caption is used instead. */
  alt?: string | null;
  caption?: string | null;
  size?: "small" | "medium" | "large" | "xl" | null;
  alignment?: "left" | "center" | "right" | null;
}

/** Custom renderer for a node type. */
export type NodeRenderer = (props: {
  node: TipTapNode;
  children: ReactNode;
}) => ReactNode;

/** Custom renderer for a mark type. */
export type MarkRenderer = (props: {
  mark: TipTapMark;
  children: ReactNode;
}) => ReactNode;

/** Props for the MentraContent component. */
export interface MentraContentProps {
  doc: TipTapNode;
  nodeOverrides?: Record<string, NodeRenderer>;
  markOverrides?: Record<string, MarkRenderer>;
  /**
   * The `href` for an internal link (a link mark with a `contentId`).
   * Defaults to the link's own `href`, `/{slug}`. Return `undefined` to render
   * the link's text without a link. Not used when you override `link`.
   */
  resolveInternalLink?: (link: InternalLink) => string | undefined;
}
