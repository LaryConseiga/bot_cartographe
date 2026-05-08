"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";

export default function AuthCard(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 6,
        background:
          "radial-gradient(1200px 600px at 50% -200px, rgba(16,163,127,0.18), rgba(0,0,0,0) 60%), radial-gradient(900px 500px at 10% 110%, rgba(16,163,127,0.10), rgba(0,0,0,0) 55%)",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 440,
          p: 3,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, pt: 0.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <Image src={LOGO_SRC} alt="Apex AI" width={40} height={40} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {props.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            {props.subtitle}
          </Typography>
        </Box>

        <Divider sx={{ my: 2.25 }} />

        {props.children}

        <Box sx={{ mt: 2.25 }}>{props.footer}</Box>

        <Box sx={{ mt: 2.25, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">
            En créant un compte, vous acceptez nos{" "}
            <MuiLink component={Link} href="#" underline="hover">
              Conditions d’utilisation
            </MuiLink>{" "}
            et notre{" "}
            <MuiLink component={Link} href="#" underline="hover">
              Politique de confidentialité
            </MuiLink>
            .
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

