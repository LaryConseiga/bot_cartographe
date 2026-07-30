"use client";

import * as React from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { getMyProfile, updateMyProfile } from "@/lib/api";
import { toPatchFromUI, toUI, type ProfileUI } from "@/lib/profileMapping";

export default function ParametresPage() {
  const [profile, setProfile] = React.useState<ProfileUI>(() => toUI(null));
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveOk, setSaveOk] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = await getMyProfile();
        if (!alive) return;
        setProfile(toUI(out.profile));
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Erreur profil");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const updateLocal = (patch: Partial<ProfileUI>) => {
    setSaveOk(false);
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  const save = async () => {
    setSaving(true);
    setSaveOk(false);
    try {
      await updateMyProfile(toPatchFromUI(profile));
      setError(null);
      setSaveOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="body2" color="text.secondary">
          Chargement des paramètres…
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Paramètres
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Modifiez votre profil. Les changements s’affichent sur{" "}
              <Button component={Link} href="/chat/profil" variant="text" sx={{ textTransform: "none", fontWeight: 800, p: 0, minWidth: 0 }}>
                la page Profil
              </Button>
              .
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button component={Link} href="/chat/profil" variant="contained" sx={{ textTransform: "none", fontWeight: 800 }}>
              Voir le profil
            </Button>
            <Button
              variant="contained"
              color={saveOk ? "success" : "primary"}
              disabled={saving}
              sx={{ textTransform: "none", fontWeight: 800 }}
              onClick={save}
            >
              {saving ? "Enregistrement…" : saveOk ? "Enregistré" : "Enregistrer"}
            </Button>
          </Stack>
        </Stack>
        {error ? (
          <Typography variant="body2" sx={{ color: "error.main", mt: 1 }}>
            {error}
          </Typography>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Identité
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Nom complet"
            value={profile.fullName}
            onChange={(e) => updateLocal({ fullName: e.target.value })}
            fullWidth
          />
          <TextField
            label="Email"
            value={profile.email}
            onChange={(e) => updateLocal({ email: e.target.value })}
            fullWidth
          />
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
          Coordonnées
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
          Utilisées pour générer ton CV et tes lettres de motivation — les renseigner ici évite qu&apos;Apex te les redemande à chaque candidature.
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Téléphone"
            value={profile.phone}
            onChange={(e) => updateLocal({ phone: e.target.value })}
            placeholder="+226 70 00 00 00"
            fullWidth
          />
          <TextField
            label="LinkedIn"
            value={profile.linkedin}
            onChange={(e) => updateLocal({ linkedin: e.target.value })}
            placeholder="linkedin.com/in/ton-profil"
            fullWidth
          />
          <TextField
            label="Portfolio / site personnel"
            value={profile.portfolio}
            onChange={(e) => updateLocal({ portfolio: e.target.value })}
            placeholder="ton-site.com"
            fullWidth
          />
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Objectif de carrière
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Rôle ciblé"
            value={profile.targetRole}
            onChange={(e) => updateLocal({ targetRole: e.target.value })}
            placeholder="Ex : Data Analyst"
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Secteur ciblé"
              value={profile.targetSector}
              onChange={(e) => updateLocal({ targetSector: e.target.value })}
              fullWidth
            />
            <TextField
              label="Pays ciblé"
              value={profile.targetCountry}
              onChange={(e) => updateLocal({ targetCountry: e.target.value })}
              fullWidth
            />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
