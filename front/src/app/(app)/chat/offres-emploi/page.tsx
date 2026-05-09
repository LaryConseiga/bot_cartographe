import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { BriefcaseIcon, MapPinIcon } from "@heroicons/react/24/outline";

const MARKETS = ["Dakar", "Abidjan", "Ouagadougou", "Bamako"];

export default function OffresEmploiPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 860, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Offres d'emploi
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Opportunités scrappées en temps réel sur les marchés d'Afrique de l'Ouest.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {MARKETS.map((m) => (
            <Chip
              key={m}
              icon={<MapPinIcon style={{ width: 13, height: 13 }} />}
              label={m}
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                "& .MuiChip-icon": { color: "inherit" },
                "&:hover": { borderColor: "primary.main", color: "primary.main" },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Skeleton cards */}
      {[1, 2, 3].map((i) => (
        <Paper key={i} elevation={0} sx={{ p: 2.5, display: "flex", gap: 2 }}>
          <Skeleton variant="rounded" width={44} height={44} sx={{ flexShrink: 0, borderRadius: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="45%" height={20} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Skeleton variant="rounded" width={70} height={22} sx={{ borderRadius: 4 }} />
              <Skeleton variant="rounded" width={90} height={22} sx={{ borderRadius: 4 }} />
            </Box>
          </Box>
        </Paper>
      ))}

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
            bgcolor: "rgba(99,102,241,0.10)",
            border: "1px solid rgba(99,102,241,0.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BriefcaseIcon style={{ width: 24, height: 24, color: "#6366F1" }} />
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Scraping des offres en cours de déploiement
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          Les offres d'emploi scrappées depuis les plateformes locales d'Afrique de l'Ouest apparaîtront ici, filtrées selon votre profil.
        </Typography>
      </Paper>
    </Box>
  );
}
