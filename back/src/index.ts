import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

import { supabase } from "./supabase.js";
import { zAuthLogin, zAuthSignup, zCreateChat, zCreateMessage, zDevCreateUser, zUpsertProfile, zUserId } from "./validators.js";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: (requestOrigin, cb) => {
      const allow = new Set(
        (process.env.FRONTEND_ORIGINS ||
          process.env.FRONTEND_ORIGIN ||
          "http://localhost:3000,http://localhost:3001,http://localhost:3002")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );

      // Autorise aussi localhost/127.0.0.1 sur n'importe quel port en dev
      if (!requestOrigin) return cb(null, true);
      if (allow.has(requestOrigin)) return cb(null, true);
      if (/^https?:\/\/localhost:\d+$/.test(requestOrigin)) return cb(null, true);
      if (/^https?:\/\/127\.0\.0\.1:\d+$/.test(requestOrigin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${requestOrigin}`), false);
    },
    credentials: true
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

function getBearerToken(req: express.Request) {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

async function requireUser(req: express.Request, res: express.Response) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "missing_bearer_token" });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "invalid_token" });
    return null;
  }
  return data.user;
}

// ---------- Auth (sans LLM) ----------
app.post("/auth/signup", async (req, res) => {
  const body = zAuthSignup.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const email = body.data.email.trim().replace(/^"+|"+$/g, "").toLowerCase();
  const password = body.data.password;
  const preferred_lang =
    body.data.preferred_lang ||
    (typeof req.headers["accept-language"] === "string" && req.headers["accept-language"].slice(0, 2)) ||
    "fr";
  const country = body.data.country ?? null;
  const city = body.data.city ?? null;

  // Dev mode: bypass email send + rate limits by using admin createUser
  if (process.env.DEV_BYPASS_EMAIL_SIGNUP === "1") {
    // eslint-disable-next-line no-console
    console.log("[auth] DEV_BYPASS_EMAIL_SIGNUP=1 -> admin.createUser + login");
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.data.full_name ?? null }
    });

    if (created.error) {
      // eslint-disable-next-line no-console
      console.log("signup(admin) error:", created.error);
      return res.status(400).json({ error: created.error.message });
    }

    if (created.data.user) {
      await supabase
        .from("student_profiles")
        .upsert(
          {
            id: created.data.user.id,
            email,
            full_name: body.data.full_name ?? null,
            preferred_lang,
            country,
            city,
            willing_to_relocate: true
          },
          { onConflict: "id" }
        );
    }

    // return a real session by logging in
    const login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) return res.status(401).json({ error: login.error.message });
    return res.status(201).json({ user: login.data.user, session: login.data.session });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    // eslint-disable-next-line no-console
    console.log("signup error:", error);
    return res.status(400).json({ error: error.message });
  }

  // Crée/maj profil applicatif (FK sur auth.users.id)
  if (data.user) {
    await supabase
      .from("student_profiles")
      .upsert(
        {
          id: data.user.id,
          email,
          full_name: body.data.full_name ?? null,
          preferred_lang,
          country,
          city,
          willing_to_relocate: true
        },
        { onConflict: "id" }
      )
      .select("id");
  }

  return res.status(201).json({
    user: data.user,
    session: data.session
  });
});

app.post("/auth/login", async (req, res) => {
  const body = zAuthLogin.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const email = body.data.email.trim().replace(/^"+|"+$/g, "").toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: body.data.password
  });
  if (error) return res.status(401).json({ error: error.message });

  return res.json({
    user: data.user,
    session: data.session
  });
});

// Dev helper: créer un user sans email (bypass rate-limit email).
app.post("/auth/dev-create-user", async (req, res) => {
  const body = zDevCreateUser.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const expected = process.env.DEV_ADMIN_SECRET;
  if (!expected || body.data.secret !== expected) return res.status(403).json({ error: "forbidden" });

  const email = body.data.email.trim().replace(/^"+|"+$/g, "").toLowerCase();
  const password = body.data.password;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: body.data.full_name ?? null }
  });

  if (error) return res.status(400).json({ error: error.message });

  if (data.user) {
    await supabase
      .from("student_profiles")
      .upsert({ id: data.user.id, email, full_name: body.data.full_name ?? null }, { onConflict: "id" });
  }

  return res.status(201).json({ user: data.user });
});

// ---------- Profiles ----------
app.get("/api/profiles/:id", async (req, res) => {
  const parsed = zUserId.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: "invalid_user_id" });

  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("id", parsed.data)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data ?? null });
});

app.put("/api/profiles/:id", async (req, res) => {
  const id = zUserId.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "invalid_user_id" });

  const body = zUpsertProfile.safeParse({ ...req.body, id: id.data });
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  // Upsert profile row. NB: student_profiles.id references auth.users(id).
  const { data, error } = await supabase
    .from("student_profiles")
    .upsert(body.data, { onConflict: "id" })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data });
});

// Auth-based profile (recommandé côté front)
app.get("/api/profile", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data ?? null });
});

app.put("/api/profile", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = zUpsertProfile.safeParse({ ...req.body, id: user.id });
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const { data, error } = await supabase
    .from("student_profiles")
    .upsert(body.data, { onConflict: "id" })
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data });
});

// ---------- Chats ----------
app.get("/api/chats", async (req, res) => {
  const studentId = zUserId.safeParse(req.query.student_id);
  if (!studentId.success) return res.status(400).json({ error: "invalid_student_id" });

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("student_id", studentId.data)
    .order("last_active", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ chats: data ?? [] });
});

app.post("/api/chats", async (req, res) => {
  const body = zCreateChat.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const session_ref = body.data.session_ref ?? `chat_${randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ student_id: body.data.student_id, session_ref })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ chat: data });
});

// Auth-based chats (recommandé côté front)
app.get("/api/my/chats", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("student_id", user.id)
    .order("last_active", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ chats: data ?? [] });
});

app.post("/api/my/chats", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const session_ref = typeof req.body?.session_ref === "string" ? req.body.session_ref : undefined;
  const finalRef = session_ref ?? `chat_${randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ student_id: user.id, session_ref: finalRef })
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ chat: data });
});

app.get("/api/chats/:sessionId/messages", async (req, res) => {
  const sessionId = zUserId.safeParse(req.params.sessionId);
  if (!sessionId.success) return res.status(400).json({ error: "invalid_session_id" });

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId.data)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ messages: data ?? [] });
});

app.post("/api/chats/:sessionId/messages", async (req, res) => {
  const sessionId = zUserId.safeParse(req.params.sessionId);
  if (!sessionId.success) return res.status(400).json({ error: "invalid_session_id" });

  const body = zCreateMessage.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId.data, role: body.data.role, content: body.data.content })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // update last_active
  await supabase.from("chat_sessions").update({ last_active: new Date().toISOString() }).eq("id", sessionId.data);

  return res.status(201).json({ message: data });
});

const port = Number(process.env.BACKEND_PORT || 8090);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[apexai-back] listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`[apexai-back] DEV_BYPASS_EMAIL_SIGNUP=${process.env.DEV_BYPASS_EMAIL_SIGNUP ?? "0"}`);
});

async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from("student_profiles").select("id").limit(1);
    if (error) {
      // eslint-disable-next-line no-console
      console.log("[supabase] connection error:", error.message);
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[supabase] connected ✅ (student_profiles sample rows:", (data ?? []).length, ")");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[supabase] connection error:", e instanceof Error ? e.message : String(e));
  }
}

checkSupabaseConnection();

