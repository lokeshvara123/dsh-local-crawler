# dsh-local-crawler

Local-first web scraping for the DeepSeek Harness agent — your own "Firecrawl at home".

- **No cloud scraping service, no credits.** Pages are fetched from this machine.
- **Real browser rendering.** Pages that need JavaScript are rendered with the local Chrome/Edge via `puppeteer-core` (nothing is downloaded; an installed browser is reused).
- **Data stays local.** Page content never passes through a third party (only `local_extract` sends page text to the LLM API you configured).
- **Agent-native.** Four model-facing tools: `local_scrape`, `local_map`, `local_crawl`, `local_extract`.

## Tools

| Tool | What it does |
|---|---|
| `local_scrape` | Fetch one URL and return its main content as clean Markdown (Readability denoising). Auto-falls back to browser rendering when the page is JS-rendered or static fetch yields nothing. |
| `local_map` | List the links of a page (same-domain by default) — a one-page site map. |
| `local_crawl` | Breadth-first crawl of a site with page/depth caps, path filters and polite pacing. Returns an index with short Markdown previews. |
| `local_extract` | Extract structured JSON from a page with an LLM. Uses the DeepSeek API and the `DEEPSEEK_API_KEY` DSH credential by default; base URL, model and credential ref are configurable. |

## Install

Desktop client: **Settings → Plugins → install** `dsh-local-crawler` (or install the local directory). Web profile:

```sh
dsh plugin --profile web add dsh-local-crawler
```

Restart DSH (fully quit the desktop client, tray included) and the four `local_*` tools become available to the agent.

## Config

Edit the plugin row's `config` in the profile patch. Defaults:

| Key | Default | Meaning |
|---|---|---|
| `scrapeTimeoutMs` | 30000 | Per-page fetch/render timeout (ms). |
| `scrapeMaxChars` | 40000 | Cap on returned Markdown characters for `local_scrape`. |
| `crawlMaxPages` / `crawlDefaultPages` | 50 / 25 | Crawl page caps. |
| `crawlMaxDepth` / `crawlDefaultDepth` | 4 / 3 | Crawl depth caps. |
| `crawlPreviewChars` | 1200 | Markdown preview length per crawled page. |
| `crawlResultChars` | 30000 | Total cap on the crawl index output. |
| `mapMaxLinks` | 300 | Hard cap on listed links. |
| `extractModel` | `deepseek-chat` | Chat model for `local_extract`. |
| `extractBaseURL` | `https://api.deepseek.com` | OpenAI-compatible endpoint. |
| `extractCredentialRef` | `DEEPSEEK_API_KEY` | DSH credential ref holding the API key. |
| `extractTimeoutMs` / `extractMaxChars` | 60000 / 40000 | Extraction budget. |
| `chromePath` | *(auto-detect)* | Browser binary override. |
| `userAgent` | Chrome UA + `dsh-local-crawler/0.1` | Request user agent. |
| `requestDelayMs` | 250 | Delay between crawl requests (be polite). |

## Limits

- `local_crawl` fetches one page at a time and does not respect `robots.txt` yet — keep `max_pages` modest for sites you do not own.
- `local_scrape` converts HTML to Markdown; PDF and binary documents are not parsed (yet).
- Screenshots and change monitoring are planned for v2.

## License

MIT
