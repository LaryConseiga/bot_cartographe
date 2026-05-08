"use client";

import * as React from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { getMyProfile, updateMyProfile } from "@/lib/api";
import { toPatchFromUI, toUI, type ProfileUI } from "@/lib/profileMapping";

function parseTags(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function ParametresPage() {
  const [profile, setProfile] = React.useState<ProfileUI>(() => toUI(null));
  const [tagsInput, setTagsInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveOk, setSaveOk] = React.useState(false);

  React.useEffect(() => {
    setTagsInput(profile.tags.join(", "));
  }, [profile.tags]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = await getMyProfile();
        if (!alive) return;
        const ui = toUI(out.profile);
        setProfile(ui);
        setTagsInput(ui.tags.join(", "));
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
            <Button
              variant="outlined"
              sx={{ textTransform: "none", fontWeight: 800 }}
              onClick={() => {
                setProfile(toUI(null));
                setTagsInput("");
                setSaveOk(false);
              }}
            >
              Réinitialiser
            </Button>
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
            label="Titre & localisation"
            value={profile.headline}
            onChange={(e) => updateLocal({ headline: e.target.value })}
            helperText="Ex: Senior Product Designer • Paris, FR"
            fullWidth
          />
          <TextField
            label="Tags (séparés par des virgules)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onBlur={() => updateLocal({ tags: parseTags(tagsInput) })}
            fullWidth
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {profile.tags.map((t) => (
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Objectif de carrière
        </Typography>
        <TextField
          value={profile.careerObjective}
          onChange={(e) => updateLocal({ careerObjective: e.target.value })}
          multiline
          minRows={4}
          fullWidth
        />
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Compétences (pourcentages)
        </Typography>
        <Stack spacing={1.5}>
          {profile.skills.map((s, idx) => (
            <Box key={s.label} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 140px" }, gap: 1 }}>
              <TextField
                label="Libellé"
                value={s.label}
                onChange={(e) => {
                  const nextSkills = [...profile.skills];
                  nextSkills[idx] = { ...nextSkills[idx], label: e.target.value };
                  updateLocal({ skills: nextSkills });
                }}
                fullWidth
              />
              <TextField
                label="%"
                type="number"
                value={s.percent}
                inputProps={{ min: 0, max: 100 }}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                  const nextSkills = [...profile.skills];
                  nextSkills[idx] = { ...nextSkills[idx], percent: v };
                  updateLocal({ skills: nextSkills });
                }}
              />
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 2, opacity: 0.12 }} />

        <Button
          variant="outlined"
          sx={{ textTransform: "none", fontWeight: 800 }}
          onClick={() => updateLocal({ skills: [...profile.skills, { label: "Nouvelle compétence", percent: 50, chips: [] }] })}
        >
          Ajouter une compétence
        </Button>
      </Paper>
    </Box>
  );
}


