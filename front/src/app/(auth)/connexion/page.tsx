"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import AuthCard from "@/components/auth/AuthCard";
import AppLink from "@/components/AppLink";
import { login } from "@/lib/api";

const DEMO_EMAIL = "kofi.mensah@demo.apexai";
const DEMO_PASSWORD = "Demo1234!";

export default function ConnexionPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function handleLogin(e?: string, p?: string) {
    setError(null);
    setLoading(true);
    try {
      await login({ email: e ?? email, password: p ?? password });
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Se connecter" subtitle="Bon retour sur Apex AI.">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          label="Email"
          placeholder="nom@exemple.com"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        <TextField
          label="Mot de passe"
          type="password"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 0.5, py: 1.2, textTransform: "none", fontWeight: 700 }}
          disabled={loading}
          onClick={() => handleLogin()}
        >
          {loading ? <CircularProgress size={20} sx={{ color: "inherit" }} /> : "Se connecter"}
        </Button>

        {/* Bouton démo — accès direct sans saisie */}
        <Button
          fullWidth
          variant="outlined"
          sx={{ py: 1.1, textTransform: "none", fontWeight: 600, borderColor: "divider", color: "text.secondary" }}
          disabled={loading}
          onClick={() => handleLogin(DEMO_EMAIL, DEMO_PASSWORD)}
        >
          Accès démo (sans compte)
        </Button>

        {error ? (
          <Typography variant="body2" sx={{ color: "error.main" }}>
            {error}
          </Typography>
        ) : null}

        <Box sx={{ mt: 1.0, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Pas encore de compte ?{" "}
            <AppLink href="/inscription" underline="hover" sx={{ fontWeight: 700 }}>
              Créer un compte
            </AppLink>
          </Typography>
        </Box>
      </Box>
    </AuthCard>
  );
}
