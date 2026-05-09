"use client";

import Image from "next/image";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ChartBarIcon, ArrowTrendingUpIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";

const FEATURES = [
  { icon: <ChartBarIcon style={{ width: 14, height: 14 }} />, label: "Analyse de CV en temps réel" },
  { icon: <ArrowTrendingUpIcon style={{ width: 14, height: 14 }} />, label: "Score de compatibilité marché" },
  { icon: <RocketLaunchIcon style={{ width: 14, height: 14 }} />, label: "Parcours personnalisé 3 horizons" },
];

export default function LandingClient() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        background:
          "radial-gradient(1200px 600px at 50% -200px, rgba(16,163,127,0.20), rgba(0,0,0,0) 60%), radial-gradient(900px 500px at 10% 110%, rgba(16,163,127,0.12), rgba(0,0,0,0) 55%)",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 680, textAlign: "center" }}>
        {/* Badge marché cible */}
        <Chip
          label="🌍 Pour les étudiants africains francophones"
          size="small"
          sx={{
            mb: 3.5,
            bgcolor: "rgba(16,163,127,0.10)",
            color: "primary.main",
            fontWeight: 700,
            fontSize: 12,
            border: "1px solid rgba(16,163,127,0.30)",
            height: 28,
            px: 0.5,
          }}
        />

        {/* Logo */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <Box
            sx={{
              width: { xs: 80, sm: 96 },
              height: { xs: 80, sm: 96 },
              borderRadius: "22px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              bgcolor: "background.paper",
              boxShadow: "0 0 48px rgba(16,163,127,0.18), 0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <Image src={LOGO_SRC} alt="ApexAI" width={96} height={96} priority />
          </Box>
        </Box>

        {/* Titre */}
        <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -2, lineHeight: 1, mb: 0.5 }}>
          ApexAI
        </Typography>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          sx={{ fontWeight: 500, letterSpacing: 0.3, mb: 2 }}
        >
          Assistant carrière IA
        </Typography>

        {/* Description */}
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 520, mx: "auto", lineHeight: 1.7, fontSize: 15 }}
        >
          Analysez votre CV, identifiez vos lacunes de compétences et obtenez un parcours d'apprentissage ancré dans la réalité du marché africain — Burkina Faso, Côte d'Ivoire, Sénégal, Mali.
        </Typography>

        {/* Feature chips */}
        <Stack direction="row" sx={{ mt: 3, gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
          {FEATURES.map((f) => (
            <Chip
              key={f.label}
              icon={f.icon}
              label={f.label}
              variant="outlined"
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: 12,
                borderColor: "rgba(255,255,255,0.14)",
                color: "text.secondary",
                "& .MuiChip-icon": { color: "primary.main" },
              }}
            />
          ))}
        </Stack>

        {/* CTA */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mt: 4.5, justifyContent: "center" }}
        >
          <Button
            component={Link}
            href="/connexion"
            variant="contained"
            size="large"
            sx={{
              textTransform: "none",
              fontWeight: 800,
              py: 1.4,
              px: 4,
              borderRadius: 999,
              fontSize: 15,
            }}
          >
            Se connecter
          </Button>
          <Button
            component={Link}
            href="/inscription"
            variant="outlined"
            size="large"
            sx={{
              textTransform: "none",
              fontWeight: 800,
              py: 1.4,
              px: 4,
              borderRadius: 999,
              fontSize: 15,
              borderColor: "rgba(255,255,255,0.20)",
              color: "text.primary",
              "&:hover": { borderColor: "primary.main", color: "primary.main" },
            }}
          >
            Créer un compte gratuit
          </Button>
        </Stack>

        {/* Marchés */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 4.5, display: "block", opacity: 0.45, letterSpacing: 1 }}
        >
          BURKINA FASO · CÔTE D'IVOIRE · SÉNÉGAL · MALI
        </Typography>
      </Box>
    </Box>
  );
}
