/**
 * TypeScript types for Mentra CMS content rendering.
 */
import { ReactNode } from "react";

/** Inline formatting mark applied to a text node. */
export interface TipTapMark {
  type: "bold" | "italic" | "underline" | "strike" | "code" | "link";
  attrs?: {
    href?: string;
    target?: string;
  };
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
  alt?: string;
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
}
