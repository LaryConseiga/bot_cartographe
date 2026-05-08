"use client";

import Image from "next/image";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";

export default function LandingClient() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        background:
          "radial-gradient(1200px 600px at 50% -200px, rgba(16,163,127,0.18), rgba(0,0,0,0) 60%), radial-gradient(900px 500px at 10% 110%, rgba(16,163,127,0.10), rgba(0,0,0,0) 55%)",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 720, textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Box
            sx={{
              width: { xs: 110, sm: 130 },
              height: { xs: 110, sm: 130 },
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              bgcolor: "background.paper",
            }}
          >
            <Image src={LOGO_SRC} alt="ApexAI" width={130} height={130} priority />
          </Box>
        </Box>

        <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: -0.8 }}>
          ApexAI
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 520, mx: "auto" }}>
          Bienvenue. Créez votre compte ou connectez‑vous pour accéder à votre assistant carrière et au chat.
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mt: 4, justifyContent: "center" }}
        >
          <Button
            component={Link}
            href="/connexion"
            variant="contained"
            sx={{ textTransform: "none", fontWeight: 800, py: 1.2, px: 3 }}
          >
            Se connecter
          </Button>
          <Button
            component={Link}
            href="/inscription"
            variant="outlined"
            sx={{ textTransform: "none", fontWeight: 800, py: 1.2, px: 3 }}
          >
            Créer un compte
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

