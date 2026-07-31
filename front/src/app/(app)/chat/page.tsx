"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import {
  PlusIcon,
  MicrophoneIcon,
  ArrowUpIcon,
  SpeakerWaveIcon,
  ChartBarIcon,
  BriefcaseIcon,
  ArrowTrendingUpIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import { SHOW_PROGRESSION } from "@/lib/featureFlags";
import { isDemoSession } from "@/lib/api";
import DemoGateDialog from "@/components/auth/DemoGateDialog";

const SUGGESTIONS = [
  {
    icon: <ChartBarIcon style={{ width: 18, height: 18, color: "#10A37F" }} />,
    title: "Analyser mon CV",
    desc: "Identifie mes lacunes pour le marché de Dakar",
  },
  {
    icon: <BriefcaseIcon style={{ width: 18, height: 18, color: "#6366F1" }} />,
    title: "Offres d'emploi",
    desc: "Trouver des opportunités en Côte d'Ivoire",
  },
  {
    icon: <ArrowTrendingUpIcon style={{ width: 18, height: 18, color: "#F59E0B" }} />,
    title: "Tendances marché",
    desc: "Compétences demandées au Burkina Faso",
  },
  ...(SHOW_PROGRESSION
    ? [
        {
          icon: <AcademicCapIcon style={{ width: 18, height: 18, color: "#EC4899" }} />,
          title: "Mon plan 6 mois",
          desc: "Créer un parcours d'apprentissage personnalisé",
        },
      ]
    : []),
];

export default function ChatHomePage() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [uploadingCv, setUploadingCv] = React.useState(false);
  const [cvAttached, setCvAttached] = React.useState<{ fileName: string } | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [showDemoGate, setShowDemoGate] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hasText = text.trim().length > 0;

  async function handleCvFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingCv(true);
    setUploadError(null);

    try {
      const { uploadCvPdf, updateMyProfile } = await import("@/lib/api");
      const lower = file.name.toLowerCase();
      const mt = (file.type || "").toLowerCase();
      const isPdf = mt === "application/pdf" || lower.endsWith(".pdf");
      const isTxt = mt.startsWith("text/") || lower.endsWith(".txt");
      const isImage = mt.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(lower);

      if (isPdf || isImage) {
        await uploadCvPdf(file);
      } else if (isTxt) {
        const raw = await file.text();
        await updateMyProfile({ cv_text: raw.slice(0, 20_000) });
      } else {
        setUploadError("Formats acceptés : PDF, image (JPG, PNG, WebP) ou fichier texte (.txt).");
        return;
      }

      setCvAttached({ fileName: file.name });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[chat] import CV:", err);
      setUploadError(err instanceof Error ? err.message : "Import du document impossible.");
    } finally {
      setUploadingCv(false);
    }
  }

  async function handleSend(message?: string) {
    if (isDemoSession()) {
      setShowDemoGate(true);
      return;
    }
    try {
      const { createMyChat } = await import("@/lib/api");
      const out = await createMyChat();
      const dest = `/chat/c/${out.chat.id}`;
      if (message) {
        sessionStorage.setItem(`apex_init_msg_${out.chat.id}`, message);
      }
      router.push(dest);
    } catch {
      // ignore
    }
  }

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2.5,
        pb: { xs: 10, sm: 12 },
        px: 1,
      }}
    >
      {/* Heading */}
      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
          Bonjour 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sur quoi puis-je vous aider aujourd'hui ?
        </Typography>
      </Box>

      {/* Input */}
      <Box sx={{ width: "100%", maxWidth: 700 }}>
        {uploadError ? (
          <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mb: 1 }}>
            {uploadError}
          </Alert>
        ) : null}
        {cvAttached ? (
          <Box sx={{ pb: 0.75 }}>
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleCvFileSelected}
        />
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            p: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            borderRadius: "18px",
            border: "1px solid",
            borderColor: cvAttached ? "rgba(16,163,127,0.4)" : "divider",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            "&:focus-within": {
              borderColor: "rgba(16,163,127,0.5)",
              boxShadow: "0 4px 24px rgba(16,163,127,0.10)",
            },
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
        <IconButton
          type="button"
          aria-label="Importer un CV (PDF, image ou texte)"
          size="small"
          sx={{ ml: 0.5, opacity: cvAttached ? 1 : 0.55, color: cvAttached ? "primary.main" : "inherit" }}
          disabled={uploadingCv}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadingCv ? <CircularProgress size={16} /> : <PlusIcon style={{ width: 18, height: 18 }} />}
        </IconButton>
        <TextField
          placeholder="Posez votre question à ApexAI…"
          variant="standard"
          fullWidth
          slotProps={{ input: { disableUnderline: true } }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && hasText) {
              e.preventDefault();
              handleSend(text.trim());
            }
          }}
          sx={{
            "& input": { fontSize: 14.5, py: 0.75 },
            "& .MuiInput-root:before, & .MuiInput-root:after": { display: "none" },
          }}
        />
        <IconButton aria-label="Micro" size="small" sx={{ opacity: 0.55 }}>
          <MicrophoneIcon style={{ width: 18, height: 18 }} />
        </IconButton>
        <IconButton
          aria-label={hasText ? "Envoyer" : "Audio"}
          onClick={() => hasText && handleSend(text.trim())}
          sx={{
            mr: 0.5,
            bgcolor: hasText ? "primary.main" : "rgba(255,255,255,0.07)",
            color: hasText ? "white" : "text.secondary",
            "&:hover": { bgcolor: hasText ? "#0d8a6b" : "rgba(255,255,255,0.10)" },
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

      {/* Suggestions */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 700,
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
          gap: 1,
        }}
      >
        {SUGGESTIONS.map((s) => (
          <ButtonBase
            key={s.title}
            onClick={() => handleSend(s.desc)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0.75,
              p: 1.5,
              borderRadius: "12px",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              textAlign: "left",
              transition: "border-color 0.15s, background-color 0.15s",
              "&:hover": {
                borderColor: "rgba(16,163,127,0.4)",
                bgcolor: "rgba(16,163,127,0.04)",
              },
            }}
          >
            {s.icon}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: "block", fontSize: 12.5 }}>
                {s.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11.5, lineHeight: 1.4 }}>
                {s.desc}
              </Typography>
            </Box>
          </ButtonBase>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", maxWidth: 600, opacity: 0.5 }}>
        ApexAI peut commettre des erreurs. Vérifiez les informations importantes.
      </Typography>

      <DemoGateDialog open={showDemoGate} onClose={() => setShowDemoGate(false)} />
    </Box>
  );
}
