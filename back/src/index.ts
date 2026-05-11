import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import jwt, { type SignOptions } from "jsonwebtoken";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Chemin vers les fichiers traineddata pré-téléchargés (évite le fetch réseau)
const TESSDATA_PATH = path.join(__dirname, "..", "tessdata");

import { supabase } from "./supabase.js";
import { zAuthLogin, zAuthSignup, zCreateMessage, zDevCreateUser, zUpsertProfile, zUserId } from "./validators.js";

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
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const AUTH_COOKIE = "apexai_token";

function cleanCvExtractedText(s: string): string {
  return String(s || "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdfTextBuffer(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const tr = await parser.getText();
    return cleanCvExtractedText(tr?.text || "");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// Singleton Tesseract worker — évite de recharger les modèles à chaque upload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tesseractWorker: any = null;
let _tesseractBusy = false;
const _tesseractQueue: Array<() => void> = [];

async function _getTesseractWorker() {
  if (!_tesseractWorker) {
    const { createWorker } = await import("tesseract.js");
    _tesseractWorker = await createWorker(["fra", "eng"], undefined, {
      langPath: TESSDATA_PATH,
    });
  }
  return _tesseractWorker;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _runWithTesseract<T>(fn: (w: any) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const execute = async () => {
      _tesseractBusy = true;
      try {
        const w = await _getTesseractWorker();
        resolve(await fn(w));
      } catch (e) {
        try { await _tesseractWorker?.terminate(); } catch { /* ignore */ }
        _tesseractWorker = null;
        reject(e);
      } finally {
        _tesseractBusy = false;
        const next = _tesseractQueue.shift();
        if (next) next();
      }
    };
    if (_tesseractBusy) {
      _tesseractQueue.push(execute);
    } else {
      void execute();
    }
  });
}

async function extractImageText(buf: Buffer): Promise<string> {
  return _runWithTesseract(async (worker) => {
    const result = await worker.recognize(buf);
    return cleanCvExtractedText(result.data.text || "");
  });
}

// Pré-chauffe le worker au démarrage (non-bloquant)
_getTesseractWorker().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.warn("[tesseract] warmup:", e instanceof Error ? e.message : String(e));
});

function getBearerToken(req: express.Request) {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

function getCookie(req: express.Request, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    if (k !== name) continue;
    return decodeURIComponent(p.slice(eq + 1));
  }
  return null;
}

function setAuthCookie(res: express.Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  const maxAgeSec = 60 * 60 * 24 * 7; // 7 jours (cookie), même si access token expire avant
  const attrs = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`
  ];
  if (isProd) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function clearAuthCookie(res: express.Response) {
  res.setHeader("Set-Cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function signAccessToken(params: { userId: string; email?: string | null }) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET manquant");
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "20m";
  const signOpts = { expiresIn } as SignOptions;
  return jwt.sign(
    { sub: params.userId, email: params.email ?? undefined, typ: "access" },
    secret,
    signOpts
  );
}

function verifyAccessToken(token: string): { userId: string; email?: string } | null {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as { sub?: string; email?: string; typ?: string };
    if (!decoded?.sub) return null;
    if (decoded.typ && decoded.typ !== "access") return null;
    return { userId: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

async function requireUser(req: express.Request, res: express.Response) {
  const token = getBearerToken(req) || getCookie(req, AUTH_COOKIE);
  if (!token) {
    res.status(401).json({ error: "missing_bearer_token" });
    return null;
  }

  // 1) Essaie d'abord ton JWT (custom)
  const jwtUser = verifyAccessToken(token);
  if (jwtUser) {
    return { id: jwtUser.userId, email: jwtUser.email ?? undefined } as unknown as { id: string; email?: string };
  }

  // 2) Fallback: token Supabase (si besoin)
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "invalid_token" });
    return null;
  }
  return data.user;
}

// ---------- Upload CV (PDF) — extraction texte locale ; le LLM (Groq/Tavily) vit dans llm/ ----------
app.post(
  "/api/upload-cv",
  (req, res, next) => {
    cvUpload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload invalide";
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const f = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!f?.buffer) return res.status(400).json({ error: "Fichier requis (PDF)" });

    const name = (f.originalname || "").toLowerCase();
    const mt = (f.mimetype || "").toLowerCase();
    const isPdf =
      name.endsWith(".pdf") ||
      mt === "application/pdf" ||
      mt === "application/x-pdf" ||
      (mt === "application/octet-stream" && name.endsWith(".pdf")) ||
      (mt === "binary/octet-stream" && name.endsWith(".pdf"));
    const isImage = mt.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name);
    if (!isPdf && !isImage) return res.status(400).json({ error: "Formats acceptés : PDF ou image (JPG, PNG, WebP)" });

    try {
      const cleanedText = isPdf
        ? await extractPdfTextBuffer(f.buffer)
        : await extractImageText(f.buffer);
      if (!cleanedText) {
        return res.status(500).json({ error: "Impossible de lire le PDF" });
      }
      const { data: updated, error: upErr } = await supabase
        .from("student_profiles")
        .update({ cv_text: cleanedText })
        .eq("id", user.id)
        .select("id");
      if (upErr) return res.status(500).json({ error: upErr.message });
      if (!updated?.length) {
        const email = "email" in user && user.email ? user.email : null;
        const { error: insErr } = await supabase.from("student_profiles").insert({
          id: user.id,
          email,
          cv_text: cleanedText
        });
        if (insErr) return res.status(500).json({ error: insErr.message });
      }
      return res.json({ cvText: cleanedText, charCount: cleanedText.length, status: "ready" });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[upload-cv] error:", e);
      return res.status(500).json({ error: "Impossible de lire le PDF" });
    }
  }
);

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
    const access_token = signAccessToken({ userId: login.data.user!.id, email: login.data.user?.email ?? email });
    setAuthCookie(res, access_token);
    return res.status(201).json({ user: login.data.user, session: { access_token } });
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
    session: { access_token: data.user ? signAccessToken({ userId: data.user.id, email }) : null }
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

  const access_token = signAccessToken({ userId: data.user!.id, email: data.user?.email ?? email });
  setAuthCookie(res, access_token);
  return res.json({ user: data.user, session: { access_token } });
});

app.post("/auth/logout", async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
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
  const user = await requireUser(req, res);
  if (!user) return;

  const parsed = zUserId.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: "invalid_user_id" });

  // Un étudiant ne peut consulter que son propre profil
  if (user.id !== parsed.data) return res.status(403).json({ error: "forbidden" });

  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("id", parsed.data)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data ?? null });
});

app.put("/api/profiles/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const id = zUserId.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "invalid_user_id" });

  if (user.id !== id.data) return res.status(403).json({ error: "forbidden" });

  const body = zUpsertProfile.safeParse({ ...req.body, id: id.data });
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

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

  if (!data) {
    const email = "email" in user && user.email ? user.email : null;
    const { data: created, error: upErr } = await supabase
      .from("student_profiles")
      .upsert({ id: user.id, email }, { onConflict: "id" })
      .select("*")
      .single();
    if (upErr) return res.status(500).json({ error: upErr.message });
    return res.json({ profile: created });
  }

  return res.json({ profile: data });
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

app.post("/api/chats", async (req, res) => {
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

app.patch("/api/my/chats/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const sessionId = zUserId.safeParse(req.params.id);
  if (!sessionId.success) return res.status(400).json({ error: "invalid_session_id" });

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("student_id")
    .eq("id", sessionId.data)
    .maybeSingle();
  if (!session || session.student_id !== user.id) return res.status(403).json({ error: "forbidden" });

  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : null;
  if (!title) return res.status(400).json({ error: "title requis" });

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId.data)
    .select("*")
    .single();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      // eslint-disable-next-line no-console
      console.warn("[api/my/chats PATCH] colonne title absente — exécuter migration_v2.sql :", error.message);
      return res.json({ chat: null });
    }
    return res.status(500).json({ error: error.message });
  }
  return res.json({ chat: data });
});

app.get("/api/chats/:sessionId/messages", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const sessionId = zUserId.safeParse(req.params.sessionId);
  if (!sessionId.success) return res.status(400).json({ error: "invalid_session_id" });

  // Vérifie que la session appartient à l'utilisateur
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("student_id")
    .eq("id", sessionId.data)
    .maybeSingle();
  if (!session || session.student_id !== user.id) return res.status(403).json({ error: "forbidden" });

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
  const user = await requireUser(req, res);
  if (!user) return;

  const sessionId = zUserId.safeParse(req.params.sessionId);
  if (!sessionId.success) return res.status(400).json({ error: "invalid_session_id" });

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("student_id")
    .eq("id", sessionId.data)
    .maybeSingle();
  if (!session || session.student_id !== user.id) return res.status(403).json({ error: "forbidden" });

  const body = zCreateMessage.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_payload", details: body.error.flatten() });

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId.data, role: body.data.role, content: body.data.content })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("chat_sessions").update({ last_active: new Date().toISOString() }).eq("id", sessionId.data);

  return res.status(201).json({ message: data });
});

// ---------- Skills ----------
app.get("/api/my/skills", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from("student_skills")
    .select("id, skill, level, source, confirmed, detected_at")
    .eq("student_id", user.id)
    .order("detected_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ skills: data ?? [] });
});

// ---------- Roadmap ----------
app.get("/api/roadmap", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from("student_profiles")
    .select("roadmap_json")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    const missingColumn =
      msg.includes("roadmap_json") ||
      msg.includes("column") && msg.includes("does not exist") ||
      msg.includes("schema cache");
    if (missingColumn) {
      // eslint-disable-next-line no-console
      console.warn("[api/roadmap] colonne roadmap_json absente — exécuter migration_v2.sql sur Supabase :", error.message);
      return res.json({ roadmap: null });
    }
    return res.status(500).json({ error: error.message });
  }
  return res.json({ roadmap: data?.roadmap_json ?? null });
});

const port = Number(process.env.PORT || process.env.BACKEND_PORT || 8090);
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

