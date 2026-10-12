// Build-time prerender for crawlable app and blog pages.
//
// The site is a client-rendered SPA, so a direct request to /apps/<slug> used
// to hit GitHub Pages' 404.html and only got content after JavaScript ran.
// This script loads the /apps index, every app page linked from the home page,
// the blog index and every article it links to in headless Chrome using the real bundle,
// snapshots the rendered markup and writes it to <route>.html (index.html for
// a route ending in "/"), which GitHub
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

const ORIGIN = "https://appbards.com";
const SITE_NAME = "App Bards";

// Pages that are already static files; listed in the sitemap only.
const STATIC_PAGES = ["/", "/privacy-policy/"];
const BLOG_ROUTE = "/blog/";
// The apps index. GitHub Pages serves apps.html at /apps; the same page is also
// written to apps/index.html so /apps/ is a 200 too (canonical stays /apps).
const APPS_ROUTE = "/apps";

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

function buildHtml(template, { title, description, canonical, rootHtml, ogType, image, jsonLd }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${t}</title>\n    <link rel="canonical" href="${canonical}" />`, "<title>");
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}">`, "meta description");
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}">\n  <meta property="og:url" content="${canonical}">`, "og:title");
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}">`, "twitter:title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}">`, "og:description");
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${d}">`, "twitter:description");
  if (ogType) html = replaceOnce(html, /<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${ogType}" />`, "og:type");
  if (image) {
    const i = escapeHtml(image);
    html = replaceOnce(html, /<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${i}">`, "og:image");
    html = replaceOnce(html, /<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${i}">`, "twitter:image");
  }
  for (const item of [jsonLd ?? []].flat()) {
    const json = JSON.stringify(item).replace(/<\//g, "<\\/");
    html = html.replace("</head>", () => `  <script type="application/ld+json">${json}</script>\n</head>`);
  }
  // React mounts with createRoot().render(), which replaces this markup on its
  // first commit, so the prerendered copy never ends up duplicated.
  html = html.replace(EMPTY_ROOT, () => `<div id="root">${rootHtml}</div>`);
  return html;
}

// A route ending in "/" is written as its directory's index.html.
async function writePage(route, html, label) {
  const outFile = path.join(ROOT, route.endsWith("/") ? `${route}index.html` : `${route}.html`);
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
  console.log(`prerendered ${route} -> ${path.relative(ROOT, outFile)} (${html.length} bytes, "${label}")`);
}

// The blog pages set their own <title>, description and preview image.
const readHead = (page) =>
  page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]').content,
    image: document.querySelector('meta[property="og:image"]').content,
  }));

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
    const canonical = ORIGIN + route;

    // Structured data is read from the rendered page: store badges, the icon,
    // optional data-category / data-free on <main> and an optional FAQ block.
    const app = await page.$eval("#root main", (main) => ({
      icon: main.querySelector("img").getAttribute("src"),
      stores: [...main.querySelectorAll('a[href*="play.google.com"], a[href*="apps.apple.com"]')].map((a) => a.href),
      category: main.dataset.category,
      free: "free" in main.dataset,
      faq: [...main.querySelectorAll("[data-faq] h3")].map((h) => ({
        question: h.textContent.trim(),
        answer: h.nextElementSibling.textContent.trim(),
      })),
    }));
    const storeUrl = app.stores[0]?.split("&referrer=")[0];
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: title,
        description,
        url: canonical,
        image: ORIGIN + app.icon,
        operatingSystem: app.stores.map((s) => (s.includes("play.google.com") ? "Android" : "iOS")).join(", ") || undefined,
        applicationCategory: app.category,
        installUrl: storeUrl,
        offers: app.free ? { "@type": "Offer", price: "0", priceCurrency: "USD" } : undefined,
        publisher: { "@type": "Organization", name: SITE_NAME, url: `${ORIGIN}/` },
      },
    ];
    if (app.faq.length > 0) {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: app.faq.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      });
    }

    const html = buildHtml(template, {
      title: `${title} - ${SITE_NAME}`,
      description,
      canonical,
      rootHtml,
      jsonLd,
    });

    await writePage(route, html, title);
    await page.close();
  }

  // The apps index lists every app with a link to its page.
  const apps = await renderRoot(browser, base + APPS_ROUTE, "#root main h1");
  const listed = await apps.$$eval('#root main a[href^="/apps/"]', (links) =>
    links.map((a) => ({
      route: a.getAttribute("href"),
      name: a.closest("[id]").querySelector("h2").textContent.trim(),
    })),
  );
  const missing = routes.filter((route) => !listed.some((app) => app.route === route));
  if (missing.length > 0) throw new Error(`${APPS_ROUTE} does not link to ${missing.join(", ")}`);
  const appsHead = await readHead(apps);
  const appsHtml = buildHtml(template, {
    title: appsHead.title,
    description: appsHead.description,
    canonical: ORIGIN + APPS_ROUTE,
    rootHtml: await apps.$eval("#root", (el) => el.innerHTML),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: appsHead.title,
      description: appsHead.description,
      url: ORIGIN + APPS_ROUTE,
      publisher: { "@type": "Organization", name: SITE_NAME, url: `${ORIGIN}/` },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: listed.map((app, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: app.name,
          url: ORIGIN + app.route,
        })),
      },
    },
  });
  await writePage(APPS_ROUTE, appsHtml, appsHead.title);
  await writePage(`${APPS_ROUTE}/`, appsHtml, appsHead.title);
  await apps.close();

  // The blog index links to every article.
  const blog = await renderRoot(browser, base + BLOG_ROUTE, "#root main h1");
  const posts = await blog.$$eval('#root main a[href^="/blog/"]', (links) => [
    ...new Set(links.map((a) => a.getAttribute("href"))),
  ]);
  if (posts.length === 0) throw new Error("no articles found on the blog index");
  const blogHead = await readHead(blog);
  await writePage(
    BLOG_ROUTE,
    buildHtml(template, {
      title: blogHead.title,
      description: blogHead.description,
      canonical: ORIGIN + BLOG_ROUTE,
      rootHtml: await blog.$eval("#root", (el) => el.innerHTML),
    }),
    blogHead.title,
  );
  await blog.close();

  for (const route of posts) {
    const page = await renderRoot(browser, base + route, "#root main article h1");
    const head = await readHead(page);
    const headline = await page.$eval("#root main h1", (el) => el.textContent.trim());
    const datePublished = await page.$eval("#root main time", (el) => el.dateTime);
    const canonical = ORIGIN + route;
    const organization = { "@type": "Organization", name: SITE_NAME, url: `${ORIGIN}/` };

    const html = buildHtml(template, {
      title: head.title,
      description: head.description,
      canonical,
      rootHtml: await page.$eval("#root", (el) => el.innerHTML),
      ogType: "article",
      image: head.image,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline,
        description: head.description,
        image: head.image,
        datePublished,
        dateModified: datePublished,
        url: canonical,
        mainEntityOfPage: canonical,
        author: organization,
        publisher: organization,
      },
    });

    await writePage(route, html, headline);
    await page.close();
  }

  await writeFile(path.join(ROOT, "sitemap.xml"), buildSitemap([...STATIC_PAGES, APPS_ROUTE, ...routes, BLOG_ROUTE, ...posts]));
  console.log("wrote sitemap.xml");
} finally {
  await browser.close();
  server.close();
}
