"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [summaryText, setSummaryText] = React.useState("");
  const [summarizing, setSummarizing] = React.useState(false);
  const streamingAcc = React.useRef("");
  const sendingLock = React.useRef(false);
  const initSentRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hasText = text.trim().length > 0;
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const sendContent = React.useCallback(
    async (content: string, opts?: { cvText?: string }) => {
      const messageForApi = content.trim() || (opts?.cvText ? "J'ai importé mon CV." : "");
      if (!messageForApi || sendingLock.current) return;
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
        const { streamChatMessage, listMessages } = await import("@/lib/api");
        let firstToken = true;
        await streamChatMessage(sessionId, messageForApi, {
          cvText: opts?.cvText,
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
    const content = text.trim();
    if (!content || sending || uploadingCv) return;
    setText("");
    void sendContent(content);
  }

  async function handleSummarize() {
    const pairs = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    if (pairs.length === 0) {
      setSummaryText("Aucune conversation à résumer.");
      setSummaryOpen(true);
      return;
    }
    setSummarizing(true);
    setSummaryOpen(true);
    setSummaryText("Génération du résumé…");
    try {
      const { summarizeThread } = await import("@/lib/api");
      const s = await summarizeThread(pairs);
      setSummaryText(s);
    } catch (e) {
      setSummaryText(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSummarizing(false);
    }
  }

  async function handleNewChat() {
    if (
      messages.length > 0 &&
      typeof window !== "undefined" &&
      !window.confirm("Ouvrir une nouvelle conversation ? La session actuelle reste dans ton historique.")
    ) {
      return;
    }
    try {
      const { createMyChat } = await import("@/lib/api");
      const out = await createMyChat();
      router.push(`/chat/c/${out.chat.id}`);
    } catch {
      setChatError("Impossible de créer une nouvelle conversation.");
    }
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
      const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
      const isTxt = file.type.startsWith("text/") || lower.endsWith(".txt");

      if (isPdf) {
        const out = await uploadCvPdf(file);
        cvText = out.cvText;
      } else if (isTxt) {
        const raw = await file.text();
        const forProfile = raw.slice(0, 20_000);
        await updateMyProfile({ cv_text: forProfile });
        cvText = raw.slice(0, 12_000);
      } else {
        setChatError("Formats acceptés : PDF ou fichier texte (.txt).");
        return;
      }

      if (!cvText.trim()) {
        setChatError("Le fichier semble vide.");
        return;
      }

      await sendContent("J'ai importé mon CV.", { cvText });
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

      <Box
        sx={{
          maxWidth: 860,
          width: "100%",
          mx: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
          py: 1,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
          ApexAI — Chat Groq
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={sending || summarizing || uploadingCv}
            onClick={() => void handleSummarize()}
          >
            Résumer
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={sending || uploadingCv}
            onClick={() => void handleNewChat()}
          >
            Nouvelle conversation
          </Button>
        </Box>
      </Box>

      {summaryOpen ? (
        <Paper
          elevation={0}
          sx={{
            maxWidth: 860,
            width: "100%",
            mx: "auto",
            mb: 2,
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderLeft: "3px solid",
            borderLeftColor: "primary.main",
            bgcolor: "action.hover",
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: "primary.main", letterSpacing: 0.5, display: "block", mb: 1 }}
          >
            Résumé de la conversation
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
            {summaryText}
          </Typography>
        </Paper>
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
          </Box>
        ) : null}

        <div ref={bottomRef} />
      </Box>

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
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            style={{ display: "none" }}
            onChange={handleCvFileSelected}
          />
          <Paper
            elevation={0}
            sx={{
              p: 0.75,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              borderRadius: "18px",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              "&:focus-within": { borderColor: "rgba(16,163,127,0.5)" },
              transition: "border-color 0.2s",
            }}
          >
            <IconButton
              type="button"
              aria-label="Importer un CV (PDF ou texte)"
              size="small"
              sx={{ ml: 0.5, opacity: 0.55 }}
              disabled={sending || uploadingCv}
              onClick={() => fileInputRef.current?.click()}
            >
              <PlusIcon style={{ width: 18, height: 18 }} />
            </IconButton>
            <TextField
              placeholder="Posez votre question à ApexAI…"
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
              type={hasText ? "submit" : "button"}
              aria-label={hasText ? "Envoyer le message" : "Saisis un message pour envoyer (audio à venir)"}
              disabled={sending || uploadingCv}
              onClick={(e) => {
                if (!hasText) e.preventDefault();
              }}
              sx={{
                mr: 0.5,
                bgcolor: hasText ? "primary.main" : "rgba(255,255,255,0.07)",
                color: hasText ? "white" : "text.secondary",
                "&:hover": { bgcolor: hasText ? "#0d8a6b" : "rgba(255,255,255,0.10)" },
                "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.05)", color: "text.secondary" },
                width: 36,
                height: 36,
                transition: "background-color 0.2s",
              }}
            >
              {hasText ? (
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
