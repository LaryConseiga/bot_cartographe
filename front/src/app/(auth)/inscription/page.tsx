 "use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import AuthCard from "@/components/auth/AuthCard";
import AppLink from "@/components/AppLink";
import { signup } from "@/lib/api";

export default function InscriptionPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <AuthCard title="Créez votre compte" subtitle="Rejoignez Apex AI pour propulser votre carrière.">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          label="Nom complet"
          placeholder="Jean Dupont"
          fullWidth
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
        <TextField
          label="Pays (optionnel)"
          placeholder="SN / CI / BF…"
          fullWidth
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <TextField
          label="Ville (optionnel)"
          placeholder="Dakar, Abidjan…"
          fullWidth
          value={city}
          onChange={(e) => setCity(e.target.value)}
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
              await signup({
                email,
                password,
                full_name: fullName || undefined,
                country: country.trim() || undefined,
                city: city.trim() || undefined,
                preferred_lang: navigator.language?.slice(0, 2) || "fr"
              });
              router.push("/chat/parametres");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur d’inscription");
            } finally {
              setLoading(false);
            }
          }}
        >
          Créer mon compte
        </Button>

        {error ? (
          <Typography variant="body2" sx={{ color: "error.main" }}>
            {error}
          </Typography>
        ) : null}

        <Box sx={{ mt: 1.0, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Déjà un compte ?{" "}
            <AppLink href="/connexion" underline="hover" sx={{ fontWeight: 700 }}>
              Se connecter
            </AppLink>
          </Typography>
        </Box>
      </Box>
    </AuthCard>
  );
}

