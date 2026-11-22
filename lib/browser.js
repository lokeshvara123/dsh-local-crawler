// lib/browser.js — headless Chrome/Edge rendering via puppeteer-core.
// Uses an already installed browser binary; nothing is downloaded.
import fs from "node:fs";
import puppeteer from "puppeteer-core";

/** Candidate browser binaries, checked in order. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : "",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
].filter(Boolean);

/** First browser binary that exists on this machine. */
export function detectChromePath() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // keep looking
    }
  }
  return undefined;
}

/**
 * Render a URL in a real browser and return the final HTML and URL.
 * @param {object} options - { url, chromePath?, userAgent, timeoutMs, waitUntil? }
 */
export async function renderWithBrowser({ url, chromePath, userAgent, timeoutMs = 30000, waitUntil = "networkidle2" }) {
  const executablePath = chromePath || detectChromePath();
  if (!executablePath) {
    throw new Error("local-crawler: no Chrome/Edge binary found on this machine; set the chromePath config or install Chrome");
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--lang=zh-CN,zh"]
  });
  try {
    const page = await browser.newPage();
    if (userAgent) await page.setUserAgent(userAgent);
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    const html = await page.content();
    const finalUrl = page.url();
    return { html, finalUrl };
  } finally {
    await browser.close().catch(() => {});
  }
}
