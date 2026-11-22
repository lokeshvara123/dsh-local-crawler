# Local crawler — detail

## What it gives the agent

Four local-first web tools, registered when the plugin activates:

- **local_scrape** — one URL → clean Markdown. Static fetch first; the local Chrome/Edge renders the page automatically when JavaScript is required or the static body yields no content.
- **local_map** — one page's links as a list (same-domain by default).
- **local_crawl** — breadth-first site crawl with page and depth caps, path filters, polite pacing, and Markdown previews per page.
- **local_extract** — structured JSON extraction from a page via an OpenAI-compatible chat API (DeepSeek by default, key from the `DEEPSEEK_API_KEY` DSH credential).

## Why local

- Zero credits, zero rate limits, no scraping SaaS in the middle.
- Page content stays on this machine; only `local_extract` sends page text to the LLM endpoint you configured.
- JS-heavy pages render through the browser you already have installed.

## Essential limitations

- Crawling does not honor `robots.txt` yet and is single-threaded — keep page counts modest on sites you do not own.
- PDFs, binaries and screenshots are not handled yet (planned).
- `local_extract` needs an API key in the configured credential; without one it fails with a clear message.
