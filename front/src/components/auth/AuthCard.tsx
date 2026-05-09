"use client";

import Image from "next/image";
import React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";

export default function AuthCard(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
          p: { xs: 2.5, sm: 3.5 },
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, rgba(16,163,127,0) 0%, rgba(16,163,127,0.8) 50%, rgba(16,163,127,0) 100%)",
          },
        }}
      >
        {/* Logo + titre */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, pt: 1 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 0 20px rgba(16,163,127,0.15)",
            }}
          >
            <Image src={LOGO_SRC} alt="Apex AI" width={44} height={44} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            {props.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", lineHeight: 1.5 }}>
            {props.subtitle}
          </Typography>
        </Box>

        <Divider sx={{ my: 2.5, opacity: 0.6 }} />

        {props.children}

        {props.footer ? <Box sx={{ mt: 2.5 }}>{props.footer}</Box> : null}

        <Box sx={{ mt: 2.5, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
            En utilisant ApexAI, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
