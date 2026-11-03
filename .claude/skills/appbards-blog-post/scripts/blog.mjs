#!/usr/bin/env node
// App Bards blog tooling for the appbards-blog-post skill.
//
// The site is a prebuilt Lovable bundle with no React source. Apps live in the
// bundle's `AC=[...]` array and articles in `$posts=[...]`; both are plain
// literals, so this script parses them, edits them at exact text positions and
// leaves the rest of the bundle byte-for-byte untouched.
//
// Run from the repository root:
//   node .claude/skills/appbards-blog-post/scripts/blog.mjs <command> [options]
//
// Commands
//   apps [--app <slug>]          List apps (slug, platforms, store links, guides);
//                                with --app also print the app's page text for fact checks.
//   posts                        List existing articles.
//   export <slug>                Print an existing article as post JSON.
//   images <src> <name> [--widths 1200,800] [--quality 0.82] [--force]
//                                Convert a real photo/screenshot to images/blog/<name>.webp
//                                (+ <name>-<w>.webp for extra widths). Never overwrites
//                                without --force.
//   add <post.json> [--dry-run] [--render] [--replace]
//                                Check a post and insert it into the bundle, plus its
//                                Helpful guides link on the app page. --dry-run writes
//                                nothing; --render also renders the patched site in
//                                headless Chrome from memory. Re-running is a no-op.
//   validate <slug>              Check the prerendered output (run after npm run prerender).
//
// Exit code is 1 when any check fails, so problems cannot be missed.

import { readFile, writeFile, readdir, stat, rm } from "node:fs/promises";
import os from "node:os";
import { existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const ORIGIN = "https://appbards.com";
const IMAGE_DIR = "images/blog";
const PROTECTED = ["app-ads.txt", "privacy-policy", "assets/analytics.js", "robots.txt", "CNAME", "404.html"];
// Display dates as DD.MM.YYYY; posts store ISO dates.
const DATE_FN_OLD = '$date=e=>new Date(e+"T00:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})';
const DATE_FN_NEW = '$date=e=>e.split("-").reverse().join(".")';
const POST_KEYS = ["slug", "title", "metaTitle", "description", "excerpt", "category", "date", "image", "hero", "body"];

let failed = false;
const ok = (msg) => console.log(`  ok    ${msg}`);
const warn = (msg) => console.log(`  WARN  ${msg}`);
const fail = (msg) => {
  failed = true;
  console.log(`  FAIL  ${msg}`);
};

// ---------- bundle parsing ----------

async function bundlePath() {
  const files = (await readdir(path.join(ROOT, "assets"))).filter((f) => /^index-.*\.js$/.test(f));
  if (files.length !== 1) throw new Error(`expected one assets/index-*.js, found ${files.length}. Run from the repo root.`);
  return path.join("assets", files[0]);
}

// Returns the index of the bracket that closes the one at `open`, skipping strings.
function matchBracket(s, open) {
  const pairs = { "[": "]", "{": "}", "(": ")" };
  const stack = [];
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i++; s[i] !== ch; i++) if (s[i] === "\\") i++;
    } else if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === "]" || ch === "}" || ch === ")") {
      if (stack.pop() !== ch) throw new Error(`unbalanced bracket at ${i}`);
      if (stack.length === 0) return i;
    }
  }
  throw new Error("unterminated bracket");
}

// Top-level element spans [start, end) of the array whose "[" is at `open`.
function elementSpans(s, open, close) {
  const spans = [];
  let start = open + 1;
  for (let i = open + 1; i < close; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i++; s[i] !== ch; i++) if (s[i] === "\\") i++;
    } else if (ch === "[" || ch === "{" || ch === "(") i = matchBracket(s, i);
    else if (ch === ",") {
      spans.push([start, i]);
      start = i + 1;
    }
  }
  if (close > start) spans.push([start, close]);
  return spans;
}

function readArray(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0 || src.indexOf(marker, at + 1) >= 0) throw new Error(`expected exactly one "${marker}" in the bundle`);
  const open = at + marker.length - 1;
  const close = matchBracket(src, open);
  // The arrays hold only literals from this repository's own bundle.
  const value = new Function(`return ${src.slice(open, close + 1)}`)();
  return { open, close, value, spans: elementSpans(src, open, close) };
}

const appSlug = (app) => app.name.toLowerCase().split(":")[0].trim().replace(/[^a-z0-9]+/g, "-");

async function loadSite() {
  const file = await bundlePath();
  const src = await readFile(path.join(ROOT, file), "utf8");
  return { file, src, apps: readArray(src, "AC=["), posts: readArray(src, "$posts=[") };
}

const platforms = (app) => [app.hasPlayStore && "Android", app.hasAppStore && "iOS"].filter(Boolean);
const storeUrls = (src) => [...new Set(src.match(/https:\/\/(play\.google\.com|apps\.apple\.com)[^"'`\s)]*/g) ?? [])].sort();

// ---------- image helpers ----------

function imageSize(buf) {
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
    if (chunk === "VP8X") return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  }
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length; ) {
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

async function localImage(url) {
  const rel = url.replace(ORIGIN, "").split("?")[0];
  const file = path.join(ROOT, rel);
  if (!rel.startsWith("/") || !existsSync(file)) return null;
  const buf = await readFile(file);
  return { rel, bytes: buf.length, size: imageSize(buf) };
}

function requirePuppeteer() {
  return createRequire(path.join(ROOT, "package.json"))("puppeteer-core");
}

function launchBrowser() {
  const executablePath = process.env.CHROME_PATH;
  return requirePuppeteer().launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    args: ["--no-sandbox"],
  });
}

// ---------- commands ----------

async function cmdApps(args) {
  const { apps } = await loadSite();
  const only = flag(args, "--app");
  for (const app of apps.value) {
    const slug = appSlug(app);
    if (only && slug !== only) continue;
    console.log(`${slug}\n  name: ${app.name}\n  platforms: ${platforms(app).join(", ") || "none listed"}${app.comingSoon ? " (coming soon)" : ""}`);
    if (app.playStoreLink) console.log(`  play: ${app.playStoreLink}`);
    if (app.appStoreLink) console.log(`  app store: ${app.appStoreLink}`);
    console.log(`  guides: ${(app.guides ?? []).map((g) => g.href).join(", ") || "none"}`);
    if (only) {
      const text = [app.summary, app.long, ...(app.details ?? []).flatMap((d) => (typeof d === "string" ? [d] : Object.values(d).flat()))]
        .filter((t) => typeof t === "string")
        .map((t) => t.replace(/<[^>]+>/g, ""));
      console.log("\n--- app page text (source of truth for feature claims) ---\n" + text.join("\n"));
    }
  }
  if (only && !apps.value.some((a) => appSlug(a) === only)) fail(`no app with slug "${only}"`);
}

async function cmdPosts() {
  const { posts } = await loadSite();
  for (const p of posts.value) console.log(`${p.date}  ${p.slug}  [${p.category ?? "-"}]  ${p.title}`);
}

async function cmdExport([slug]) {
  const { posts } = await loadSite();
  const post = posts.value.find((p) => p.slug === slug);
  if (!post) throw new Error(`no post "${slug}"`);
  console.log(JSON.stringify(post, null, 2));
}

async function cmdImages(args) {
  const [src, name] = positional(args);
  if (!src || !name || !/^[a-z0-9-]+$/.test(name)) throw new Error("usage: images <src> <kebab-name> [--widths 1200,800] [--quality 0.82] [--force]");
  const widths = (flag(args, "--widths") ?? "1200").split(",").map(Number);
  const quality = Number(flag(args, "--quality") ?? 0.82);
  const outs = widths.map((w, i) => ({ w, file: path.join(ROOT, IMAGE_DIR, i ? `${name}-${w}.webp` : `${name}.webp`) }));
  const existing = outs.filter((o) => existsSync(o.file));
  if (existing.length && !args.includes("--force")) {
    console.log("Already exists, not overwritten (pass --force to replace):");
    for (const o of existing) console.log(`  ${path.relative(ROOT, o.file)} ${imageSize(await readFile(o.file)).join("x")}`);
    return;
  }
  const buf = await readFile(src);
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[path.extname(src).toLowerCase()];
  if (!mime) throw new Error("source must be .png, .jpg or .webp");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const results = await page.evaluate(
      async (data, widths, quality) => {
        const img = new Image();
        img.src = data;
        await img.decode();
        return widths.map((w) => {
          // Never upscale; keep the original aspect ratio exactly.
          const width = Math.min(w, img.naturalWidth);
          const height = Math.round((img.naturalHeight * width) / img.naturalWidth);
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          const ctx = c.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
          return { width, height, natural: [img.naturalWidth, img.naturalHeight], b64: c.toDataURL("image/webp", quality).split(",")[1] };
        });
      },
      `data:${mime};base64,${buf.toString("base64")}`,
      widths,
      quality,
    );
    console.log(`source ${src}: ${results[0].natural.join("x")}`);
    for (const [i, r] of results.entries()) {
      const out = Buffer.from(r.b64, "base64");
      await writeFile(outs[i].file, out);
      console.log(`wrote ${path.relative(ROOT, outs[i].file)} ${r.width}x${r.height} ${(out.length / 1024).toFixed(0)} KB`);
    }
    const [main] = results;
    const url = `/${IMAGE_DIR}/${name}.webp`;
    const srcSet = results.length > 1 ? results.map((r, i) => `/${IMAGE_DIR}/${i ? `${name}-${r.width}` : name}.webp ${r.width}w`).reverse().join(", ") : undefined;
    console.log("\nsnippet:", JSON.stringify({ src: url, srcSet, w: main.width, h: main.height }));
  } finally {
    await browser.close();
  }
}

// Checks a post object; returns nothing, records failures and warnings.
async function checkPost(post, { apps, posts, app }) {
  const knownRoutes = new Set(["/", "/apps", "/blog/", "/privacy-policy", "/privacy-policy/", ...apps.value.map((a) => `/apps/${appSlug(a)}`), ...posts.value.map((p) => `/blog/${p.slug}`), `/blog/${post.slug}`]);

  for (const key of ["slug", "title", "metaTitle", "description", "date", "image", "body"]) if (!post[key]) fail(`missing "${key}"`);
  for (const key of Object.keys(post)) if (!POST_KEYS.includes(key)) warn(`unknown post field "${key}" (renderer ignores it)`);
  if (post.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug)) fail(`slug "${post.slug}" is not lowercase kebab-case`);
  if (post.date && (!/^\d{4}-\d{2}-\d{2}$/.test(post.date) || isNaN(Date.parse(post.date)))) fail(`date "${post.date}" is not ISO YYYY-MM-DD`);
  if (post.metaTitle?.length > 60) warn(`metaTitle is ${post.metaTitle.length} chars (search results show about 60)`);
  if (post.description?.length > 160) warn(`description is ${post.description.length} chars (aim for 160 or fewer)`);
  if (/AppBards/.test(JSON.stringify(post))) fail('brand written "AppBards"; use "App Bards"');

  if (post.image) {
    if (!post.image.startsWith(`${ORIGIN}/`)) fail(`image must be an absolute ${ORIGIN}/ URL (it becomes og:image and JSON-LD image)`);
    const img = await localImage(post.image);
    if (!img) fail(`image file not found in the repo: ${post.image}`);
    else ok(`share image ${img.rel} ${img.size?.join("x")} ${(img.bytes / 1024).toFixed(0)} KB`);
    if (img?.bytes > 300 * 1024) warn("share image is over 300 KB");
  }
  const imageBlocks = [...(post.hero ? [{ img: post.hero.src, ...post.hero }] : []), ...(post.body ?? []).filter((b) => b && b.img)];
  if (post.hero?.srcSet) for (const part of post.hero.srcSet.split(",")) imageBlocks.push({ img: part.trim().split(" ")[0], srcSetEntry: part.trim() });
  for (const b of imageBlocks) {
    const img = await localImage(b.img);
    if (!img) {
      fail(`image not found: ${b.img}`);
      continue;
    }
    if (b.srcSetEntry) {
      const declared = Number(b.srcSetEntry.split(" ")[1]?.replace("w", ""));
      if (declared && img.size && declared !== img.size[0]) fail(`srcSet says ${declared}w but ${img.rel} is ${img.size[0]}px wide`);
      else ok(`srcSet ${img.rel} ${declared}w`);
      continue;
    }
    if (!b.alt) fail(`image ${b.img} has no alt text`);
    if (img.size && (b.w !== img.size[0] || b.h !== img.size[1])) fail(`image ${b.img} declares ${b.w}x${b.h} but the file is ${img.size.join("x")} (would distort)`);
    else ok(`image ${img.rel} ${img.size?.join("x")}`);
  }
  if (post.hero && post.image && !post.image.endsWith(post.hero.src)) warn("share image differs from the hero image");

  // Block shapes and links.
  const texts = [];
  let h1s = 0;
  for (const [i, b] of (post.body ?? []).entries()) {
    if (typeof b === "string") texts.push(b);
    else if (b.h2 || b.h3) texts.push(b.h2 ?? b.h3);
    else if (b.items || b.ol) texts.push(...(b.items ?? b.ol));
    else if (b.head && b.rows) texts.push(...b.head, ...b.rows.flat());
    else if (b.h1) h1s++;
    else if (!b.img) fail(`body[${i}] is not a known block: ${JSON.stringify(b).slice(0, 80)}`);
  }
  if (h1s) fail("body contains an h1; the title is the only h1");
  const links = texts.flatMap((t) => [...t.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({ text: m[1], href: m[2] })));
  for (const l of links) {
    if (/^(click here|here|this|link|read more)$/i.test(l.text.trim())) warn(`generic link text "${l.text}"`);
    const internal = l.href.startsWith("/") ? l.href : l.href.startsWith(`${ORIGIN}/`) ? l.href.slice(ORIGIN.length) : null;
    if (internal !== null) {
      if (knownRoutes.has(internal.split("#")[0])) ok(`internal link ${internal}`);
      else fail(`internal link to unknown route ${internal}`);
    } else if (/^https?:\/\//.test(l.href)) warn(`external link (check it in a browser): ${l.href}`);
    else fail(`unsupported link ${l.href}`);
  }
  if (texts.some((t) => /\[[^\]]*\]\s+\(/.test(t))) warn("possible broken markdown link (space between ] and ()");
  if (texts.some((t) => /\[INSERT|TODO|lorem ipsum/i.test(t))) fail("placeholder text left in the body");

  // Platform claims against the app's store links.
  if (app) {
    const all = [post.title, post.description, ...texts].join(" ");
    const has = platforms(app);
    if (/\biOS\b|\biPhone\b|App Store/.test(all) && !has.includes("iOS")) fail(`article mentions iOS but ${app.name} has no App Store link on the site`);
    if (/\bAndroid\b|Google Play/.test(all) && !has.includes("Android")) fail(`article mentions Android but ${app.name} has no Google Play link on the site`);
    if (!links.some((l) => l.href.endsWith(`/apps/${appSlug(app)}`))) warn(`article never links to /apps/${appSlug(app)}`);
  }

  // Overlap with existing articles.
  const words = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3));
  for (const other of posts.value) {
    if (other.slug === post.slug) continue;
    const a = words(post.title ?? ""), b = words(other.title);
    const overlap = [...a].filter((w) => b.has(w)).length / Math.max(1, Math.min(a.size, b.size));
    if (overlap >= 0.5) warn(`title overlaps "${other.title}" (${other.slug}); confirm the topic is distinct`);
  }
}

async function cmdAdd(args) {
  const [file] = positional(args);
  if (!file) throw new Error("usage: add <post.json> [--dry-run] [--render] [--replace]");
  const dryRun = args.includes("--dry-run");
  const input = JSON.parse(await readFile(file, "utf8"));
  const { app: appKey, guide: guideInput, ...post } = input;
  const site = await loadSite();
  let { src } = site;
  console.log(`${dryRun ? "DRY RUN: nothing will be written" : "APPLY"}: ${post.slug} -> ${site.file}`);

  const app = appKey ? site.apps.value.find((a) => appSlug(a) === appKey || a.name === appKey) : undefined;
  if (appKey && !app) fail(`app "${appKey}" not found; run "apps" to list slugs`);
  if (app) ok(`app ${app.name} (${appSlug(app)}): ${platforms(app).join(", ")}`);

  console.log("\nChecks");
  await checkPost(post, { ...site, app });

  // Edits are collected as [start, end, text] and applied from the end backwards.
  const edits = [];
  const changes = [];
  const existingIndex = site.posts.value.findIndex((p) => p.slug === post.slug);
  let refused = false;
  if (existingIndex >= 0) {
    const same = JSON.stringify(site.posts.value[existingIndex]) === JSON.stringify(post);
    if (same) changes.push("post: already published and identical, no change");
    else if (args.includes("--replace")) {
      edits.push([...site.posts.spans[existingIndex], JSON.stringify(post)]);
      changes.push(`post: replace existing "${post.slug}"`);
    } else {
      refused = true;
      fail(`a post with slug "${post.slug}" already exists and differs; pass --replace to update it`);
    }
  } else {
    // Newest first, matching the blog index order.
    const at = site.posts.value.findIndex((p) => p.date <= post.date);
    const pos = at < 0 ? site.posts.close : site.posts.spans[at][0];
    const sep = at < 0 ? (site.posts.value.length ? "," : "") : "";
    edits.push([pos, pos, at < 0 ? sep + JSON.stringify(post) : JSON.stringify(post) + ","]);
    changes.push(`post: insert "${post.slug}" at position ${at < 0 ? site.posts.value.length + 1 : at + 1} of ${site.posts.value.length + 1}`);
  }

  if (app) {
    const href = `/blog/${post.slug}`;
    const guide = { href, title: guideInput?.title ?? post.title, description: guideInput?.description ?? post.excerpt ?? post.description };
    const idx = site.apps.value.indexOf(app);
    const [start, end] = site.apps.spans[idx];
    if ((app.guides ?? []).some((g) => g.href === href)) changes.push(`guides: ${appSlug(app)} already links ${href}, no change`);
    else if (app.guides) {
      const at = src.indexOf("guides:[", start);
      if (at < 0 || at > end) throw new Error("could not locate the guides array");
      const close = matchBracket(src, at + "guides:".length);
      edits.push([close, close, (app.guides.length ? "," : "") + JSON.stringify(guide)]);
      changes.push(`guides: add ${href} to ${appSlug(app)} (now ${app.guides.length + 1})`);
    } else {
      edits.push([end - 1, end - 1, `,guides:[${JSON.stringify(guide)}]`]);
      changes.push(`guides: create Helpful guides on ${appSlug(app)} with ${href}`);
    }
  }

  if (src.includes(DATE_FN_NEW)) changes.push("date display: already DD.MM.YYYY");
  else if (src.includes(DATE_FN_OLD)) {
    const at = src.indexOf(DATE_FN_OLD);
    edits.push([at, at + DATE_FN_OLD.length, DATE_FN_NEW]);
    changes.push("date display: switch the renderer to DD.MM.YYYY (affects every post's displayed date, not its stored date)");
  } else warn("date renderer not recognised; display format unchanged");

  for (const [s, e, text] of edits.sort((a, b) => b[0] - a[0])) src = src.slice(0, s) + text + src.slice(e);

  // The patched bundle must still parse and round-trip.
  const after = { apps: readArray(src, "AC=["), posts: readArray(src, "$posts=[") };
  const saved = after.posts.value.filter((p) => p.slug === post.slug);
  if (saved.length !== 1) fail(`post appears ${saved.length} times after patching`);
  else if (!refused && JSON.stringify(saved[0]) !== JSON.stringify(post)) fail("post did not round-trip through the bundle");
  if (app) {
    const guides = after.apps.value[site.apps.value.indexOf(app)].guides ?? [];
    if (guides.filter((g) => g.href === `/blog/${post.slug}`).length !== 1) fail("guide link is missing or duplicated after patching");
  }
  if (after.posts.value.length !== site.posts.value.length + (existingIndex >= 0 ? 0 : 1)) fail("unexpected number of posts after patching");
  if (JSON.stringify(storeUrls(src)) !== JSON.stringify(storeUrls(site.src))) fail("store URLs changed");
  if (src !== site.src) {
    const tmp = path.join(os.tmpdir(), `appbards-bundle-check-${process.pid}.mjs`);
    await writeFile(tmp, src);
    try {
      execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
      ok("patched bundle passes node --check");
    } catch (e) {
      fail(`patched bundle has a syntax error: ${e.stderr?.toString().split("\n").slice(0, 5).join(" ")}`);
    } finally {
      await rm(tmp, { force: true });
    }
  }

  console.log("\nChanges");
  for (const c of changes) console.log(`  ${c}`);

  if (args.includes("--render")) await renderCheck(site.file, src, post, app);

  if (failed) {
    console.log("\nNot written: fix the failures above first.");
    return;
  }
  if (dryRun) {
    console.log("\nDry run complete. Nothing was written.");
    return;
  }
  if (src === site.src) {
    console.log("\nNothing to write: the bundle already contains this post.");
    return;
  }
  await writeFile(path.join(ROOT, site.file), src);
  console.log(`\nWrote ${site.file}. Next: npm run prerender, then validate ${post.slug}.`);
}

// Renders the patched bundle from memory, serving the repo for everything else.
async function renderCheck(bundleFile, bundleSrc, post, app) {
  console.log("\nRender (headless Chrome, patched bundle served from memory)");
  const template = await readFile(path.join(ROOT, "scripts/index.template.html"), "utf8");
  const types = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const f = path.join(ROOT, p);
    if (p === `/${bundleFile.replace(/\\/g, "/")}`) {
      res.writeHead(200, { "Content-Type": types[".js"] });
      res.end(bundleSrc);
    } else if (f.startsWith(ROOT) && path.extname(f) && statSync(f, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(200, { "Content-Type": types[path.extname(f)] ?? "application/octet-stream" });
      res.end(await readFile(f));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(template);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    for (const width of [1280, 375]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/blog/${post.slug}`, { waitUntil: "networkidle0" });
      await page.waitForSelector("#root main article h1", { timeout: 10000 });
      const r = await page.evaluate(async () => {
        const imgs = [...document.querySelectorAll("article img")];
        for (const img of imgs) {
          img.loading = "eager";
          await img.decode().catch(() => {});
        }
        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]').content,
          h1: [...document.querySelectorAll("h1")].map((h) => h.textContent),
          date: document.querySelector("article time")?.textContent,
          imgs: imgs.map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0, ratio: i.naturalWidth / i.naturalHeight, box: i.getBoundingClientRect().width / i.getBoundingClientRect().height, w: Math.round(i.getBoundingClientRect().width) })),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      const label = width === 1280 ? "desktop" : "mobile";
      if (errors.length) fail(`${label}: page errors: ${errors.join("; ")}`);
      if (r.h1.length !== 1) fail(`${label}: ${r.h1.length} h1 elements`);
      if (width === 1280) {
        r.title === post.metaTitle ? ok(`<title> ${r.title}`) : fail(`<title> is "${r.title}"`);
        r.description === post.description ? ok("meta description set") : fail("meta description not set");
        ok(`date shown as ${r.date}`);
      }
      for (const i of r.imgs) {
        if (!i.ok) fail(`${label}: image did not load ${i.src}`);
        else if (Math.abs(i.ratio - i.box) > 0.02) fail(`${label}: image distorted ${i.src}`);
        else ok(`${label}: ${i.src} loads, ${i.w}px wide, aspect preserved`);
      }
      r.overflow ? fail(`${label}: page scrolls horizontally`) : ok(`${label}: no horizontal overflow`);
      await page.close();
    }
    const index = await browser.newPage();
    await index.goto(`${base}/blog/`, { waitUntil: "networkidle0" });
    (await index.$(`a[href="/blog/${post.slug}"]`)) ? ok("blog index links the article") : fail("blog index does not link the article");
    if (app) {
      await index.goto(`${base}/apps/${appSlug(app)}`, { waitUntil: "networkidle0" });
      (await index.$(`#helpful-guides ~ div a[href="/blog/${post.slug}"]`)) ? ok(`/apps/${appSlug(app)} Helpful guides links the article`) : fail("app page does not link the article");
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function cmdValidate([slug]) {
  if (!slug) throw new Error("usage: validate <slug>");
  const site = await loadSite();
  const post = site.posts.value.find((p) => p.slug === slug);
  if (!post) throw new Error(`no post "${slug}" in the bundle`);
  const route = `/blog/${slug}`;
  const canonical = ORIGIN + route;
  const file = path.join(ROOT, "blog", `${slug}.html`);
  console.log(`Validate ${canonical}`);
  if (!existsSync(file)) {
    fail(`blog/${slug}.html missing; run npm run prerender`);
    return;
  }
  const html = await readFile(file, "utf8");
  if ((await stat(file)).mtimeMs < (await stat(path.join(ROOT, site.file))).mtimeMs) warn("prerendered HTML is older than the bundle; re-run npm run prerender");
  const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const unescape = (s) => s?.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  check(unescape(html.match(/<title>([^<]*)<\/title>/)?.[1]) === post.metaTitle, `title: ${post.metaTitle}`);
  check(html.includes(`<link rel="canonical" href="${canonical}"`), "canonical");
  check(meta("name", "description") === post.description, "meta description");
  check(meta("property", "og:title") === post.metaTitle, "og:title");
  check(meta("property", "og:description") === post.description, "og:description");
  check(meta("property", "og:url") === canonical, "og:url");
  check(meta("property", "og:type") === "article", "og:type article");
  check(meta("property", "og:image") === post.image, `og:image ${post.image}`);
  check(meta("name", "twitter:card") === "summary_large_image", "twitter:card summary_large_image");
  check(meta("name", "twitter:image") === post.image, "twitter:image");
  check(!/noindex/i.test(html), "no noindex");
  check((html.match(/<h1[\s>]/g) ?? []).length === 1, "exactly one h1");
  const firstText = post.body.find((b) => typeof b === "string")?.replace(/\*\*|\[|\]\([^)]*\)/g, "");
  check(firstText && unescape(html).includes(firstText.slice(0, 60)), "article text present in initial HTML");

  const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      fail("JSON-LD does not parse");
      return {};
    }
  });
  const bp = ld.filter((x) => x["@type"] === "BlogPosting");
  check(bp.length === 1, `one BlogPosting (found ${bp.length})`);
  if (bp[0]) {
    const b = bp[0];
    check(b.headline === post.title, "JSON-LD headline");
    check(b.description === post.description, "JSON-LD description");
    check(b.image === post.image, "JSON-LD image");
    check(b.datePublished === post.date, `JSON-LD datePublished ${b.datePublished}`);
    check(/^\d{4}-\d{2}-\d{2}/.test(b.dateModified ?? ""), "JSON-LD dateModified is ISO");
    check(b.mainEntityOfPage === canonical, "JSON-LD mainEntityOfPage");
    check(b.inLanguage === "en-US", "JSON-LD inLanguage en-US");
    check(b.author?.name === "App Bards" && b.publisher?.name === "App Bards", "JSON-LD author and publisher App Bards");
  }

  const img = await localImage(post.image);
  check(img, "share image file exists");
  for (const src of [...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1])) {
    if (src.startsWith("data:") || /^https?:/.test(src)) continue;
    check(existsSync(path.join(ROOT, src.split("?")[0])), `image exists ${src}`);
  }

  const sitemap = await readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  check((sitemap.match(new RegExp(`<loc>${canonical}</loc>`, "g")) ?? []).length === 1, "sitemap lists the URL once");
  const robots = await readFile(path.join(ROOT, "robots.txt"), "utf8");
  check(!/Disallow:\s*\/(blog|$)/m.test(robots), "robots.txt allows /blog/");
  const index = await readFile(path.join(ROOT, "blog/index.html"), "utf8");
  check(index.includes(`href="${route}"`), "blog/index.html links the article");
  for (const app of site.apps.value.filter((a) => (a.guides ?? []).some((g) => g.href === route))) {
    const page = await readFile(path.join(ROOT, "apps", `${appSlug(app)}.html`), "utf8").catch(() => "");
    check(page.includes(`href="${route}"`), `apps/${appSlug(app)}.html links the article`);
  }
  for (const href of new Set([...html.matchAll(/<a [^>]*href="(\/[^"#]*)"/g)].map((m) => m[1]))) {
    const target = href.endsWith("/") ? `${href}index.html` : existsSync(path.join(ROOT, `${href}.html`)) ? `${href}.html` : href;
    check(existsSync(path.join(ROOT, target)) || existsSync(path.join(ROOT, href, "index.html")), `internal link ${href} resolves`);
  }

  // Nothing protected changed against the last commit.
  try {
    const changed = execFileSync("git", ["status", "--porcelain", "--", ...PROTECTED], { cwd: ROOT, encoding: "utf8" }).trim();
    check(!changed, `protected files unchanged (${PROTECTED.join(", ")})`);
    const head = execFileSync("git", ["show", `HEAD:${site.file.replace(/\\/g, "/")}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
    check(JSON.stringify(storeUrls(head)) === JSON.stringify(storeUrls(site.src)), "store URLs identical to HEAD");
  } catch (e) {
    warn(`git comparison skipped: ${e.message.split("\n")[0]}`);
  }
}

const VALUE_FLAGS = ["--app", "--widths", "--quality"];

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const positional = (args) => args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1]));

const [cmd, ...args] = process.argv.slice(2);
const commands = { apps: cmdApps, posts: cmdPosts, export: cmdExport, images: cmdImages, add: cmdAdd, validate: cmdValidate };
if (!commands[cmd]) {
  console.log("commands: apps [--app <slug>] | posts | export <slug> | images <src> <name> [--widths] | add <post.json> [--dry-run] [--render] [--replace] | validate <slug>");
  process.exit(cmd ? 1 : 0);
}
try {
  await commands[cmd](args);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
if (failed) process.exit(1);
