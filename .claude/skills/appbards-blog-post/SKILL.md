---
name: appbards-blog-post
description: Publish an approved, already-written blog article on the App Bards website (appbards.com) for any App Bards app — convert the supplied text and real images into the site's blog format, wire up metadata, structured data, sitemap, blog index and the app page's Helpful guides, then validate. Use this whenever the user hands over article text for appbards.com, asks to add, publish, update or integrate a blog post or guide for Pet Health Tracker Reminder, Monthly Bills, Tuning Fork or any other App Bards app, or runs /appbards-blog-post — even if they only paste the article and name the app.
---

# App Bards blog post

Editorial and SEO decisions are made before this skill runs (in ChatGPT). Your job is to
**implement** an approved article faithfully, check it, integrate it with the existing site
and report. You are the implementer and the fact-checker, not the author.

## Inputs

1. **App** — which App Bards app the article is about (name or slug).
2. **Approved article text** — complete, already SEO-optimized. Usually contains the title,
   and often the slug, meta title, meta description, excerpt, category and image placement notes.
3. **Images (optional)** — paths to real photos or genuine app screenshots, with alt text and
   captions if the user supplied them.

Optional overrides: title, slug, metaTitle, description, excerpt, date, category.

Take everything you can from the article itself. Do not ask the user to fill in a form or
repeat metadata that is already in the text. Ask only when something required is truly
missing and cannot be derived sensibly (see defaults below), or when the checks find a problem.

## How the site works (why the workflow looks like this)

The site is a prebuilt Lovable bundle with no React source. Apps are the `AC=[...]` array and
articles the `$posts=[...]` array inside `assets/index-*.js`. `npm run prerender` renders every
route in headless Chrome and writes the static HTML, meta tags, BlogPosting JSON-LD and
`sitemap.xml`. So publishing an article means: add one object to `$posts`, optionally one
guide link to the app, run the prerender. The bundled script does the bundle edits safely —
use it rather than hand-editing the minified file, because it parses the arrays, edits exact
positions, refuses duplicates and verifies the result round-trips.

All commands run from the repo root:

```
node .claude/skills/appbards-blog-post/scripts/blog.mjs <command>
```

| Command | Use |
|---|---|
| `apps [--app <slug>]` | Platforms, store links, existing guides; with `--app`, the app page text you fact-check against |
| `posts` | Existing articles (overlap check) |
| `export <slug>` | An existing post as JSON (to edit or compare) |
| `images <src> <name> [--widths 1200,800]` | Real image → `images/blog/<name>.webp` (+ smaller widths). Never overwrites without `--force` |
| `add <post.json> [--dry-run] [--render] [--replace]` | Check + insert the post and its guide link. Idempotent |
| `validate <slug>` | Check the prerendered output after `npm run prerender` |

Every command exits non-zero when a check fails.

## Workflow

### 1. Inspect
Run `posts` and `apps --app <slug>`. Read `references/post-format.md` for the post fields and
body blocks. Glance at one existing post with `export` if the format is unclear.

### 2. Resolve the app and verify claims
Match the app to a slug from `apps`. Compare every feature, platform, price ("free", "in-app
purchase") and privacy claim in the article with the app page text that `apps --app` prints.
That text is the site's source of truth. Platform availability differs per app (some are
Android-only, one is iOS-only, Kotlin Multiplatform apps may have both), so check the store
links rather than assuming. The `add` command also fails if the article mentions iOS/Android
without a matching store link.

### 3. Check for overlap
Compare the topic with existing posts. `add` warns when titles overlap; you judge whether the
topics substantially duplicate each other. Report overlap to the user rather than proceeding
silently.

### 4. Stop and report problems before publishing
If you find factual errors, unsupported feature claims, medical/financial claims beyond
general guidance, broken links or placeholders, **report them and wait** instead of quietly
rewriting the approved text. The author owns the content; a silent fix hides the problem from
them. Purely mechanical fixes are fine without asking (see step 5).

### 5. Convert the text — preserve it
Turn the article into a post JSON file in the scratchpad (not the repo). Keep wording as
supplied. Allowed changes, and nothing more:
- Structure: headings → `{h2}` / `{h3}`, bullet lists → `{items}`, numbered → `{ol}`, links →
  `[text](url)`, "Label: text" list items → `**Label:** text`.
- Remove image placeholders like `[INSERT …]`, replacing them with image blocks.
- Fix obvious typos and apply house conventions (below). Mention any change in the report.
- Do not insert keywords, add sections, add calls to action or reword for SEO.

### 6. Images
Only real photos and genuine screenshots the user supplied. Never generate, stock-substitute or
mock up UI. If a referenced image file is missing, report which file is needed and continue
without it only if the user agrees.
- Featured photo: `images <src> <topic-name> --widths 1200,800` → use as `hero` and as the
  absolute `image` (share image). Do not crop unless the user asks; the hero keeps its own
  aspect ratio.
- Screenshot: `images <src> <name> --widths 720` → `{img, alt, w, h, caption, maxW: 320}`
  block placed where the text refers to it. Describe only what is actually visible on it.
- Copy alt text and captions from the user when given; otherwise write factual ones.
- Never reuse another app's or article's image.

### 7. Dry run, then apply
1. `add <post.json> --dry-run --render` — all checks plus a headless render of the patched
   site from memory (desktop and mobile, images, aspect ratios, h1, blog index, app page).
   Nothing is written.
2. Fix failures (or report them, per step 4). Warnings need judgement: mention any you leave.
3. `add <post.json>` — writes the bundle. Re-running is a no-op; a changed post with the same
   slug needs `--replace` (use it only when the user asked to update that article).

The post JSON may carry two extra top-level keys the script strips before saving: `"app"` (slug,
adds the Helpful guides link on that app page) and `"guide": {title, description}` (overrides
the guide card text; defaults to the post title and excerpt). Add the guide link whenever the
article is about a specific app.

### 8. Prerender and validate
```
npm run prerender
node .claude/skills/appbards-blog-post/scripts/blog.mjs validate <slug>
```
`validate` checks title, description, canonical, Open Graph/Twitter tags, one h1, no noindex,
article text in the initial HTML, one valid BlogPosting with ISO dates and `inLanguage: en-US`,
sitemap entry, robots.txt, blog index and app page links, internal links, image files, and that
protected files and store URLs match the last commit. Then open the article in the browser
preview (`site` launch config) at desktop and mobile width and test external links in the
browser (some sites return 403 to scripts).

### 9. Report
Use this structure:
1. Files created or modified
2. Article URL
3. Images (paths, dimensions, sizes)
4. Metadata (meta title, description, canonical, share image)
5. JSON-LD summary
6. Sitemap and internal links (including Helpful guides)
7. Text changes made during conversion (mechanical only)
8. Validation results (dry run, validate, browser check)
9. Unresolved problems, warnings and anything needing the author's decision

Do not commit, push or deploy. Offer to commit when the user is happy.

## House conventions

These apply to **new** articles. Do not edit existing articles just to enforce them.
- **US English** (organize, color, traveling) unless the user supplies otherwise.
- **Sentence case** for titles and headings unless the approved text explicitly uses other
  casing — the supplied text wins.
- **Dates:** store ISO `YYYY-MM-DD` (`date`); the site displays `DD.MM.YYYY`. The first `add`
  after this convention was adopted switches the renderer, which changes the *displayed* date
  of every post; say so in the report when it happens. JSON-LD and the sitemap use ISO dates.
- **Brand:** always "App Bards" (with a space), never "AppBards".
- **Author/publisher:** App Bards. No invented credentials, ratings, review counts,
  rankings, search volumes or medical endorsements.

## Defaults when the text does not say

- `slug`: kebab-case from the title, short, without stop words at the ends.
- `metaTitle`: the supplied SEO title; otherwise the title plus ` | App Bards`.
- `description`: the supplied meta description; otherwise ask (do not invent marketing copy).
- `excerpt`: the supplied excerpt; otherwise omit (the index shows the description).
- `date`: today, ISO.
- `category`: supplied value; otherwise the app's topic in two words or fewer (e.g.
  "Pet Care", "Personal Finance"); mention the choice in the report.

## Never touch

`app-ads.txt`, `privacy-policy/`, `assets/analytics.js` (GA4 + consent), `robots.txt`,
`CNAME`, `404.html`, store URLs and their referrer/UTM parameters, other apps' pages,
existing articles' content, and app source code (the apps themselves live elsewhere). Do not
add analytics tags, Tag Manager, a second sitemap, llms.txt or new dependencies.
