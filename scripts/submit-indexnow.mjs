#!/usr/bin/env node
// Submits every URL in the just-built sitemap to IndexNow (Bing, Yandex,
// Seznam, and other participating engines via the shared api.indexnow.org
// endpoint) — run as a postbuild hook so Cloudflare Pages' own `npm run
// build` triggers it automatically after every deploy, no dashboard
// build-command change needed. Submits the full URL list each time
// rather than diffing against the last build — simpler and still
// correct (IndexNow doesn't penalize re-submitting unchanged URLs), and
// this site has too few pages for that to matter.
import { readFileSync, existsSync } from "node:fs";

const HOST = "purplepeaksapps.com";
const KEY = "9848f0a7d7faa14583fed70e6e6edd31";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_INDEX = new URL("../dist/sitemap-index.xml", import.meta.url);

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
}

async function main() {
  if (!existsSync(SITEMAP_INDEX)) {
    console.log("submit-indexnow: no dist/sitemap-index.xml found, skipping");
    return;
  }
  const indexXml = readFileSync(SITEMAP_INDEX, "utf8");
  const subSitemaps = extractLocs(indexXml);

  let urls = [];
  for (const sitemapUrl of subSitemaps) {
    const fileName = sitemapUrl.split("/").pop();
    const localPath = new URL(`../dist/${fileName}`, import.meta.url);
    if (!existsSync(localPath)) continue;
    urls.push(...extractLocs(readFileSync(localPath, "utf8")));
  }
  urls = [...new Set(urls)];

  if (urls.length === 0) {
    console.log("submit-indexnow: no URLs found in sitemap, skipping");
    return;
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  });
  const body = await res.text();
  console.log(`submit-indexnow: submitted ${urls.length} URLs — HTTP ${res.status} ${body}`);
}

main().catch((err) => {
  console.error("submit-indexnow: failed:", err);
  // Never fail the build over an IndexNow submission error.
});
