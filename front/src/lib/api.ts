"use client";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8092";

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

/** PDF uniquement — extrait le texte via le back → llm-back et met à jour `student_profiles.cv_text`. */
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

/** Événement SSE émis par le back (ex. consultation roadmap.sh). */
export type ChatStatusEvent = {
  type?: string;
  phase?: string;
  message?: string;
  icon?: string;
  source?: string;
  slug?: string;
};

export type StreamChatOptions = {
  cvText?: string;
  onToken?: (token: string) => void;
  onStatus?: (evt: ChatStatusEvent) => void;
  onDone?: () => void;
};

/**
 * Envoie un message au LLM via POST /api/chat (SSE). Les messages user/assistant
 * sont enregistrés côté serveur (llm-back) dans chat_messages.
 */
export async function streamChatMessage(
  sessionId: string,
  message: string,
  options: StreamChatOptions = {}
): Promise<void> {
  const { cvText, onToken, onStatus, onDone } = options;
  const headers = new Headers({ "Content-Type": "application/json" });
  applyAuthHeaders(headers);
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      sessionId,
      message,
      ...(cvText ? { cvText } : {})
    })
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(String(json.error || json.message || `HTTP ${res.status}`));
    }
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Réponse vide");

  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const handleDataPayload = (data: unknown): boolean => {
    if (data === "[DONE]") {
      finished = true;
      onDone?.();
      return true;
    }
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      if ("error" in o && typeof o.error === "string") {
        throw new Error(o.error);
      }
      if ("token" in o && typeof o.token === "string") {
        onToken?.(o.token);
      }
      if (o.type === "status") {
        onStatus?.(o as ChatStatusEvent);
      }
    }
    return false;
  };

  const processEventBlock = (block: string) => {
    const lines = block.split("\n").filter((l) => l.length > 0);
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      if (handleDataPayload(data)) return true;
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    for (;;) {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) break;
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (processEventBlock(block)) {
        await reader.cancel().catch(() => {});
        return;
      }
    }
  }

  if (buffer.trim()) {
    processEventBlock(buffer);
  }
  if (!finished) onDone?.();
}

