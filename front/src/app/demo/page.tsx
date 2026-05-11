"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

const DEMO_ACCOUNTS = [
  { email: "kofi.mensah@demo.apexai",      password: "Demo1234!", name: "Kofi Mensah" },
  { email: "aminata.diallo@demo.apexai",   password: "Demo1234!", name: "Aminata Diallo" },
  { email: "ibrahim.traore@demo.apexai",   password: "Demo1234!", name: "Ibrahim Traoré" },
  { email: "fatou.camara@demo.apexai",     password: "Demo1234!", name: "Fatou Camara" },
  { email: "moussa.coulibaly@demo.apexai", password: "Demo1234!", name: "Moussa Coulibaly" },
  { email: "test1@demo.apexai",            password: "Demo1234!", name: "Étudiant Test 1" },
  { email: "test2@demo.apexai",            password: "Demo1234!", name: "Étudiant Test 2" },
  { email: "test3@demo.apexai",            password: "Demo1234!", name: "Étudiant Test 3" },
];

const TEAL = "#10A37F";

export default function DemoPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [selected, setSelected] = React.useState<number | null>(null);

  async function handleLogin(idx: number) {
    const account = DEMO_ACCOUNTS[idx];
    setSelected(idx);
    setStatus("loading");
    setErrorMsg("");
    try {
      const { login } = await import("@/lib/api");
      await login({ email: account.email, password: account.password });
      router.push("/chat");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Erreur de connexion");
      setSelected(null);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        px: 2,
        bgcolor: "#0D1117",
      }}
    >
      <Box sx={{ textAlign: "center", mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#fff", mb: 0.5 }}>
          ApexAI — Accès démo
        </Typography>
        <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
          Clique sur un compte pour entrer directement dans l&apos;application
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.5,
          width: "100%",
          maxWidth: 520,
        }}
      >
        {DEMO_ACCOUNTS.map((acc, idx) => (
          <Button
            key={acc.email}
            variant="outlined"
            onClick={() => handleLogin(idx)}
            disabled={status === "loading"}
            sx={{
              textTransform: "none",
              borderRadius: 2,
              py: 1.5,
              px: 2,
              borderColor: selected === idx ? TEAL : "rgba(255,255,255,0.12)",
              bgcolor: selected === idx ? `${TEAL}18` : "rgba(255,255,255,0.04)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0.25,
              "&:hover": {
                borderColor: TEAL,
                bgcolor: `${TEAL}12`,
              },
            }}
          >
            {selected === idx && status === "loading" ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={14} sx={{ color: TEAL }} />
                <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 700 }}>
                  Connexion…
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 700 }}>
                  {acc.name}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 11, color: "#6B7280", lineHeight: 1 }}>
                  {acc.email}
                </Typography>
              </>
            )}
          </Button>
        ))}
      </Box>

      {errorMsg ? (
        <Typography variant="body2" sx={{ color: "#EF4444", textAlign: "center", maxWidth: 420 }}>
          {errorMsg}
        </Typography>
      ) : null}

      <Typography variant="caption" sx={{ color: "#4B5563", mt: 1 }}>
        Mot de passe commun : Demo1234!
      </Typography>
    </Box>
  );
}
