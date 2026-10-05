// Build-time prerender for crawlable app pages.
//
// The site is a client-rendered SPA, so a direct request to /apps/<slug> used
// to hit GitHub Pages' 404.html and only got content after JavaScript ran.
// This script loads every app page linked from the home page in headless
// Chrome using the real bundle, snapshots the rendered markup and writes it to
// <route>.html, which GitHub
// Pages serves with HTTP 200 at the extensionless URL. It also writes
// sitemap.xml. The bundle stays the single source of truth for the content.
//
// Usage: npm run prerender   (re-run after every change to the bundle or index.html)

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ORIGIN = "https://appbards.github.io";
const SITE_NAME = "App Bards";

// Pages that are already static files; listed in the sitemap only.
const STATIC_PAGES = ["/", "/privacy-policy/"];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EMPTY_ROOT = '<div id="root"></div>';

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Serves the repo, falling back to the pristine SPA shell for unknown paths so
// a route always renders from the bundle, never from an earlier prerender.
function startServer(template) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.join(ROOT, pathname);
    if (file.startsWith(ROOT) && path.extname(file) && statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    } else {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(template);
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function launchBrowser() {
  const executablePath = process.env.CHROME_PATH;
  return puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    args: ["--no-sandbox"],
  });
}

async function renderRoot(browser, url, readySelector) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForSelector(readySelector);
  return page;
}

function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`index.html: could not find ${label}`);
  return html.replace(pattern, replacement);
}

function buildHtml(template, { title, description, canonical, rootHtml }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${t}</title>\n    <link rel="canonical" href="${canonical}" />`, "<title>");
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}">`, "meta description");
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}">\n  <meta property="og:url" content="${canonical}">`, "og:title");
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}">`, "twitter:title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}">`, "og:description");
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${d}">`, "twitter:description");
  // React mounts with createRoot().render(), which replaces this markup on its
  // first commit, so the prerendered copy never ends up duplicated.
  html = html.replace(EMPTY_ROOT, () => `<div id="root">${rootHtml}</div>`);
  return html;
}

function buildSitemap(paths) {
  const urls = paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const template = (await readFile(path.join(ROOT, "index.html"), "utf8")).replace(/\r+\n/g, "\n");
if (!template.includes(EMPTY_ROOT)) throw new Error(`index.html: could not find ${EMPTY_ROOT}`);

const server = await startServer(template);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();

try {
  // The short description of each app is only rendered on its home page card.
  const home = await renderRoot(browser, `${base}/`, "#apps");

  // Every app card on the home page links to its /apps/<slug> page.
  const routes = await home.$$eval('#apps a[href^="/apps/"]', (links) => [
    ...new Set(links.map((a) => a.getAttribute("href"))),
  ]);
  if (routes.length === 0) throw new Error("no app pages found on the home page");

  for (const route of routes) {
    const slug = route.split("/").pop();
    const page = await renderRoot(browser, base + route, "#root main h1");

    const title = await page.$eval("#root main h1", (el) => el.textContent.trim());
    const firstParagraph = await page.$eval("#root main p", (el) => el.textContent.trim());
    const description = await home
      .$eval(`[id="${slug}"] h3 + p`, (el) => el.textContent.trim())
      .catch(() => firstParagraph);
    const rootHtml = await page.$eval("#root", (el) => el.innerHTML);

    const html = buildHtml(template, {
      title: `${title} - ${SITE_NAME}`,
      description,
      canonical: ORIGIN + route,
      rootHtml,
    });

    const outFile = path.join(ROOT, `${route}.html`);
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, html);
    console.log(`prerendered ${route} -> ${path.relative(ROOT, outFile)} (${html.length} bytes, "${title}")`);
    await page.close();
  }

  await writeFile(path.join(ROOT, "sitemap.xml"), buildSitemap([...STATIC_PAGES, ...routes]));
  console.log("wrote sitemap.xml");
} finally {
  await browser.close();
  server.close();
}
