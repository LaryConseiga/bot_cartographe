import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { ArrowTrendingUpIcon, ArrowUpIcon } from "@heroicons/react/24/outline";

const TRENDING_SKILLS = [
  { label: "React / Vue.js",         growth: "+38%", color: "#6366F1" },
  { label: "Data Science (Python)",  growth: "+52%", color: "#10A37F" },
  { label: "DevOps / Cloud",         growth: "+44%", color: "#3B82F6" },
  { label: "Cybersécurité",          growth: "+61%", color: "#EF4444" },
  { label: "Gestion de projet",      growth: "+29%", color: "#F59E0B" },
  { label: "UX / Product Design",    growth: "+35%", color: "#EC4899" },
];

export default function TendancesMarchePage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 860, mx: "auto" }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Tendances marché
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Compétences en hausse sur les marchés d'Afrique de l'Ouest — données indicatives.
        </Typography>
      </Box>

      {/* Trending skills */}
      <Paper elevation={0} sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
          Compétences les plus demandées
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.5,
          }}
        >
          {TRENDING_SKILLS.map((s) => (
            <Box
              key={s.label}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 1.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "rgba(255,255,255,0.02)",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13.5 }}>
                {s.label}
              </Typography>
              <Chip
                icon={<ArrowUpIcon style={{ width: 12, height: 12, color: s.color }} />}
                label={s.growth}
                size="small"
                sx={{
                  bgcolor: `${s.color}18`,
                  color: s.color,
                  fontWeight: 700,
                  fontSize: 11.5,
                  border: `1px solid ${s.color}30`,
                  "& .MuiChip-icon": { color: s.color },
                }}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Empty state */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "rgba(255,255,255,0.02)",
          borderStyle: "dashed",
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "14px",
            bgcolor: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowTrendingUpIcon style={{ width: 24, height: 24, color: "#F59E0B" }} />
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Données marché en temps réel à venir
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          Les données salariales locales et les tendances de recrutement par pays (BF, CI, SN, ML) seront disponibles prochainement.
        </Typography>
      </Paper>
    </Box>
  );
}
