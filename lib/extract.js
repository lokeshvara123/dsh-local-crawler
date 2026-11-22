// lib/extract.js — LLM-backed structured extraction over DeepSeek's API.
// The API key comes from the caller (resolved via the DSH credentials service
// or the launch environment) and is never stored here.

const DEFAULT_BASE_URL = "https://api.deepseek.com";

/**
 * Extract structured JSON from page text using an OpenAI-compatible
 * chat completions endpoint (DeepSeek by default).
 * @returns {Promise<object>} the parsed JSON object.
 */
export async function extractJson({
  pageText,
  instruction,
  apiKey,
  baseURL = DEFAULT_BASE_URL,
  model = "deepseek-chat",
  timeoutMs = 60000,
  maxSourceChars = 40000,
  signal
}) {
  if (!apiKey) {
    throw new Error("local-crawler: no API key for extraction; configure the DEEPSEEK_API_KEY credential (or set extractCredentialRef in the plugin config)");
  }
  const text = String(pageText || "").slice(0, maxSourceChars);
  if (!text.trim()) throw new Error("local-crawler: the page produced no text to extract from");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const endpoint = String(baseURL).replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You extract structured data from web page text. Return ONLY one valid JSON object matching the user's description, with no markdown fences and no commentary. Use null for missing values."
          },
          {
            role: "user",
            content: `Extract the following information as a JSON object:\n${instruction}\n\nPage text:\n${text}`
          }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`extraction request failed (HTTP ${response.status}): ${detail}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = cleanJsonBlock(content);
    return JSON.parse(cleaned);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

/** Strip markdown fences and anything around the outermost JSON value. */
export function cleanJsonBlock(content) {
  let text = String(content || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  let start = -1;
  if (objectStart === -1) start = arrayStart;
  else if (arrayStart === -1) start = objectStart;
  else start = Math.min(objectStart, arrayStart);
  if (start === -1) throw new Error("extraction returned no JSON value");
  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("extraction returned unbalanced JSON");
}
