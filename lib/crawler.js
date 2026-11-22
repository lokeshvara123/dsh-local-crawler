// lib/crawler.js — polite breadth-first site crawling.
import { staticFetch, decodeBody, htmlToMarkdown, collectLinks } from "./html.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Crawl a site breadth-first from a start URL.
 * One page is fetched at a time with a small delay between requests.
 * @returns {{pages: Array<{url,title,statusCode,markdown}>, errors: Array<{url,error}>}}
 */
export async function crawlSite({
  startUrl,
  maxPages = 25,
  maxDepth = 3,
  sameDomain = true,
  pathPrefix = "",
  userAgent,
  timeoutMs = 20000,
  delayMs = 250,
  signal
}) {
  let base;
  try {
    base = new URL(startUrl);
  } catch {
    throw new Error(`local-crawler: invalid start URL: ${startUrl}`);
  }
  const prefix = (pathPrefix || "").trim();
  const visited = new Set();
  const pages = [];
  const errors = [];
  const queue = [{ url: base.href, depth: 0 }];
  visited.add(base.href);

  while (queue.length > 0 && pages.length < maxPages) {
    if (signal?.aborted) break;
    const item = queue.shift();
    let result;
    try {
      const fetched = await staticFetch(item.url, { timeoutMs, userAgent, signal });
      if (!fetched.ok) {
        errors.push({ url: item.url, error: `HTTP ${fetched.statusCode}` });
        continue;
      }
      const html = decodeBody(fetched.body, fetched.contentType);
      const { title, markdown } = htmlToMarkdown(html, fetched.finalUrl);
      pages.push({ url: fetched.finalUrl, title, statusCode: fetched.statusCode, markdown });
      if (item.depth < maxDepth && pages.length < maxPages) {
        const links = collectLinks(html, fetched.finalUrl, { sameDomain, maxLinks: 200 });
        for (const link of links) {
          if (visited.has(link.url)) continue;
          if (prefix && !new URL(link.url).pathname.startsWith(prefix)) continue;
          if (visited.size + queue.length >= maxPages + 50) break;
          visited.add(link.url);
          queue.push({ url: link.url, depth: item.depth + 1 });
        }
      }
    } catch (error) {
      errors.push({ url: item.url, error: String(error?.message || error).slice(0, 200) });
    }
    if (queue.length > 0) await sleep(delayMs);
  }
  return { pages, errors };
}
