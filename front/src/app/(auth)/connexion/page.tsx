 "use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import AuthCard from "@/components/auth/AuthCard";
import AppLink from "@/components/AppLink";
import { login } from "@/lib/api";

export default function ConnexionPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

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
        />
        <TextField
          label="Mot de passe"
          type="password"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 0.5, py: 1.2, textTransform: "none", fontWeight: 700 }}
          disabled={loading}
          onClick={async () => {
            setError(null);
            setLoading(true);
            try {
              await login({ email, password });
              router.push("/chat");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur de connexion");
            } finally {
              setLoading(false);
            }
          }}
        >
          Se connecter
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

