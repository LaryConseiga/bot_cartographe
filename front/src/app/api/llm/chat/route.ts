import type { NextRequest } from "next/server";
import { forwardRequestToLlm } from "@/lib/llmUpstreamProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return forwardRequestToLlm(["chat"], request);
}
