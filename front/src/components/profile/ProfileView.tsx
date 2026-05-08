"use client";

import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { getMyProfile } from "@/lib/api";
import { toUI, type ProfileUI } from "@/lib/profileMapping";

export default function ProfileView(props: { showEditHint?: boolean }) {
  const [data, setData] = React.useState<ProfileUI>(() => toUI(null));
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = await getMyProfile();
        if (!alive) return;
        setData(toUI(out.profile));
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

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="body2" color="text.secondary">
          Chargement du profil…
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="body2" sx={{ color: "error.main" }}>
          {error}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar sx={{ width: 54, height: 54, bgcolor: "rgba(255,255,255,0.10)" }}>JD</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {data.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {data.headline}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>
              {data.tags.map((t) => (
                <Chip key={t} label={t} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Objectif de carrière
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {data.careerObjective}
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Documents & CV
          </Typography>
        </Stack>
        <Stack spacing={1}>
          {data.documents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun document pour le moment.
            </Typography>
          ) : (
            data.documents.map((d) => (
            <Paper key={d.name} elevation={0} sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.04)" }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {d.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {d.updatedLabel}
              </Typography>
            </Paper>
            ))
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Maîtrise des compétences
        </Typography>
        <Stack spacing={1.5}>
          {data.skills.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Compétences non renseignées.
            </Typography>
          ) : (
            data.skills.map((s) => (
            <Paper key={s.label} elevation={0} sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.04)" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase" }}>
                  {s.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {s.percent}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={s.percent}
                sx={{
                  height: 6,
                  borderRadius: 999,
                  bgcolor: "rgba(255,255,255,0.08)",
                  "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: "primary.main" },
                }}
              />
              {s.chips?.length ? (
                <>
                  <Divider sx={{ my: 1.25, opacity: 0.12 }} />
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                    {s.chips.map((c) => (
                      <Chip key={c} label={c} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </>
              ) : null}
            </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

