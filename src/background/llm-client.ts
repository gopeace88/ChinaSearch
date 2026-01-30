// Build-time injected tokens
declare const __GLM_API_KEY__: string;
declare const __BRAVE_API_KEY__: string;

interface LLMResponse {
  text: string;
  error?: string;
}

function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Fetch timeout after ${timeoutMs}ms`)), timeoutMs);
    fetch(url, opts)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Brave Web Search - same approach as clawdbot.
 */
export async function braveSearch(query: string, count = 5): Promise<SearchResult[]> {
  const apiKey = typeof __BRAVE_API_KEY__ !== "undefined" ? __BRAVE_API_KEY__ : "";
  if (!apiKey) {
    console.warn("[CS-LLM] Brave API key not set, skipping search");
    return [];
  }

  try {
    // Truncate query to avoid 422 errors (max ~400 chars for Brave)
    const truncatedQuery = query.slice(0, 200);
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", truncatedQuery);
    url.searchParams.set("count", String(count));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      console.error("[CS-LLM] Brave search error:", res.status);
      return [];
    }

    const data = await res.json();
    const results = data.web?.results ?? [];
    const mapped = results.map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      description: r.description || "",
    }));
    console.log("[CS-LLM] Brave search OK:", mapped.length, "results");
    return mapped;
  } catch (e) {
    console.error("[CS-LLM] Brave search exception:", e);
    return [];
  }
}

/**
 * Call GLM (zhipuai) via z.ai API.
 */
export async function callGLM(
  prompt: string,
  apiKey: string,
): Promise<LLMResponse> {
  const builtinKey = typeof __GLM_API_KEY__ !== "undefined" ? __GLM_API_KEY__ : "";
  apiKey = apiKey || builtinKey;
  if (!apiKey) {
    return { text: "", error: "GLM API key not configured" };
  }
  console.log("[CS-LLM] Calling GLM (z.ai)...");

  try {
    console.log("[CS-LLM] GLM fetch starting...");
    const res = await fetchWithTimeout("https://api.z.ai/api/coding/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4.7",
        messages: [{ role: "user", content: prompt }],
      }),
    }, 120000);
    console.log("[CS-LLM] GLM fetch responded:", res.status);

    if (!res.ok) {
      const err = await res.text();
      console.error("[CS-LLM] GLM error:", res.status, err);
      return { text: "", error: `GLM ${res.status}: ${err}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log("[CS-LLM] GLM OK, length:", text.length);
    return { text };
  } catch (e) {
    console.error("[CS-LLM] GLM exception:", e);
    return { text: "", error: String(e) };
  }
}

/**
 * Call Claude via local claude-max-api-proxy (OpenAI-compatible).
 * Proxy runs at localhost:3456, shells out to `claude` CLI which handles OAuth.
 */
export async function callClaude(
  prompt: string,
  _apiKey: string,
  systemPrompt?: string,
  sessionId?: string
): Promise<LLMResponse> {
  console.log("[CS-LLM] Calling Claude via local proxy...", sessionId ? `session: ${sessionId}` : "no session");

  try {
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const body: Record<string, unknown> = {
      model: "claude-sonnet-4",
      messages,
      max_tokens: 4096,
    };
    if (sessionId) {
      body.user = sessionId; // maps to --session-id in proxy
    }

    console.log("[CS-LLM] Claude fetch starting...");
    const res = await fetchWithTimeout("http://127.0.0.1:3456/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 120000);
    console.log("[CS-LLM] Claude fetch responded:", res.status);

    if (!res.ok) {
      const err = await res.text();
      console.error("[CS-LLM] Claude proxy error:", res.status, err);
      return { text: "", error: `Claude ${res.status}: ${err}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log("[CS-LLM] Claude OK, length:", text.length);
    return { text };
  } catch (e) {
    console.error("[CS-LLM] Claude exception:", e);
    return { text: "", error: String(e) };
  }
}
