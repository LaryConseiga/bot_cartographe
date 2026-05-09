import type { NextRequest } from "next/server";
import { forwardRequestToLlm, LLM_UPSTREAM } from "@/lib/llmUpstreamProxy";

/**
 * Fallback / routes LLM additionnelles. Les chemins fixes `/api/llm/chat` et `/api/llm/summarize`
 * sont gérés par leurs propres `route.ts` (prioritaires).
 *
 * `[[...path]]` : `/api/llm` → sanity JSON ; autres segments → proxy Flask.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_PREFIX = "/api/llm";

/** Next peut passer `path` en string ou string[] selon la version ; en secours on parse l’URL. */
function segments(request: NextRequest, ctxPath: string[] | string | undefined): string[] {
  if (Array.isArray(ctxPath) && ctxPath.length) return ctxPath;
  if (typeof ctxPath === "string" && ctxPath.length) return [ctxPath];

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith(API_PREFIX)) {
    const rest = pathname.slice(API_PREFIX.length).replace(/^\/+/, "");
    if (rest) return rest.split("/").filter(Boolean);
  }
  return [];
}

async function proxy(request: NextRequest, pathSegments: string[]) {
  return forwardRequestToLlm(pathSegments, request);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  const path = segments(request, (await ctx.params).path);
  if (!path.length) {
    return new Response(JSON.stringify({ error: "Utilise /api/llm/chat ou /api/llm/summarize" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  return proxy(request, path);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  const path = segments(request, (await ctx.params).path);
  if (!path.length) {
    return new Response(JSON.stringify({ ok: true, proxy: true, upstream: LLM_UPSTREAM }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  return proxy(request, path);
}
