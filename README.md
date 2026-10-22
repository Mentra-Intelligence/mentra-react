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

Block types: `hero` `dynamic_hero` `rich_text` `image` `video` `embed` `features_grid`
`testimonials` `faq` `pricing` `cta` `columns` `dynamic_content`
`content_body` `meta_info` `context_navigation` `form`. A block whose type has no
component is skipped, so a page using a type newer than your package version
still renders.

### Video and embed blocks

`video` and `embed` render only what `/v1/pages` returns in the block's
`resolved`, which Mentra builds after checking the URL against its allowlist:

- A provider (YouTube, Vimeo, Loom, Spotify, Google Maps) renders an
  `<iframe>` whose `src` is `resolved.embedUrl` and whose `sandbox`, `allow`
  and `referrerPolicy` are copied from `resolved` unchanged, with
  `loading="lazy"`. The frame is never built from `content.url`. An `embed`
  takes its shape from `aspectRatio` (`16:9`, the default, `4:3`, `1:1` or
  `9:16`); a `video` frame is 16:9.
- A video file (`resolved.provider === "file"`) renders `<video controls>`
  from `resolved.fileUrl`, with `poster`, a captions `<track>`, and
  `muted autoPlay playsInline` / `loop` when the block asks for them.
- `resolved: null` (the stored URL failed the check) renders nothing.

The default `<video>` sets no `crossOrigin`, because CORS mode would stop the
video loading from a host that sends no CORS headers. A captions file on
another origin therefore isn't loaded, and the video plays without captions.
To load cross-origin captions, override `video` with a client component that
sets `crossOrigin="anonymous"` and drops it on the video's `error` event, as
Mentra's own `frontend/src/components/VideoBlock.tsx` does.

If your site sends a Content-Security-Policy, allow the player hosts in
`frame-src`:

```
frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com https://open.spotify.com https://www.google.com
```

Mentra keeps this list as `FRAME_HOSTS` in `backend/app/libs/page_block_media.py`.
Video files can be on any `https` host, so `media-src` needs `https:`.

### Form blocks

A `form` block is a newsletter sign-up whose submission goes from the
visitor's browser straight to the tenant's own service: Mentra never
receives or stores what a visitor types. `/v1/pages` puts how to submit in
the block's `resolved` (`type`, `submitUrl`, `fieldNames`, `honeypotField`,
`preview`); the block's `content` holds the labels and only public
identifiers, never an API key.

The default `FormBlock` is a native HTML form, so it needs no client script:

- `webhook` posts to `resolved.submitUrl`, and the page navigates to the
  endpoint's reply.
- `mailchimp` posts to `resolved.submitUrl` in a new tab, where Mailchimp
  shows its own confirmation.
- `hubspot` takes only a JSON body, which a native form can't send, so the
  default renders nothing on a live read. Override `form` (below).
- A preview read (`resolved.preview: true`, from a draft or preview-token
  request) draws the form with the button disabled and says submitting is
  off; it never gets the live URL. So does any `resolved` without an
  `https` `submitUrl`.
- `resolved: null` (no destination, or one Mentra's checks refuse) renders
  nothing.

Every form carries a honeypot: a hidden input named `resolved.honeypotField`,
off-screen in an `aria-hidden` wrapper with `tabIndex={-1}`. People leave it
empty and many bots fill it. **A custom form must add one too**, and must
send nothing when it is filled.

To stay on the page and show `successMessage`, or to support HubSpot,
override `form` with a client component that calls `submitMentraForm`. It
posts a webhook form-encoded with `mode: "no-cors"` (so `"sent"` means the
browser sent it; the reply can't be read), uses Mailchimp's JSONP endpoint
(your `script-src` must allow the `list-manage.com` host), and posts HubSpot
JSON. It throws on a preview read and returns `"skipped"` without sending
when the honeypot is filled.

```tsx
"use client";
import { useState } from "react";
import { submitMentraForm, type BlockComponent, type BlockContentMap } from "@mentra-intelligence/react";

export const SignupForm: BlockComponent<BlockContentMap["form"]> = ({ block, content }) => {
  const r = block.resolved;
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  if (!r?.fieldNames || !r.honeypotField) return null;
  const live = r.preview === false;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setState("sending");
        try {
          await submitMentraForm(r, {
            email: String(f.get("email") ?? ""),
            name: String(f.get("name") ?? ""),
            consent: f.get("consent") === "on",
            honeypot: String(f.get("hp") ?? ""),
          });
          setState("done");
        } catch {
          setState("error"); // the typed values stay in the inputs
        }
      }}
    >
      {content.heading && <h2>{content.heading}</h2>}
      {content.collectName && <label>{content.nameLabel || "Name"} <input name="name" autoComplete="name" /></label>}
      <label>{content.emailLabel || "Email"} <input name="email" type="email" required autoComplete="email" /></label>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <input name="hp" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {content.consentText && <label><input name="consent" type="checkbox" required /> {content.consentText}</label>}
      <button type="submit" disabled={!live || state === "sending"}>{content.buttonText || "Subscribe"}</button>
      {!live && <p>Preview: submitting is off.</p>}
      <p role="status">
        {state === "done" && (content.successMessage || "Thanks for subscribing!")}
        {state === "error" && "That didn't go through. Please try again."}
      </p>
    </form>
  );
};

// <MentraPage page={page} blocks={{ form: SignupForm }} />
```

If your site sends a Content-Security-Policy, the destination host must be
allowed in `form-action` (native form) or `connect-src` (`submitMentraForm`).

A block type's content type, default component and registry entry live in
`src/page/blocks.tsx`; a type whose `resolved` object has fields of its own
(like `form`) also adds them to `PageBlock` in `src/page/types.ts`.

## Supported Nodes

`doc` `paragraph` `heading` `bulletList` `orderedList` `listItem` `blockquote` `codeBlock` `hardBreak` `horizontalRule` `image` `table` `tableRow` `tableHeader` `tableCell` `embed` `callout` `keyTakeaways` `pullQuote`

A `table` puts its leading all-`tableHeader` rows in `<thead>` and the rest in
`<tbody>`, as Mentra's published HTML does.

An `embed` node (`{"type": "embed", "attrs": {"url": "…"}}`) renders a
sandboxed `<iframe>` only for a YouTube, Vimeo, Loom, Spotify or Google Maps
URL. The frame `src` is built from the parsed id by the same allowlist Mentra
enforces, never taken from `url`. Any other https URL renders as a link, and
anything else renders nothing. The frames need the same `frame-src` hosts as
the page `video` and `embed` blocks above.

The article blocks match Mentra's published HTML: a `callout` renders
`<aside data-callout="note|tip|warning|info">` (an unknown variant falls back to
`note`); `keyTakeaways` renders `<section data-key-takeaways>` with an optional
`<h2>` title; `pullQuote` renders a `<figure>` with a `<blockquote>` and an
optional `<figcaption>` attribution, linked to `sourceUrl` only when that URL is
relative or http, https, mailto or tel.

## Supported Marks

`bold` `italic` `underline` `strike` `code` `link`

## TypeScript

```tsx
import type { TipTapNode, TipTapMark, ImageAttrs, NodeRenderer, MarkRenderer, MentraContentProps } from "@mentra-intelligence/react";
```

## License

MIT \u00a9 [Mentra Intelligence](https://mentra.systems)
