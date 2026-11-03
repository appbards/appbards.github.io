# Post format

A post is one object in the bundle's `$posts` array. Write it as a JSON file and pass it to
`blog.mjs add`. Run `blog.mjs export how-to-organize-dog-vaccination-records` for a complete
real example.

## Fields

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | kebab-case; URL is `https://appbards.com/blog/<slug>` |
| `title` | yes | The single H1 and the JSON-LD headline |
| `metaTitle` | yes | `<title>`, og:title, twitter:title; about 60 chars or fewer |
| `description` | yes | Meta/OG/Twitter description and JSON-LD description; 160 chars or fewer |
| `excerpt` | no | Blog index card text (falls back to `description`) |
| `category` | no | Shown after the date on the index and in the byline |
| `date` | yes | ISO `YYYY-MM-DD`; also datePublished/dateModified |
| `image` | yes | Absolute `https://appbards.com/...` URL; og:image, twitter:image, JSON-LD image |
| `hero` | no | `{src, srcSet?, alt, w, h, caption?}` featured figure under the byline and the index thumbnail |
| `body` | yes | Array of blocks (below) |

Extra keys only for `add` (stripped before saving): `app` (app slug → Helpful guides link)
and `guide` (`{title, description}` for that card).

## Body blocks

| Block | Renders |
|---|---|
| `"text"` | Paragraph. Supports `**bold**` and `[text](url)`. `https://appbards.com/...` links become root-relative with client-side navigation |
| `{"h2": "…"}` | Section heading |
| `{"h3": "…"}` | Sub-heading (steps, FAQ questions) |
| `{"items": ["…"]}` | Bulleted list (items support bold/links) |
| `{"ol": ["…"]}` | Numbered list |
| `{"img", "alt", "w", "h"}` | Centered image, max 420 px, lazy |
| `{"img", "alt", "w", "h", "caption", "maxW"?}` | Captioned figure with rounded border; `maxW` sets display width (320 for phone screenshots) |
| `{"head": [...], "rows": [[...]], "caption"?}` | Table; first cell of each row is a row header |

`w`/`h` must equal the file's real pixel size (the script checks), so the browser reserves the
right space and nothing is distorted. There is no h1 block: the title is the only h1.

## Converting article text

| In the approved text | Becomes |
|---|---|
| First line / "Title:" | `title` (not repeated in `body`) |
| `## Heading` or a standalone heading line | `{"h2"}`; a step or question under a section → `{"h3"}` |
| `- item` / `* item` | `{"items"}` |
| `1. item` | `{"ol"}` |
| `Label: explanation` inside a list | `**Label:** explanation` |
| `[INSERT IMAGE …]` | The matching image block, or the `hero` if it is the featured image |
| A caption line directly after an image placeholder | That image's `caption` (not a paragraph) |
| Disclaimers | Plain final paragraph, unchanged |

## Image files

`images/blog/<descriptive-name>.webp` (+ `-800.webp` for the hero srcSet), produced by
`blog.mjs images`. Featured photos: widths `1200,800`, quality 0.82. Phone screenshots:
width `720`, quality 0.85 keeps small UI text legible.
