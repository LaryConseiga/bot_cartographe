import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { PresentationChartLineIcon, LockClosedIcon } from "@heroicons/react/24/outline";

const SKILLS_PREVIEW = [
  { label: "JavaScript", pct: 72, color: "#F59E0B" },
  { label: "SQL", pct: 55, color: "#6366F1" },
  { label: "Python", pct: 40, color: "#3B82F6" },
  { label: "Communication", pct: 85, color: "#10A37F" },
];

export default function ProgressionPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 760, mx: "auto" }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Ma progression
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Suivez l'évolution de vos compétences et votre avancement vers vos objectifs de carrière.
        </Typography>
      </Box>

      {/* Aperçu compétences */}
      <Paper elevation={0} sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
          Compétences clés
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SKILLS_PREVIEW.map((s) => (
            <Box key={s.label}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13.5 }}>
                  {s.label}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: s.color }}>
                  {s.pct}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={s.pct}
                sx={{
                  height: 6,
                  borderRadius: 4,
                  bgcolor: "rgba(255,255,255,0.06)",
                  "& .MuiLinearProgress-bar": { bgcolor: s.color, borderRadius: 4 },
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
            bgcolor: "rgba(16,163,127,0.10)",
            border: "1px solid rgba(16,163,127,0.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PresentationChartLineIcon style={{ width: 24, height: 24, color: "#10A37F" }} />
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Suivi de progression à venir
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
          Analysez votre CV et commencez des conversations pour débloquer votre tableau de bord de progression personnalisé.
        </Typography>
        <Chip
          icon={<LockClosedIcon style={{ width: 13, height: 13 }} />}
          label="Disponible après analyse CV"
          size="small"
          sx={{ bgcolor: "rgba(255,255,255,0.05)", fontWeight: 600, fontSize: 12 }}
        />
      </Paper>
    </Box>
  );
}
