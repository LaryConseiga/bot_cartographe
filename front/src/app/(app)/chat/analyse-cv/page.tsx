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
import Typography from "@mui/material/Typography";
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  XMarkIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

const TEAL = "#10A37F";
const ORANGE = "#F59E0B";
const RED = "#EF4444";

type Step = "upload" | "analyzing" | "quiz" | "results";

type SkillRow = { name: string; source: string };

const LEVEL_OPTIONS = [
  { label: "Débutant", score: 25 },
  { label: "Intermédiaire", score: 58 },
  { label: "Avancé", score: 82 },
  { label: "Expert", score: 100 },
] as const;

function getBadge(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "MAÎTRISÉ", color: TEAL };
  if (score >= 50) return { label: "PARTIEL", color: ORANGE };
  return { label: "MANQUANT", color: RED };
}

function SkillResultRow({ name, score }: { name: string; score: number }) {
  const badge = getBadge(score);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 2 },
        py: 1.75,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        "&:last-child": { borderBottom: "none" },
        flexWrap: { xs: "wrap", sm: "nowrap" },
      }}
    >
      {/* Skill name + badge */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { sm: 220 }, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 14 }}>
          {name}
        </Typography>
        <Chip
          label={badge.label}
          size="small"
          sx={{
            height: 20,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.5,
            bgcolor: `${badge.color}22`,
            color: badge.color,
            border: `1px solid ${badge.color}55`,
          }}
        />
      </Box>

      {/* Progress bar */}
      <Box sx={{ flex: 1, minWidth: 80 }}>
        <LinearProgress
          variant="determinate"
          value={score}
          sx={{
            height: 7,
            borderRadius: 4,
            bgcolor: "rgba(255,255,255,0.08)",
            "& .MuiLinearProgress-bar": {
              borderRadius: 4,
              bgcolor: badge.color,
            },
          }}
        />
      </Box>

      {/* % match */}
      <Typography
        variant="body2"
        sx={{ fontWeight: 800, fontSize: 13, color: badge.color, flexShrink: 0, minWidth: 72, textAlign: "right" }}
      >
        {score}% Match
      </Typography>
    </Box>
  );
}

export default function AnalyseCvPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("upload");
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = React.useState("");
  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [ratings, setRatings] = React.useState<Record<string, number>>({});
  const [targetRole, setTargetRole] = React.useState("votre profil cible");

  function handleFile(f: File) {
    setFile(f);
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setStep("analyzing");
    setError(null);
    setAnalysisProgress("Extraction du texte…");

    try {
      const { uploadCvPdf, getMyProfile, getMySkills, analyzeCvWithLlm } = await import("@/lib/api");

      // 1. Upload + extract text
      const { cvText } = await uploadCvPdf(file);
      setAnalysisProgress("Apex analyse tes compétences…");

      // 2. Fetch target role from profile
      try {
        const { profile } = await getMyProfile();
        if (profile?.target_role) setTargetRole(profile.target_role);
      } catch { /* ignore */ }

      // 3. Call LLM to extract + save skills (apex_cv_analyzer)
      await analyzeCvWithLlm(cvText);
      setAnalysisProgress("Préparation du quiz…");

      // 4. Fetch saved skills
      const { skills: savedSkills } = await getMySkills();

      // Deduplicate, hard skills first, max 10
      const seen = new Set<string>();
      const hard = savedSkills.filter(s => s.source !== "cv_soft" && s.skill && !seen.has(s.skill.toLowerCase()) && !!seen.add(s.skill.toLowerCase()));
      const soft = savedSkills.filter(s => s.source === "cv_soft" && s.skill && !seen.has(s.skill.toLowerCase()) && !!seen.add(s.skill.toLowerCase()));
      const merged = [...hard.slice(0, 7), ...soft.slice(0, 3)].slice(0, 10);

      if (merged.length === 0) {
        setError("Aucune compétence n'a pu être extraite. Essaie avec un CV plus détaillé.");
        setStep("upload");
        return;
      }

      setSkills(merged.map(s => ({ name: s.skill, source: s.source })));
      setStep("quiz");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'analyse.");
      setStep("upload");
    }
  }

  function handleQuizSubmit() {
    setStep("results");
  }

  async function handleGeneratePlan() {
    try {
      const { createMyChat } = await import("@/lib/api");
      const out = await createMyChat();
      sessionStorage.setItem(
        `apex_init_msg_${out.chat.id}`,
        "Salut ! Je viens de faire mon auto-évaluation de compétences. Génère-moi une roadmap de formation personnalisée."
      );
      sessionStorage.setItem(`apex_chat_skill_${out.chat.id}`, "apex_progression");
      router.push(`/chat/c/${out.chat.id}`);
    } catch {
      router.push("/chat");
    }
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────────
  if (step === "results") {
    const rows = skills.map(s => ({
      name: s.name,
      score: ratings[s.name] ?? 25,
    }));
    const gapped = rows.filter(r => r.score < 80).sort((a, b) => a.score - b.score);
    const display = gapped.length > 0 ? gapped : rows;

    return (
      <Box sx={{ maxWidth: 760, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Analyse de CV
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: 3,
            bgcolor: "#0D1117",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Typography variant="body2" sx={{ fontSize: 14, lineHeight: 1.65, mb: 3, color: "#E5E7EB" }}>
            J&apos;ai analysé ton CV par rapport aux standards{" "}
            <strong style={{ color: "#fff" }}>{targetRole}</strong>.{" "}
            Voici les lacunes prioritaires identifiées pour maximiser ton employabilité :
          </Typography>

          <Box>
            {display.map((r) => (
              <SkillResultRow key={r.name} name={r.name} score={r.score} />
            ))}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
            <Button
              variant="text"
              endIcon={<ArrowRightIcon style={{ width: 16, height: 16 }} />}
              onClick={handleGeneratePlan}
              sx={{
                textTransform: "none",
                fontWeight: 800,
                fontSize: 14,
                color: TEAL,
                "&:hover": { bgcolor: `${TEAL}12` },
              }}
            >
              Générer un plan de formation
            </Button>
          </Box>
        </Paper>

        <Button
          variant="outlined"
          size="small"
          onClick={() => { setStep("upload"); setFile(null); setSkills([]); setRatings({}); }}
          sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700, borderColor: "divider", color: "text.secondary" }}
        >
          ← Analyser un autre CV
        </Button>
      </Box>
    );
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────────
  if (step === "quiz") {
    const allRated = skills.every(s => ratings[s.name] !== undefined);

    return (
      <Box sx={{ maxWidth: 760, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Auto-évaluation rapide
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pour chaque compétence identifiée dans ton CV, coche ton niveau actuel — ça prend 1 à 2 minutes.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {skills.map((sk, idx) => {
              const selected = ratings[sk.name];
              const isSoft = sk.source === "cv_soft";
              return (
                <Box
                  key={sk.name}
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    flexDirection: { xs: "column", sm: "row" },
                    gap: { xs: 1, sm: 2 },
                    py: 2,
                    borderBottom: idx < skills.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { sm: 200 }, flex: { sm: "0 0 auto" } }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 14 }}>
                      {sk.name}
                    </Typography>
                    {isSoft ? (
                      <Chip label="soft" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 700, opacity: 0.6 }} />
                    ) : null}
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    {LEVEL_OPTIONS.map((opt) => {
                      const isSelected = selected === opt.score;
                      return (
                        <Chip
                          key={opt.label}
                          label={opt.label}
                          size="small"
                          onClick={() => setRatings(prev => ({ ...prev, [sk.name]: opt.score }))}
                          sx={{
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: isSelected ? 800 : 500,
                            height: 28,
                            bgcolor: isSelected ? `${TEAL}22` : "transparent",
                            color: isSelected ? TEAL : "text.secondary",
                            border: `1px solid ${isSelected ? TEAL : "rgba(255,255,255,0.15)"}`,
                            "&:hover": { bgcolor: `${TEAL}12`, borderColor: TEAL, color: TEAL },
                            transition: "all 0.15s",
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Button
          variant="contained"
          size="large"
          disabled={!allRated}
          onClick={handleQuizSubmit}
          sx={{
            alignSelf: "flex-start",
            textTransform: "none",
            fontWeight: 800,
            borderRadius: 2.5,
            px: 4,
            bgcolor: TEAL,
            "&:hover": { bgcolor: "#0d8f6a" },
            "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "text.disabled" },
            boxShadow: "none",
          }}
        >
          Voir mes résultats →
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
          {allRated ? "Tout est coché — tu peux valider !" : `${skills.filter(s => ratings[s.name] !== undefined).length} / ${skills.length} compétences évaluées`}
        </Typography>
      </Box>
    );
  }

  // ── ANALYZING ────────────────────────────────────────────────────────────────
  if (step === "analyzing") {
    return (
      <Box sx={{ maxWidth: 760, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Analyse de CV</Typography>
        </Box>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", alignItems: "center", gap: 2.5, minHeight: 200, justifyContent: "center" }}>
          <CircularProgress size={44} sx={{ color: TEAL }} />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Apex analyse ton CV…
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
              {analysisProgress || "Traitement en cours…"}
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  // ── UPLOAD ───────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 760, mx: "auto" }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Analyse de CV</Typography>
        <Typography variant="body2" color="text.secondary">
          Importez votre CV pour obtenir un score de compatibilité et un plan d&apos;amélioration personnalisé.
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      ) : null}

      <Paper
        elevation={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) handleFile(dropped);
        }}
        sx={{
          p: { xs: 4, sm: 6 },
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: dragging ? "primary.main" : file ? "primary.main" : "divider",
          bgcolor: dragging ? "rgba(16,163,127,0.06)" : file ? "rgba(16,163,127,0.04)" : "background.paper",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s, background-color 0.2s",
          "&:hover": { borderColor: "primary.main", bgcolor: "rgba(16,163,127,0.04)" },
        }}
        onClick={() => { (document.getElementById("cv-upload-analyse") as HTMLInputElement)?.click(); }}
      >
        <input
          id="cv-upload-analyse"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <CheckCircleIcon style={{ width: 44, height: 44, color: TEAL }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DocumentTextIcon style={{ width: 18, height: 18, color: "#9CA3AF" }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{file.name}</Typography>
            </Box>
            <Chip
              icon={<XMarkIcon style={{ width: 13, height: 13 }} />}
              label="Changer de fichier"
              size="small"
              variant="outlined"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              sx={{ fontSize: 12, cursor: "pointer" }}
            />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "16px", bgcolor: "rgba(16,163,127,0.10)", border: "1px solid rgba(16,163,127,0.20)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowUpTrayIcon style={{ width: 26, height: 26, color: TEAL }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Glissez-déposez votre CV ici</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>ou cliquez pour parcourir vos fichiers</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
              PDF, image (JPG, PNG) ou texte — max 5 Mo
            </Typography>
          </Box>
        )}
      </Paper>

      {file ? (
        <Button
          variant="contained"
          size="large"
          onClick={handleAnalyze}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, alignSelf: "flex-start", px: 4, bgcolor: TEAL, "&:hover": { bgcolor: "#0d8f6a" }, boxShadow: "none" }}
        >
          Analyser avec ApexAI →
        </Button>
      ) : null}
    </Box>
  );
}
