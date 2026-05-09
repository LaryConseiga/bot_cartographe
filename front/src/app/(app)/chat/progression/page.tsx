"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  BoltIcon,
  RocketLaunchIcon,
  SparklesIcon,
  ClockIcon,
  TagIcon,
  LockClosedIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

const TEAL = "#10A37F";
const PURPLE = "#6366F1";
const ORANGE = "#F59E0B";

/** Stockage local : à remplir plus tard quand le chat ou le back renverra un JSON structuré. */
const ROADMAP_STORAGE_KEY = "apex_ai_roadmap_v1";

export type AiRoadmapCourseItem = {
  badge: string;
  badgeColor: string;
  title: string;
  duration: string;
  costLabel: string;
  checked?: boolean;
  progressPct?: number | null;
  locked?: boolean;
  highlightRight?: boolean;
  heroImage?: boolean;
  heroSubtitle?: string;
};

export type AiRoadmapColumn = {
  key: "quick_wins" | "core" | "long_term";
  title: string;
  icon: "bolt" | "target" | "rocket";
  accent: string;
  items: AiRoadmapCourseItem[];
};

export type AiRoadmapV1 = {
  version: 1;
  /** `preview` = démo UI ; `stored` = issu du stockage (futur JSON IA) */
  source: "preview" | "stored";
  generatedAt: string;
  targetRole: string;
  profileBasis: string;
  prepIndexPct: number;
  totalHoursRecommended: number;
  columns: AiRoadmapColumn[];
};

const ROADMAP_CHAT_PROMPT =
  "Propose-moi une roadmap de formation structurée en trois niveaux (quick wins, compétences cœur, long terme) : pour chaque étape, indique plateforme ou ressource, durée estimée, coût approximatif, et un ordre logique. Base-toi sur mon profil et nos échanges. Réponds de façon claire pour que je puisse suivre le plan étape par étape.";

/** Jeu de démonstration — même rendu visuel, présenté comme aperçu jusqu'à génération réelle. */
const PREVIEW_ROADMAP: AiRoadmapV1 = {
  version: 1,
  source: "preview",
  generatedAt: new Date().toISOString(),
  targetRole: "Data Scientist senior",
  profileBasis: "Basé sur ton profil actuel (analyste)",
  prepIndexPct: 68,
  totalHoursRecommended: 140,
  columns: [
    {
      key: "quick_wins",
      title: "Quick Wins",
      icon: "bolt",
      accent: TEAL,
      items: [
        {
          badge: "KAGGLE",
          badgeColor: TEAL,
          title: "SQL — fonctions fenêtre",
          duration: "3 h",
          costLabel: "Gratuit",
          checked: true,
        },
        {
          badge: "COURSERA",
          badgeColor: PURPLE,
          title: "Python pour la data",
          duration: "6 h",
          costLabel: "Gratuit",
        },
      ],
    },
    {
      key: "core",
      title: "Core Skills",
      icon: "target",
      accent: PURPLE,
      items: [
        {
          badge: "COURSERA",
          badgeColor: PURPLE,
          title: "Machine Learning — spécialisation",
          duration: "40 h",
          costLabel: "Payant",
          progressPct: 15,
          locked: true,
        },
        {
          badge: "KAGGLE",
          badgeColor: TEAL,
          title: "Feature engineering avancé",
          duration: "8 h",
          costLabel: "Gratuit",
          highlightRight: true,
        },
      ],
    },
    {
      key: "long_term",
      title: "Long Term",
      icon: "rocket",
      accent: ORANGE,
      items: [
        {
          badge: "COURSERA",
          badgeColor: ORANGE,
          title: "Google Cloud Professional Data Engineer",
          duration: "80 h",
          costLabel: "Payant",
          heroImage: true,
          heroSubtitle: "Certification cloud & pipelines",
        },
      ],
    },
  ],
};

function parseStoredRoadmap(raw: string | null): AiRoadmapV1 | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (o.version !== 1 || o.source !== "stored") return null;
    if (typeof o.targetRole !== "string" || !Array.isArray(o.columns)) return null;
    return data as AiRoadmapV1;
  } catch {
    return null;
  }
}

function formatGeneratedLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

type CourseCardProps = AiRoadmapCourseItem;

function CourseCard({
  badge,
  badgeColor,
  title,
  duration,
  costLabel,
  checked = false,
  progressPct = null,
  locked = false,
  highlightRight = false,
  heroImage = false,
  heroSubtitle,
}: CourseCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (heroImage) {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            height: 120,
            background: isDark
              ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0c4a6e 100%)"
              : "linear-gradient(135deg, #e0f2fe 0%, #ddd6fe 50%, #ccfbf1 100%)",
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            p: 1.5,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.35,
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
            }}
          />
          <Typography variant="caption" sx={{ position: "relative", fontWeight: 700, color: isDark ? "#e5e7eb" : "#111827" }}>
            {heroSubtitle}
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Chip
            label={badge}
            size="small"
            sx={{
              height: 22,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              bgcolor: `${badgeColor}22`,
              color: badgeColor,
              border: `1px solid ${badgeColor}44`,
              mb: 1,
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.4 }}>
            {title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1.25, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, opacity: 0.8 }}>
              <ClockIcon style={{ width: 14, height: 14 }} />
              <Typography variant="caption" color="text.secondary">
                {duration}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, opacity: 0.8 }}>
              <TagIcon style={{ width: 14, height: 14 }} />
              <Typography variant="caption" color="text.secondary">
                {costLabel}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: highlightRight ? `${TEAL}55` : "divider",
        borderRight: highlightRight ? `4px solid ${TEAL}` : undefined,
        bgcolor: "background.paper",
        position: "relative",
        transition: "box-shadow 0.2s, border-color 0.2s",
        "&:hover": { boxShadow: "0 8px 28px rgba(0,0,0,0.12)" },
      }}
    >
      <Box sx={{ position: "absolute", top: 10, right: 8 }}>
        <Checkbox
          size="small"
          checked={checked}
          onChange={() => {}}
          slotProps={{ input: { "aria-label": "Terminé" } }}
          sx={{
            p: 0.25,
            color: "rgba(255,255,255,0.25)",
            "&.Mui-checked": { color: TEAL },
          }}
        />
      </Box>
      <Chip
        label={badge}
        size="small"
        sx={{
          height: 22,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.5,
          bgcolor: `${badgeColor}22`,
          color: badgeColor,
          border: `1px solid ${badgeColor}44`,
          mb: 1,
          mr: 4,
        }}
      />
      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.45, pr: 3 }}>
        {title}
      </Typography>

      {progressPct !== null && progressPct !== undefined && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Progression
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {locked ? <LockClosedIcon style={{ width: 14, height: 14, opacity: 0.6 }} /> : null}
              <Typography variant="caption" sx={{ fontWeight: 800, color: TEAL }}>
                {progressPct}%
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,0.08)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${TEAL}, ${PURPLE})`,
              },
            }}
          />
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: progressPct != null ? 1.25 : 1.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, opacity: 0.85 }}>
          <ClockIcon style={{ width: 14, height: 14 }} />
          <Typography variant="caption" color="text.secondary">
            {duration}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, opacity: 0.85 }}>
          <TagIcon style={{ width: 14, height: 14 }} />
          <Typography variant="caption" color="text.secondary">
            {costLabel}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

function ColumnHeader({
  icon,
  title,
  count,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ color, display: "flex", alignItems: "center" }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: 0.3, fontSize: 13.5 }}>
          {title}
        </Typography>
      </Box>
      <Chip
        label={`${count} COURS`}
        size="small"
        sx={{
          height: 24,
          fontSize: 10,
          fontWeight: 800,
          bgcolor: `${color}18`,
          color,
          border: `1px solid ${color}35`,
        }}
      />
    </Box>
  );
}

function columnIcon(kind: AiRoadmapColumn["icon"], color: string) {
  if (kind === "bolt") return <BoltIcon style={{ width: 20, height: 20 }} />;
  if (kind === "rocket") return <RocketLaunchIcon style={{ width: 20, height: 20 }} />;
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
    </Box>
  );
}

export default function ProgressionPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();

  const [roadmap, setRoadmap] = React.useState<AiRoadmapV1 | null>(null);

  React.useEffect(() => {
    const stored = parseStoredRoadmap(typeof window !== "undefined" ? localStorage.getItem(ROADMAP_STORAGE_KEY) : null);
    setRoadmap(stored ?? PREVIEW_ROADMAP);
  }, []);

  const active = roadmap ?? PREVIEW_ROADMAP;
  const isPreview = active.source === "preview";
  const generatedLabel = formatGeneratedLabel(active.generatedAt);

  async function openChatForRoadmap() {
    try {
      const { createMyChat } = await import("@/lib/api");
      const out = await createMyChat();
      sessionStorage.setItem(`apex_init_msg_${out.chat.id}`, ROADMAP_CHAT_PROMPT);
      router.push(`/chat/c/${out.chat.id}`);
    } catch {
      router.push("/chat");
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", pb: 4 }}>
      {/* Contexte IA : génération, pas une configuration statique */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: isDark ? "rgba(16,163,127,0.25)" : "rgba(16,163,127,0.35)",
          background: isDark ? "rgba(16,163,127,0.06)" : "rgba(16,163,127,0.08)",
        }}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 1.25, minWidth: 0, flex: "1 1 240px" }}>
            <SparklesIcon style={{ width: 22, height: 22, color: TEAL, flexShrink: 0, marginTop: 2 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                Roadmap générée par l&apos;IA
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.55 }}>
                Ce plan est une proposition automatique à partir de ton profil, de ton CV et de la conversation avec
                l&apos;assistant. Il évolue quand tu demandes une mise à jour dans le chat — la mise en page ci-dessous
                sert de base pour afficher la version structurée une fois le JSON relié au modèle.
              </Typography>
              {isPreview ? (
                <Chip
                  label="Aperçu interface (données de démonstration)"
                  size="small"
                  sx={{ mt: 1.25, fontWeight: 700, fontSize: 10, height: 24, bgcolor: `${PURPLE}22`, color: PURPLE }}
                />
              ) : generatedLabel ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Dernière synthèse affichée : {generatedLabel}
                </Typography>
              ) : null}
            </Box>
          </Box>
          <Button
            variant="contained"
            size="medium"
            onClick={openChatForRoadmap}
            startIcon={<ChatBubbleLeftRightIcon style={{ width: 18, height: 18 }} />}
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              textTransform: "none",
              boxShadow: "none",
              bgcolor: TEAL,
              "&:hover": { bgcolor: "#0d8f6a", boxShadow: "none" },
            }}
          >
            {isPreview ? "Générer ma roadmap dans le chat" : "Mettre à jour via le chat"}
          </Button>
        </Box>
      </Paper>

      {/* Titre + badge suivi (complémentaire au bandeau IA) */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.35 }}>
          Plan de formation
        </Typography>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            border: `1px solid ${TEAL}44`,
            bgcolor: isDark ? "rgba(16,163,127,0.12)" : "rgba(16,163,127,0.14)",
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: TEAL,
              boxShadow: `0 0 10px ${TEAL}`,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 10.5, letterSpacing: 0.6, color: TEAL }}>
            SUIVI RECOMMANDÉ
          </Typography>
        </Box>
      </Box>

      {/* Résumé : 3 cartes (champs alignés sur ce que l'IA pourra remplir) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 1.75,
          mb: 3.5,
        }}
      >
        <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, bgcolor: "background.paper" }}>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 1, color: "text.secondary", fontSize: 10 }}>
            CIBLE PROFESSIONNELLE
          </Typography>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mt: 1 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.25 }}>
                {active.targetRole}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: 13 }}>
                {active.profileBasis}
              </Typography>
            </Box>
            <SparklesIcon style={{ width: 22, height: 22, color: PURPLE, opacity: 0.9, flexShrink: 0 }} />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, bgcolor: "background.paper" }}>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 1, color: "text.secondary", fontSize: 10 }}>
            PRÉPARATION
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mt: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18 }}>
              {active.prepIndexPct}%
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Index de préparation (estimé par l&apos;IA)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={active.prepIndexPct}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "rgba(255,255,255,0.08)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                background: `linear-gradient(90deg, ${TEAL} 0%, ${PURPLE} 100%)`,
              },
            }}
          />
        </Paper>

        <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, bgcolor: "background.paper" }}>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 1, color: "text.secondary", fontSize: 10 }}>
            ESTIMATION TEMPS
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 22, color: ORANGE, mt: 1 }}>
            {active.totalHoursRecommended} h
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: 13 }}>
            Temps total d&apos;apprentissage recommandé (ordre de grandeur)
          </Typography>
        </Paper>
      </Box>

      {/* Colonnes pilotées par le modèle de données IA */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        {active.columns.map((col) => (
          <Box key={col.key}>
            <ColumnHeader
              icon={columnIcon(col.icon, col.accent)}
              title={col.title}
              count={col.items.length}
              color={col.accent}
            />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {col.items.map((item, idx) => (
                <CourseCard key={`${col.key}-${idx}`} {...item} />
              ))}
              {col.key === "long_term" ? (
                <Paper
                  elevation={0}
                  onClick={openChatForRoadmap}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void openChatForRoadmap();
                    }
                  }}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: "2px dashed",
                    borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(17,24,39,0.18)",
                    bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(17,24,39,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    minHeight: 100,
                    cursor: "pointer",
                    transition: "border-color 0.2s, background 0.2s",
                    "&:hover": {
                      borderColor: `${TEAL}55`,
                      bgcolor: isDark ? "rgba(16,163,127,0.06)" : "rgba(16,163,127,0.06)",
                    },
                  }}
                >
                  <PlusIcon style={{ width: 22, height: 22, opacity: 0.55 }} />
                  <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.8, fontSize: 11, opacity: 0.75, textAlign: "center" }}>
                    DEMANDER UN OBJECTIF À L&apos;IA
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textAlign: "center", maxWidth: 220 }}>
                    Ouvre le chat avec un message prêt à l&apos;emploi pour enrichir ta roadmap.
                  </Typography>
                </Paper>
              ) : null}
            </Box>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3, lineHeight: 1.65, maxWidth: 760 }}>
        Les parcours, durées et coûts sont indicatifs : vérifie auprès des plateformes et adapte selon ta situation.
        L&apos;assistant peut se tromper ou omettre des contraintes locales — croise toujours avec des sources officielles.
      </Typography>
    </Box>
  );
}
