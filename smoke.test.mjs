import { staticFetch, decodeBody, htmlToMarkdown, collectLinks } from "./lib/html.js";
import { renderWithBrowser, detectChromePath } from "./lib/browser.js";
import { cleanJsonBlock } from "./lib/extract.js";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

// 1. static fetch + markdown
const fetched = await staticFetch("https://example.com", { timeoutMs: 20000 });
check("static fetch", fetched.ok && fetched.body.length > 100, `HTTP ${fetched.statusCode}, ${fetched.body.length} bytes`);
const html = decodeBody(fetched.body, fetched.contentType);
const { title, markdown } = htmlToMarkdown(html, fetched.finalUrl);
check("readability + turndown", markdown.length > 100, `title="${title}" markdown=${markdown.length} chars`);
console.log("--- markdown head ---");
console.log(markdown.slice(0, 300));

// 2. link collection
const links = collectLinks(html, fetched.finalUrl, { sameDomain: true, maxLinks: 20 });
check("collect links", links.length > 0, `${links.length} links: ${links[0]?.url}`);

// 3. browser render
const exe = detectChromePath();
check("chrome detected", Boolean(exe), String(exe));
try {
  const rendered = await renderWithBrowser({ url: "https://example.com", timeoutMs: 30000 });
  check("browser render", rendered.html.length > 100, `finalUrl=${rendered.finalUrl}, html=${rendered.html.length} chars`);
} catch (error) {
  check("browser render", false, String(error?.message || error).slice(0, 200));
}

// 4. JSON block cleaning
const cleaned = cleanJsonBlock('```json\n{"name":"x","price":3.5}\n```');
check("clean json block", cleaned === '{"name":"x","price":3.5}', cleaned);
const nested = cleanJsonBlock('Here you go: {"a":{"b":[1,2]},"c":"}"}');
check("nested json parse", JSON.parse(nested).a.b[1] === 2, nested);

// 5. extract error path with a bogus key (no real spend)
try {
  const { extractJson } = await import("./lib/extract.js");
  await extractJson({ pageText: "hi", instruction: "x", apiKey: "bogus", timeoutMs: 8000 });
  check("extract bogus key rejected", false, "unexpectedly succeeded");
} catch (error) {
  check("extract bogus key rejected", String(error?.message).includes("failed"), String(error?.message).slice(0, 120));
}

console.log("\n==== summary ====");
for (const line of results) console.log(line);
