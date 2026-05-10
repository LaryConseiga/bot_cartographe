"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Image from "next/image";

import {
  PlusIcon,
  MicrophoneIcon,
  ArrowUpIcon,
  SpeakerWaveIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";

type Message = { id: string; role: string; content: string };

function makeChatTitle(content: string): string {
  const clean = content.trim().replace(/\s+/g, " ");
  if (clean.length <= 50) return clean;
  const cut = clean.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function StatusBanner({
  message,
  showGlobe,
}: {
  message: string;
  showGlobe: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: { xs: 0, sm: 2 },
        py: 0.5,
        "@keyframes apex-globe-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      }}
    >
      {showGlobe ? (
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            lineHeight: 0,
            "& svg": {
              width: 22,
              height: 22,
              opacity: 0.85,
              animation: "apex-globe-spin 2.2s linear infinite",
            },
          }}
        >
          <GlobeAltIcon />
        </Box>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13.5 }}>
        {message}
      </Typography>
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end", px: { xs: 0, sm: 2 } }}>
        <Box
          sx={{
            maxWidth: "75%",
            bgcolor: "rgba(16,163,127,0.15)",
            border: "1px solid rgba(16,163,127,0.25)",
            borderRadius: "18px 18px 4px 18px",
            px: 2,
            py: 1.25,
          }}
        >
          <Typography variant="body2" sx={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, px: { xs: 0, sm: 2 } }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "8px",
          overflow: "hidden",
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.10)",
          mt: 0.25,
        }}
      >
        <Image src={LOGO_SRC} alt="ApexAI" width={30} height={30} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: "primary.main", fontSize: 11.5, mb: 0.5, display: "block" }}
        >
          ApexAI
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "text.primary" }}
        >
          {message.content}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [statusBanner, setStatusBanner] = React.useState<{ message: string; phase: string } | null>(
    null
  );
  const [streamingText, setStreamingText] = React.useState("");
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = React.useState(false);
  const [cvAttached, setCvAttached] = React.useState<{ text: string; fileName: string } | null>(null);
  const [roadmapReady, setRoadmapReady] = React.useState(false);
  const streamingAcc = React.useRef("");
  const sendingLock = React.useRef(false);
  const initSentRef = React.useRef(false);
  const messagesSentRef = React.useRef(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hasText = text.trim().length > 0;
  const canSend = hasText || cvAttached !== null;
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const chatSkill = React.useMemo(
    () => (typeof window !== "undefined" ? sessionStorage.getItem(`apex_chat_skill_${sessionId}`) ?? undefined : undefined),
    [sessionId]
  );

  const sendContent = React.useCallback(
    async (content: string, opts?: { cvText?: string }) => {
      const messageForApi = content.trim() || (opts?.cvText ? "J'ai importé mon CV." : "");
      if (!messageForApi || sendingLock.current) return;
      const isFirstMessage = messagesSentRef.current === 0;
      messagesSentRef.current += 1;
      sendingLock.current = true;
      setSending(true);
      setStatusBanner(null);
      setChatError(null);
      streamingAcc.current = "";
      setStreamingText("");

      const optimistic: Message = { id: `tmp-${Date.now()}`, role: "user", content: messageForApi };
      setMessages((prev) => [...prev, optimistic]);

      let assistantSynced = "";

      try {
        const { streamChatMessage, listMessages, ROADMAP_STORAGE_KEY, updateChatTitle } = await import("@/lib/api");
        let firstToken = true;
        await streamChatMessage(sessionId, messageForApi, {
          cvText: opts?.cvText,
          skill: chatSkill,
          onToken: (token) => {
            if (firstToken) {
              firstToken = false;
              setStatusBanner(null);
            }
            streamingAcc.current += token;
            assistantSynced = streamingAcc.current;
            setStreamingText(streamingAcc.current);
          },
          onStatus: (evt) => {
            if (evt.type === "status" && evt.message) {
              setStatusBanner({ message: evt.message, phase: evt.phase || "" });
            }
          },
          onRoadmap: (data) => {
            try {
              if (typeof window !== "undefined") {
                localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(data));
                // Notifie la page Progression si elle est ouverte dans le même onglet
                window.dispatchEvent(new CustomEvent("apex:roadmap-updated", { detail: data }));
              }
              setRoadmapReady(true);
            } catch { /* ignore */ }
          },
        });
        assistantSynced = streamingAcc.current;

        const mergeLocalReply = () => {
          setMessages((prev) => {
            const without = prev.filter((m) => m.id !== optimistic.id);
            return [
              ...without,
              { id: optimistic.id, role: "user", content: messageForApi },
              {
                id: `local-${Date.now()}`,
                role: "assistant",
                content: assistantSynced || "…",
              },
            ];
          });
        };

        try {
          const out = await listMessages(sessionId);
          const rows = out.messages || [];
          if (rows.length === 0 && assistantSynced.trim()) {
            setChatError(
              "Réponse reçue mais aucun message en base : vérifie la config Supabase du back (même projet que les sessions chat)."
            );
            mergeLocalReply();
          } else {
            setMessages(rows.map((m) => ({ id: m.id, role: m.role, content: m.content })));
          }
          if (isFirstMessage) {
            updateChatTitle(sessionId, makeChatTitle(messageForApi)).catch(() => {});
          }
        } catch (reloadErr) {
          // eslint-disable-next-line no-console
          console.error("[chat] listMessages après flux:", reloadErr);
          setChatError(
            "La réponse a été générée mais l’historique n’a pas pu être rechargé. Tu peux rafraîchir la page."
          );
          mergeLocalReply();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[chat] streamChatMessage:", e);
        const msg = e instanceof Error ? e.message : String(e);
        setChatError(
          msg ||
            "Impossible de joindre le serveur (back + service llm Flask sur le bon port ? session active ?)."
        );
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setStatusBanner(null);
      } finally {
        sendingLock.current = false;
        setSending(false);
        setStreamingText("");
        streamingAcc.current = "";
      }
    },
    [sessionId]
  );

  React.useEffect(() => {
    const bootstrapKey = `apex_init_msg_${sessionId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(bootstrapKey)?.trim()) {
      return;
    }
    let alive = true;
    import("@/lib/api")
      .then(async ({ listMessages }) => {
        try {
          const out = await listMessages(sessionId);
          if (!alive) return;
          const rows = out.messages || [];
          setMessages(
            rows.map((m) => ({ id: m.id, role: m.role, content: m.content }))
          );
        } catch {
          if (!alive) return;
          setMessages([]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sessionId]);

  React.useEffect(() => {
    if (initSentRef.current) return;
    const key = `apex_init_msg_${sessionId}`;
    const pending = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
    if (!pending?.trim()) return;
    initSentRef.current = true;
    sessionStorage.removeItem(key);
    void sendContent(pending.trim());
  }, [sessionId, sendContent]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, statusBanner, sending]);

  function handleSend() {
    if (!canSend || sending || uploadingCv) return;
    const content = text.trim() || (cvAttached ? "J'ai importé mon CV." : "");
    const cv = cvAttached;
    setText("");
    setCvAttached(null);
    void sendContent(content, cv ? { cvText: cv.text } : undefined);
  }

  async function handleCvFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || sendingLock.current) return;

    setUploadingCv(true);
    setChatError(null);

    try {
      const { uploadCvPdf, updateMyProfile } = await import("@/lib/api");
      let cvText: string;

      const lower = file.name.toLowerCase();
      const mt = (file.type || "").toLowerCase();
      const isPdf = mt === "application/pdf" || lower.endsWith(".pdf");
      const isTxt = mt.startsWith("text/") || lower.endsWith(".txt");
      const isImage = mt.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(lower);

      if (isPdf || isImage) {
        const out = await uploadCvPdf(file);
        cvText = out.cvText;
      } else if (isTxt) {
        const raw = await file.text();
        const forProfile = raw.slice(0, 20_000);
        await updateMyProfile({ cv_text: forProfile });
        cvText = raw.slice(0, 12_000);
      } else {
        setChatError("Formats acceptés : PDF, image (JPG, PNG, WebP) ou fichier texte (.txt).");
        return;
      }

      if (!cvText.trim()) {
        setChatError("Le fichier semble vide ou illisible.");
        return;
      }

      setCvAttached({ text: cvText, fileName: file.name });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[chat] import CV:", err);
      setChatError(err instanceof Error ? err.message : "Import du document impossible.");
    } finally {
      setUploadingCv(false);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 60px)" }}>
      {chatError ? (
        <Alert
          severity="error"
          onClose={() => setChatError(null)}
          sx={{ maxWidth: 860, width: "100%", mx: "auto", mb: 1 }}
        >
          {chatError}
        </Alert>
      ) : null}

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          maxWidth: 860,
          width: "100%",
          mx: "auto",
          py: 2,
        }}
      >
        {messages.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, opacity: 0.4 }}>
            <Typography variant="body2" color="text.secondary">
              Démarrez la conversation…
            </Typography>
          </Box>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}

        {statusBanner ? (
          <StatusBanner
            message={statusBanner.message}
            showGlobe={statusBanner.phase === "search"}
          />
        ) : null}

        {streamingText ? (
          <MessageBubble message={{ id: "_streaming", role: "assistant", content: streamingText }} />
        ) : null}

        {/* Indicateur d’attente (avant premier jeton / statut) */}
        {(sending || uploadingCv) && !streamingText && !statusBanner ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 0, sm: 2 } }}>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "8px",
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <Image src={LOGO_SRC} alt="ApexAI" width={30} height={30} />
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: 30 }}>
              {[0, 0.15, 0.3].map((delay) => (
                <Box
                  key={delay}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    opacity: 0.6,
                    animation: "apex-pulse 1.2s ease-in-out infinite",
                    animationDelay: `${delay}s`,
                    "@keyframes apex-pulse": {
                      "0%, 80%, 100%": { transform: "scale(0.8)", opacity: 0.4 },
                      "40%": { transform: "scale(1.2)", opacity: 1 },
                    },
                  }}
                />
              ))}
            </Box>
            {uploadingCv && !sending ? (
              <Typography variant="caption" sx={{ opacity: 0.55, fontSize: 12.5, ml: 0.5 }}>
                Extraction du CV en cours…
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <div ref={bottomRef} />
      </Box>

      {/* Notification roadmap prête */}
      {roadmapReady ? (
        <Paper
          elevation={0}
          sx={{
            maxWidth: 860,
            width: "100%",
            mx: "auto",
            mb: 1.5,
            p: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            border: "1px solid rgba(16,163,127,0.4)",
            bgcolor: "rgba(16,163,127,0.08)",
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 600 }}>
            Ta roadmap est prête !
          </Typography>
          <Button
            onClick={() => router.push("/chat/progression")}
            size="small"
            variant="contained"
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              textTransform: "none",
              bgcolor: "#10A37F",
              "&:hover": { bgcolor: "#0d8f6a" },
              boxShadow: "none",
            }}
          >
            Voir la Progression
          </Button>
        </Paper>
      ) : null}

      {/* Input fichier hors du form pour éviter tout conflit de soumission */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleCvFileSelected}
      />

      {/* Barre d'input */}
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          pt: 2,
          pb: { xs: 2, sm: 3 },
          bgcolor: "background.default",
        }}
      >
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          sx={{ maxWidth: 860, width: "100%", mx: "auto" }}
        >
          {/* Chip CV attaché */}
          {cvAttached ? (
            <Box sx={{ px: 1, pb: 0.75 }}>
              <Chip
                label={`CV : ${cvAttached.fileName}`}
                size="small"
                onDelete={() => setCvAttached(null)}
                sx={{
                  bgcolor: "rgba(16,163,127,0.15)",
                  color: "primary.main",
                  border: "1px solid rgba(16,163,127,0.3)",
                  fontSize: 12,
                  fontWeight: 600,
                  "& .MuiChip-deleteIcon": { color: "primary.main", opacity: 0.7 },
                }}
              />
            </Box>
          ) : null}

          <Paper
            elevation={0}
            sx={{
              p: 0.75,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              borderRadius: "18px",
              border: "1px solid",
              borderColor: cvAttached ? "rgba(16,163,127,0.4)" : "divider",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              "&:focus-within": { borderColor: "rgba(16,163,127,0.5)" },
              transition: "border-color 0.2s",
            }}
          >
            <IconButton
              type="button"
              aria-label="Importer un CV (PDF ou texte)"
              size="small"
              sx={{ ml: 0.5, opacity: cvAttached ? 1 : 0.55, color: cvAttached ? "primary.main" : "inherit" }}
              disabled={sending || uploadingCv}
              onClick={() => fileInputRef.current?.click()}
            >
              <PlusIcon style={{ width: 18, height: 18 }} />
            </IconButton>
            <TextField
              placeholder={cvAttached ? "Ajoutez un message ou envoyez directement…" : "Posez votre question à ApexAI…"}
              variant="standard"
              fullWidth
              slotProps={{ input: { disableUnderline: true } }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              sx={{
                "& input": { fontSize: 14.5, py: 0.75 },
                "& .MuiInput-root:before, & .MuiInput-root:after": { display: "none" },
              }}
            />
            <IconButton type="button" aria-label="Micro" size="small" sx={{ opacity: 0.55 }}>
              <MicrophoneIcon style={{ width: 18, height: 18 }} />
            </IconButton>
            <IconButton
              type={canSend ? "submit" : "button"}
              aria-label={canSend ? "Envoyer le message" : "Saisis un message pour envoyer (audio à venir)"}
              disabled={sending || uploadingCv}
              onClick={(e) => {
                if (!canSend) e.preventDefault();
              }}
              sx={{
                mr: 0.5,
                bgcolor: canSend ? "primary.main" : "rgba(255,255,255,0.07)",
                color: canSend ? "white" : "text.secondary",
                "&:hover": { bgcolor: canSend ? "#0d8a6b" : "rgba(255,255,255,0.10)" },
                "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.05)", color: "text.secondary" },
                width: 36,
                height: 36,
                transition: "background-color 0.2s",
              }}
            >
              {canSend ? (
                <ArrowUpIcon style={{ width: 18, height: 18 }} />
              ) : (
                <SpeakerWaveIcon style={{ width: 18, height: 18 }} />
              )}
            </IconButton>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
