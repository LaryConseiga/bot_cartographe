"use client";

import * as React from "react";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import { getMyProfile, getMySkills, listJobOffers, deleteJobOffer, type JobOffer, type StudentSkill } from "@/lib/api";
import { toUI, initials, type ProfileUI } from "@/lib/profileMapping";
import { SHOW_PROGRESSION } from "@/lib/featureFlags";

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
      <Typography variant="body2" color={value ? "text.primary" : "text.secondary"}>
        {value || "—"}
      </Typography>
    </Stack>
  );
}

export default function ProfileView(props: { showEditHint?: boolean }) {
  const [data, setData] = React.useState<ProfileUI>(() => toUI(null));
  const [myId, setMyId] = React.useState<string | null>(null);
  const [myOffers, setMyOffers] = React.useState<JobOffer[]>([]);
  const [skills, setSkills] = React.useState<StudentSkill[]>([]);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const profileOut = await getMyProfile();
        if (!alive) return;
        setMyId(profileOut.profile?.id ?? null);
        setData(toUI(profileOut.profile));
        setError(null);

        const [offersOut, skillsOut] = await Promise.allSettled([listJobOffers(), getMySkills()]);
        if (!alive) return;
        if (offersOut.status === "fulfilled" && profileOut.profile?.id) {
          setMyOffers(offersOut.value.offers.filter((o) => o.posted_by === profileOut.profile!.id));
        }
        if (skillsOut.status === "fulfilled") {
          setSkills(skillsOut.value.skills);
        }
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

  async function handleDeleteOffer(offer: JobOffer) {
    if (!window.confirm(`Supprimer l'offre "${offer.title}" ?`)) return;
    setDeletingId(offer.id);
    try {
      await deleteJobOffer(offer.id);
      setMyOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  }

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

  const headline = [data.targetRole, [data.city, data.country].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" • ");

  const hardSkills = skills.filter((s) => s.source !== "cv_soft");
  const softSkills = skills.filter((s) => s.source === "cv_soft");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* En-tête */}
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar sx={{ width: 54, height: 54, bgcolor: "rgba(255,255,255,0.10)" }}>
            {initials(data.fullName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {data.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {headline || "Objectif non renseigné"}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Coordonnées */}
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
          Coordonnées
        </Typography>
        <Stack spacing={1.25}>
          <ContactRow icon={<EnvelopeIcon style={{ width: 16, height: 16 }} />} value={data.email} />
          <ContactRow icon={<PhoneIcon style={{ width: 16, height: 16 }} />} value={data.phone} />
          <ContactRow icon={<LinkIcon style={{ width: 16, height: 16 }} />} value={data.linkedin} />
          <ContactRow icon={<GlobeAltIcon style={{ width: 16, height: 16 }} />} value={data.portfolio} />
        </Stack>
        {props.showEditHint && (!data.phone || !data.linkedin) ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Complète tes coordonnées dans{" "}
            <Button component={Link} href="/chat/parametres" variant="text" sx={{ textTransform: "none", fontWeight: 800, p: 0, minWidth: 0 }}>
              Paramètres
            </Button>{" "}
            pour éviter qu'Apex te les redemande à chaque candidature.
          </Typography>
        ) : null}
      </Paper>

      {/* Objectif de carrière */}
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          Objectif de carrière
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {data.targetRole ? <Chip label={data.targetRole} size="small" /> : null}
          {data.targetSector ? <Chip label={data.targetSector} size="small" variant="outlined" /> : null}
          {data.targetCountry ? <Chip label={data.targetCountry} size="small" variant="outlined" /> : null}
          {!data.targetRole && !data.targetSector && !data.targetCountry ? (
            <Typography variant="body2" color="text.secondary">
              Non renseigné.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {/* Mes offres publiées */}
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Mes offres publiées
        </Typography>
        {myOffers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Tu n&apos;as publié aucune offre pour l&apos;instant.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {myOffers.map((o) => (
              <Paper
                key={o.id}
                elevation={0}
                sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {o.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {o.company}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label="Supprimer cette offre"
                  disabled={deletingId === o.id}
                  onClick={() => handleDeleteOffer(o)}
                  sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                >
                  {deletingId === o.id ? <CircularProgress size={16} /> : <TrashIcon style={{ width: 16, height: 16 }} />}
                </IconButton>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* CV */}
      <Paper elevation={0} sx={{ p: 2.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          CV
        </Typography>
        {data.hasCv ? (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <DocumentTextIcon style={{ width: 18, height: 18, color: "#10A37F" }} />
            <Typography variant="body2">
              CV importé
              {data.cvUpdatedAt ? ` — mis à jour le ${new Date(data.cvUpdatedAt).toLocaleDateString("fr-FR")}` : ""}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Aucun CV importé pour l&apos;instant.
          </Typography>
        )}
        <Button component={Link} href="/chat" size="small" sx={{ textTransform: "none", fontWeight: 700, mt: 1, p: 0 }}>
          {data.hasCv ? "Réimporter mon CV →" : "Importer mon CV →"}
        </Button>
      </Paper>

      {/* Compétences — masqué en production, cf. Progression */}
      {SHOW_PROGRESSION ? (
        <Paper elevation={0} sx={{ p: 2.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
            Compétences détectées
          </Typography>
          {skills.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Compétences non renseignées — importe ton CV pour les détecter automatiquement.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {hardSkills.length ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Techniques
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                    {hardSkills.map((s) => (
                      <Chip key={s.id} label={s.skill} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              ) : null}
              {softSkills.length ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Comportementales
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                    {softSkills.map((s) => (
                      <Chip key={s.id} label={s.skill} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          )}
        </Paper>
      ) : null}
    </Box>
  );
}
