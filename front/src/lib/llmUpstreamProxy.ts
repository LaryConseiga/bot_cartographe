import type { NextRequest } from "next/server";

export const LLM_UPSTREAM =
  process.env.LLM_SERVICE_URL || process.env.LLM_INTERNAL_URL || "http://127.0.0.1:8007";

/** Relaie la requête vers Flask : ex. segments `["chat"]` → POST http://…/chat */
export async function forwardRequestToLlm(pathSegments: string[], request: NextRequest): Promise<Response> {
  const path = pathSegments.join("/");
  const target = `${LLM_UPSTREAM.replace(/\/$/, "")}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  const accept = request.headers.get("accept");
  if (accept) headers.set("Accept", accept);

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[llm proxy] impossible de joindre Flask:", LLM_UPSTREAM, e);
    return new Response(
      JSON.stringify({
        error: `Service LLM indisponible (${LLM_UPSTREAM}). Lance llm/main.py et vérifie LLM_SERVICE_URL.`
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const outHeaders = new Headers();
  const uct = upstream.headers.get("content-type");
  if (uct) outHeaders.set("Content-Type", uct);
  const cache = upstream.headers.get("cache-control");
  if (cache) outHeaders.set("Cache-Control", cache);
  outHeaders.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders
  });
}
