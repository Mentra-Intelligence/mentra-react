# @mentra-intelligence/react

React renderer for [Mentra](https://mentra.systems) headless CMS content.

Renders TipTap/ProseMirror JSON documents returned by the Mentra Public API — so you don't have to understand the underlying document format.

## Install

```bash
npm install @mentra-intelligence/react
```

The `MentraPage` example below also uses `isomorphic-dompurify`
(`npm install isomorphic-dompurify`), or any sanitiser of your own.

GitHub Packages needs a token to install any package, public ones included.
Create a personal access token (classic) with the `read:packages` scope, export
it as `NODE_AUTH_TOKEN` (locally, and in CI from a secret), and add to your
project's `.npmrc`:

```
@mentra-intelligence:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

## Quick Start

```tsx
import { MentraContent } from "@mentra-intelligence/react";

function ArticlePage({ content }) {
  return (
    <article>
      <MentraContent doc={content.contentJson} />
    </article>
  );
}
```

## Image Sizing & Alignment

Content creators set image size and alignment in the Mentra editor. Rendered automatically:

| Size | Width | Alignment | Layout |
|------|-------|-----------|--------|
| `small` | 25% | `left` | Float left |
| `medium` | 50% | `center` | Block centered |
| `large` | 75% | `right` | Float right |
| `xl` | 100% | | |

## Custom Overrides

```tsx
<MentraContent
  doc={content.contentJson}
  nodeOverrides={{
    heading: ({ node, children }) => (
      <h2 className="text-2xl font-serif mb-4">{children}</h2>
    ),
  }}
  markOverrides={{
    link: ({ mark, children }) => (
      <a href={mark.attrs?.href} className="text-blue-600 underline">{children}</a>
    ),
  }}
/>
```

## Using `contentHtml`?

```tsx
import "@mentra-intelligence/react/styles";
<div dangerouslySetInnerHTML={{ __html: content.contentHtml }} />
```

## Pages: `MentraPage`

Render a published page from `GET /v1/pages/{slug}` with one component:

```tsx
import { MentraPage } from "@mentra-intelligence/react";
import DOMPurify from "isomorphic-dompurify"; // plain `dompurify` has no `sanitize` in Node

const res = await fetch(`${API}/v1/pages/home`, { headers });
if (!res.ok) throw new Error(`GET /v1/pages/home failed: ${res.status}`); // 404: unknown or unpublished slug
const page = await res.json();

<MentraPage page={page} sanitizeHtml={(html) => DOMPurify.sanitize(html)} />;
```

Every block type has an unstyled default (semantic HTML, `mentra-block-*`
classes). Replace any of them with `blocks`:

```tsx
import { MentraPage, type BlockComponent, type BlockContentMap } from "@mentra-intelligence/react";

const Hero: BlockComponent<BlockContentMap["hero"]> = ({ content, context }) => {
  const href = context.resolveLink(content.ctaLink);
  return (
    <header className="my-hero">
      <h1>{content.heading}</h1>
      {href && content.ctaText && <a href={href}>{content.ctaText}</a>}
    </header>
  );
};

<MentraPage page={page} blocks={{ hero: Hero, testimonials: null /* hide */ }} />;
```

| Prop | Default | |
|------|---------|---|
| `blocks` | defaults | Components by block type. `null` hides a type. A key the package doesn't know adds a type. |
| `jsonLd` | `true` | Render the page's `jsonLd` as `<script type="application/ld+json">`. |
| `sanitizeHtml` | none | Sanitiser for `rich_text` HTML. Without one, `rich_text` renders as plain text. |
| `resolveLink` | external URLs with a safe scheme | `href` for a link. Internal links carry a target id, so they render as text until you map them to your routes. Pages are fetched by slug: map a page id to its slug with `GET /v1/pages`, whose summaries carry both. |
| `resolveItemHref` | none | `href` for a `dynamic_content` item: a standalone article, or a Section node (with its `nodeTypeKey`) when the block's `source` is `section`. Gets `(item, block)`. |
| `renderContextBound` | `false` | Render blocks the response marks `contextBound`. |
| `contentProps` | `{}` | Overrides forwarded to `MentraContent` for article bodies. |
| `theme` | `{}` | Colours, fonts and shape, exposed as CSS variables (`--mentra-color-primary`, `--mentra-font-heading`, `--mentra-radius`, …). |

Block types: `hero` `dynamic_hero` `rich_text` `image` `features_grid`
`testimonials` `faq` `pricing` `cta` `columns` `dynamic_content`
`content_body` `meta_info` `context_navigation`. A block whose type has no
component is skipped, so a page using a type newer than your package version
still renders.

Adding a block type to the package is a one-file change: its content type,
default component and registry entry all live in `src/page/blocks.tsx`.

## Supported Nodes

`doc` `paragraph` `heading` `bulletList` `orderedList` `listItem` `blockquote` `codeBlock` `hardBreak` `horizontalRule` `image` `table` `tableRow` `tableHeader` `tableCell`

## Supported Marks

`bold` `italic` `underline` `strike` `code` `link`

## TypeScript

```tsx
import type { TipTapNode, TipTapMark, ImageAttrs, NodeRenderer, MarkRenderer, MentraContentProps } from "@mentra-intelligence/react";
```

## License

MIT \u00a9 [Mentra Intelligence](https://mentra.systems)
