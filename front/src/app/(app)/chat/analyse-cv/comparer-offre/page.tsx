"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import type { CvContent, CvMatchResult } from "@/lib/api";
import { scoreColor, downloadBlob } from "@/lib/cvMatchDisplay";

const TEAL = "#10A37F";
const ORANGE = "#F59E0B";

type Step = "paste" | "matching" | "matched";

export default function ComparerOffrePage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("paste");
  const [cvText, setCvText] = React.useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = React.useState(true);
  const [jobTitle, setJobTitle] = React.useState("");
  const [jobCompany, setJobCompany] = React.useState("");
  const [jobDescription, setJobDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [match, setMatch] = React.useState<CvMatchResult | null>(null);
  const [downloading, setDownloading] = React.useState<"fr" | "en" | null>(null);
  const [extracting, setExtracting] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const { getMyProfile } = await import("@/lib/api");
        const { profile } = await getMyProfile();
        setCvText(profile?.cv_text ?? null);
      } catch {
        setCvText(null);
      } finally {
        setCheckingProfile(false);
      }
    })();
  }, []);

  async function handleImportFile(file: File) {
    setExtracting(true);
    setError(null);
    try {
      const { extractTextFromFile } = await import("@/lib/api");
      const { text } = await extractTextFromFile(file);
      setJobDescription((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de lire ce fichier.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleEvaluate() {
    if (!cvText || !jobDescription.trim()) return;
    setStep("matching");
    setError(null);
    try {
      const { matchCvToOffer } = await import("@/lib/api");
      const jobOfferText = [
        jobTitle.trim() && `Titre : ${jobTitle.trim()}`,
        jobCompany.trim() && `Entreprise : ${jobCompany.trim()}`,
        `Description :\n${jobDescription.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");
      const result = await matchCvToOffer(cvText, jobOfferText);
      setMatch(result);
      setStep("matched");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'évaluation.");
      setStep("paste");
    }
  }

  async function handleDownload(lang: "fr" | "en", cv: CvContent) {
    setDownloading(lang);
    setError(null);
    try {
      const { generateCvPdf } = await import("@/lib/api");
      const blob = await generateCvPdf(cv, lang);
      const name = cv.personal_info?.full_name?.replace(/\s+/g, "_") || "cv";
      downloadBlob(blob, `CV_${name}_${lang}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la génération du PDF.");
    } finally {
      setDownloading(null);
    }
  }

  // ── MATCHED ──────────────────────────────────────────────────────────────────
  if (step === "matched" && match) {
    const color = scoreColor(match.score);
    return (
      <Box sx={{ maxWidth: 760, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Comparaison CV / Offre
        </Typography>

        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3, bgcolor: "#0D1117", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color }}>
              {match.score}%
            </Typography>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={match.score}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: "rgba(255,255,255,0.08)",
                  "& .MuiLinearProgress-bar": { borderRadius: 4, bgcolor: color },
                }}
              />
            </Box>
          </Box>

          <Typography variant="body2" sx={{ fontSize: 14, lineHeight: 1.65, mb: 3, color: "#E5E7EB" }}>
            {match.explanation}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: TEAL, mb: 1 }}>
                Points forts
              </Typography>
              {match.strengths.map((s, i) => (
                <Typography key={i} variant="body2" sx={{ fontSize: 13.5, mb: 0.5 }}>
                  • {s}
                </Typography>
              ))}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: ORANGE, mb: 1 }}>
                Écarts à combler
              </Typography>
              {match.gaps.map((g, i) => (
                <Typography key={i} variant="body2" sx={{ fontSize: 13.5, mb: 0.5 }}>
                  • {g}
                </Typography>
              ))}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Suggestions de réorganisation
              </Typography>
              {match.reorg_suggestions.map((r, i) => (
                <Typography key={i} variant="body2" sx={{ fontSize: 13.5, mb: 0.5 }}>
                  • {r}
                </Typography>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, mt: 3.5, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={downloading === "fr" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <ArrowDownTrayIcon style={{ width: 16, height: 16 }} />}
              disabled={downloading !== null}
              onClick={() => handleDownload("fr", match.cv_fr)}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, bgcolor: TEAL, "&:hover": { bgcolor: "#0d8f6a" }, boxShadow: "none" }}
            >
              Télécharger CV (FR)
            </Button>
            <Button
              variant="outlined"
              startIcon={downloading === "en" ? <CircularProgress size={16} /> : <ArrowDownTrayIcon style={{ width: 16, height: 16 }} />}
              disabled={downloading !== null}
              onClick={() => handleDownload("en", match.cv_en)}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5 }}
            >
              Download CV (EN)
            </Button>
          </Box>
        </Paper>

        <Button
          variant="outlined"
          size="small"
          onClick={() => { setStep("paste"); setMatch(null); }}
          sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700, borderColor: "divider", color: "text.secondary" }}
        >
          ← Comparer à une autre offre
        </Button>
      </Box>
    );
  }

  // ── MATCHING ─────────────────────────────────────────────────────────────────
  if (step === "matching") {
    return (
      <Box sx={{ maxWidth: 760, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Comparaison CV / Offre
        </Typography>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", alignItems: "center", gap: 2.5, minHeight: 200, justifyContent: "center" }}>
          <CircularProgress size={44} sx={{ color: TEAL }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Apex compare ton CV à l&apos;offre…
          </Typography>
        </Paper>
      </Box>
    );
  }

  // ── PASTE ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 760, mx: "auto", display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Comparer mon CV à une offre d&apos;emploi
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Colle le titre, l&apos;entreprise et la description de l&apos;offre visée — Apex évalue ton CV par rapport à cette offre.
        </Typography>
      </Box>

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      {!checkingProfile && !cvText ? (
        <Alert severity="warning">
          Aucun CV trouvé sur ton profil.{" "}
          <Chip
            label="Analyser mon CV d'abord"
            size="small"
            onClick={() => router.push("/chat/analyse-cv")}
            sx={{ cursor: "pointer", fontWeight: 700 }}
          />
        </Alert>
      ) : null}

      <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 2.5 }}>
        <TextField
          label="Titre du poste"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Entreprise"
          value={jobCompany}
          onChange={(e) => setJobCompany(e.target.value)}
          fullWidth
          size="small"
        />
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary" }}>
              Description de l&apos;offre
            </Typography>
            <Button
              component="label"
              size="small"
              variant="outlined"
              disabled={extracting}
              startIcon={extracting ? <CircularProgress size={14} /> : <ArrowUpTrayIcon style={{ width: 14, height: 14 }} />}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: 12.5 }}
            >
              {extracting ? "Extraction…" : "Importer un fichier (PDF, image)"}
              <input
                type="file"
                hidden
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
            </Button>
          </Box>
          <TextField
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            fullWidth
            required
            multiline
            minRows={8}
            placeholder="Colle ici le texte complet de l'offre d'emploi, ou importe un fichier ci-dessus…"
          />
        </Box>
      </Paper>

      <Button
        variant="contained"
        size="large"
        disabled={!cvText || !jobDescription.trim() || checkingProfile}
        onClick={handleEvaluate}
        sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2.5, px: 4, bgcolor: TEAL, "&:hover": { bgcolor: "#0d8f6a" }, "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "text.disabled" }, boxShadow: "none" }}
      >
        Évaluer mon CV pour cette offre →
      </Button>
    </Box>
  );
}
