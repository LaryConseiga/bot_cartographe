"use client";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8092";

/**
 * URL publique directe vers Flask (optionnel). Si vide, le front utilise le proxy same-origin
 * `/api/llm/*` (recommandé en dev : évite CORS et mélange localhost / 127.0.0.1).
 */
const NEXT_PUBLIC_LLM_DIRECT = (process.env.NEXT_PUBLIC_LLM_SERVICE_URL || "").replace(/\/$/, "");

/** Skill par défaut côté Flask — aligné sur `index.html` (pas de champ `skill` dans le JSON). */
export const DEFAULT_LLM_SKILL = "apex_conversationalist";

/** Ex. `chat`, `summarize` — même contrat que `llm/index.html`. */
function llmEndpoint(path: string): string {
  const p = path.replace(/^\//, "");
  if (NEXT_PUBLIC_LLM_DIRECT) return `${NEXT_PUBLIC_LLM_DIRECT}/${p}`;
  return `/api/llm/${p}`;
}

export type LlmChatMessage = { role: "user" | "assistant"; content: string };

/** Événement SSE émis par Flask (`type: status`, recherche Tavily, etc.) — comme dans `index.html`. */
export type ChatStatusEvent = {
  type?: string;
  phase?: string;
  message?: string;
  icon?: string;
  source?: string;
  slug?: string;
};

/**
 * Corps de requête comme dans `llm/index.html` : `{ messages, stream: true }`,
 * avec `skill` / `cvText` seulement si nécessaire (extensions Apex).
 */
export function buildLlmChatBody(
  messages: LlmChatMessage[],
  options: { skill?: string; cvText?: string } = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = { messages, stream: true };
  const sk = options.skill ?? DEFAULT_LLM_SKILL;
  if (sk !== DEFAULT_LLM_SKILL) body.skill = sk;
  if (options.cvText?.trim()) body.cvText = options.cvText.trim();
  return body;
}

/**
 * Consomme le flux SSE du Flask (même logique que la boucle dans `index.html`).
 */
export async function consumeLlmChatSse(
  res: Response,
  handlers: {
    onToken?: (token: string) => void;
    onStatus?: (evt: ChatStatusEvent) => void;
    onDone?: () => void;
  }
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Réponse vide");

  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  let finished = false;

  const handleParsed = (data: unknown): boolean => {
    if (data === "[DONE]") {
      finished = true;
      handlers.onDone?.();
      return true;
    }
    if (!data || typeof data !== "object") return false;
    const rec = data as Record<string, unknown>;
    if (typeof rec.error === "string") {
      throw new Error(rec.error);
    }
    if (rec.type === "status") {
      handlers.onStatus?.(rec as ChatStatusEvent);
      return false;
    }
    if (typeof rec.token === "string") {
      assistantText += rec.token;
      handlers.onToken?.(rec.token);
      return false;
    }
    if (rec.done === true) {
      finished = true;
      handlers.onDone?.();
      return true;
    }
    return false;
  };

  readLoop: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const raw = line.slice(6).trim();
          const data = JSON.parse(raw) as unknown;
          if (handleParsed(data)) {
            await reader.cancel().catch(() => {});
            break readLoop;
          }
        } catch (e) {
          if (e instanceof SyntaxError || (e instanceof Error && e.name === "SyntaxError")) continue;
          throw e;
        }
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6).trim()) as unknown;
        if (handleParsed(data)) break;
      } catch (e) {
        if (e instanceof SyntaxError || (e instanceof Error && e.name === "SyntaxError")) continue;
        throw e;
      }
    }
  }

  if (!finished) handlers.onDone?.();
  return assistantText;
}

/** Résumé de conversation — équivalent au bouton « Résumer » de `index.html`. */
export async function summarizeThread(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(llmEndpoint("summarize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; summary?: string };
  if (!res.ok) {
    throw new Error(String(data.error || `HTTP ${res.status}`));
  }
  return String(data.summary ?? "");
}

/** Même clé côté client : le back accepte cookie HttpOnly OU Bearer (voir requireUser). */
export const ACCESS_TOKEN_STORAGE_KEY = "apexai_access_token";

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function applyAuthHeaders(headers: Headers) {
  const t = getStoredAccessToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
}

function persistSessionToken(session: { access_token?: string } | null | undefined) {
  if (typeof window === "undefined") return;
  const t = session?.access_token;
  if (t) sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, t);
  else sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

/** Utilisé par AppShell : ne rediriger vers /connexion que sur 401 réel, pas sur erreur réseau / 502. */
export function isUnauthorizedError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return m.includes("Session expirée") || m.includes("non connecté") || m.includes("Reconnectez-vous");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  applyAuthHeaders(headers);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      throw new Error("Session expirée ou non connecté(e). Reconnectez-vous.");
    }
    const baseMsg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
    const details = json?.details ? ` — ${JSON.stringify(json.details)}` : "";
    throw new Error(String(baseMsg) + details);
  }
  return json as T;
}

export type AuthResponse = {
  user: { id: string; email?: string } | null;
  session: { access_token: string } | null;
};

export async function signup(payload: {
  email: string;
  password: string;
  full_name?: string;
  country?: string;
  city?: string;
  preferred_lang?: string;
}) {
  const out = await request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  persistSessionToken(out.session);
  return out;
}

export async function login(payload: { email: string; password: string }) {
  const out = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  persistSessionToken(out.session);
  return out;
}

export async function logout() {
  if (typeof window !== "undefined") sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  return request<{ ok: true }>("/auth/logout", { method: "POST" });
}

export type ChatSession = {
  id: string;
  session_ref: string;
  last_active: string;
};

export async function listMyChats() {
  return request<{ chats: ChatSession[] }>("/api/my/chats");
}

export async function createMyChat(session_ref?: string) {
  return request<{ chat: ChatSession }>("/api/my/chats", {
    method: "POST",
    body: JSON.stringify({ session_ref })
  });
}

export type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  field_of_study: string | null;
  school: string | null;
  graduation_year: number | null;
  target_role: string | null;
  target_country: string | null;
  target_sector: string | null;
  willing_to_relocate: boolean | null;
  preferred_lang: string | null;
  cv_text: string | null;
};

export async function getMyProfile() {
  return request<{ profile: StudentProfile | null }>("/api/profile");
}

export async function updateMyProfile(patch: Partial<StudentProfile>) {
  return request<{ profile: StudentProfile }>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(patch)
  });
}

export async function listMessages(sessionId: string) {
  return request<{ messages: ChatMessage[] }>(`/api/chats/${sessionId}/messages`);
}

/** PDF uniquement — extraction côté back et mise à jour `student_profiles.cv_text`. */
export async function uploadCvPdf(file: File): Promise<{
  cvText: string;
  charCount: number;
  status: string;
}> {
  const fd = new FormData();
  fd.append("file", file);
  const headers = new Headers();
  applyAuthHeaders(headers);

  const res = await fetch(`${API_BASE}/api/upload-cv`, {
    method: "POST",
    headers,
    body: fd,
    credentials: "include"
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    cvText?: string;
    charCount?: number;
    status?: string;
  };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  if (!json.cvText) throw new Error("Réponse upload invalide");
  return {
    cvText: json.cvText,
    charCount: Number(json.charCount ?? json.cvText.length),
    status: String(json.status ?? "ready")
  };
}

export async function sendMessage(sessionId: string, content: string) {
  return request<{ message: ChatMessage }>(`/api/chats/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content })
  });
}

export async function saveAssistantMessage(sessionId: string, content: string) {
  const max = 8000;
  const body = content.length > max ? content.slice(0, max) : content;
  return request<{ message: ChatMessage }>(`/api/chats/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "assistant", content: body })
  });
}

export type StreamChatOptions = {
  cvText?: string;
  skill?: string;
  onToken?: (token: string) => void;
  onStatus?: (evt: ChatStatusEvent) => void;
  onDone?: () => void;
};

/**
 * 1) Persiste le message user via back/ (Supabase)
 * 2) Envoie l'historique + system prompt au Flask /chat (Groq + Tavily)
 * 3) Persiste la réponse assistant via back/ (Supabase)
 */
export async function streamChatMessage(
  sessionId: string,
  message: string,
  options: StreamChatOptions = {}
): Promise<void> {
  const { cvText, skill = DEFAULT_LLM_SKILL, onToken, onStatus, onDone } = options;

  await sendMessage(sessionId, message);
  const history = await listMessages(sessionId);
  const messages: LlmChatMessage[] = (history.messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const res = await fetch(llmEndpoint("chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildLlmChatBody(messages, { skill, cvText }))
  });

  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(String(json.error || json.message || `HTTP ${res.status}`));
    }
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  const assistantText = await consumeLlmChatSse(res, { onToken, onStatus, onDone });
  const toSave = assistantText.trim();
  if (toSave) {
    await saveAssistantMessage(sessionId, toSave);
  }
}

