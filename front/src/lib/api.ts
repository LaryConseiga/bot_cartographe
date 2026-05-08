"use client";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8092";
const TOKEN_KEY = "apexai_access_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, token);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
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
  setToken(out.session?.access_token ?? null);
  return out;
}

export async function login(payload: { email: string; password: string }) {
  const out = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  setToken(out.session?.access_token ?? null);
  return out;
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

export async function sendMessage(sessionId: string, content: string) {
  return request<{ message: ChatMessage }>(`/api/chats/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content })
  });
}

