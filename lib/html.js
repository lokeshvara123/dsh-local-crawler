// lib/html.js — static fetch, charset decoding, main-content extraction and
// link collection for dsh-local-crawler. Pure functions, no DSH imports.
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

/** Default browser user agent for polite, identifiable requests. */
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 dsh-local-crawler/0.1";

/** Fetch a URL as bytes. Follows redirects; no renderer involved. */
export async function staticFetch(url, { timeoutMs = 20000, userAgent = DEFAULT_USER_AGENT, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal !== undefined && signal !== null) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      ok: response.ok,
      statusCode: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get("content-type") || "",
      body: buffer
    };
  } finally {
    clearTimeout(timer);
    if (signal !== undefined && signal !== null) signal.removeEventListener("abort", onAbort);
  }
}

/** Decode a byte buffer to text, honoring BOM, HTTP charset and meta charset. */
export function decodeBody(buffer, contentType = "") {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3));
  }
  let charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (!charset) {
    const head = buffer.subarray(0, 8192).toString("latin1");
    charset = /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head)?.[1];
  }
  charset = (charset || "utf-8").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

/** Shared Turndown instance with a conservative, LLM-friendly setup. */
function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined"
  });
  td.remove(["script", "style", "noscript", "iframe", "svg", "form", "button"]);
  td.addRule("keep-links-and-images", {
    filter: (node) => node.nodeName === "A" || node.nodeName === "IMG",
    replacement: (content, node) => {
      if (node.nodeName === "IMG") {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        return src && !src.startsWith("data:") ? `![${alt}](${src})` : alt ? `(${alt})` : "";
      }
      const href = node.getAttribute("href") || "";
      const text = content.trim();
      if (!href || href.startsWith("javascript:")) return text;
      return text ? `[${text}](${href})` : `<${href}>`;
    }
  });
  return td;
}

let turndownInstance;

/**
 * Extract the main content of an HTML document as Markdown.
 * Readability isolates the article; the whole body is the fallback so that
 * pages without a readable article (docs, listings) still convert.
 */
export function htmlToMarkdown(html, url) {
  let title = "";
  let contentHtml = "";
  try {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    title = article?.title || dom.window.document.title || "";
    contentHtml = article?.content || "";
    if (!contentHtml || contentHtml.trim().length === 0) {
      contentHtml = dom.window.document.body?.innerHTML || "";
    }
  } catch {
    contentHtml = html;
  }
  turndownInstance = turndownInstance || createTurndown();
  let markdown = "";
  try {
    markdown = turndownInstance.turndown(contentHtml).trim();
  } catch {
    markdown = "";
  }
  return { title: String(title || "").trim(), markdown };
}

/**
 * Collect absolute links from an HTML document.
 * @returns {Array<{url: string, text: string}>} deduplicated, in document order.
 */
export function collectLinks(html, baseUrl, { sameDomain = true, maxLinks = 500 } = {}) {
  const seen = new Set();
  const links = [];
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return links;
  }
  let doc;
  try {
    doc = new JSDOM(html, { url: baseUrl }).window.document;
  } catch {
    return links;
  }
  for (const anchor of doc.querySelectorAll("a[href]")) {
    if (links.length >= maxLinks) break;
    let href = anchor.getAttribute("href") || "";
    href = href.split("#")[0].trim();
    if (!href) continue;
    let absolute;
    try {
      absolute = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;
    if (sameDomain && absolute.hostname !== base.hostname) continue;
    const key = absolute.href;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: key, text: (anchor.textContent || "").trim().slice(0, 120) });
  }
  return links;
}

/** Whether some text looks too empty to be useful page content. */
export function looksEmpty(text, threshold = 200) {
  return (text || "").replace(/\s+/g, "").length < threshold;
}
