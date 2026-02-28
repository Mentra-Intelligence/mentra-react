# @mentra-intelligence/react

React renderer for [Mentra](https://mentra.systems) headless CMS content.

Renders TipTap/ProseMirror JSON documents returned by the Mentra Public API — so you don't have to understand the underlying document format.

## Install

```bash
npm install @mentra-intelligence/react
```

> Add to `.npmrc`:
> ```
> @mentra-intelligence:registry=https://npm.pkg.github.com
> ```

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
