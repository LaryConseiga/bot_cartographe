"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import {
  UsersIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  MapPinIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { AdminMetrics, JobOffer } from "@/lib/api";
import { isAdminEmail } from "@/lib/adminConfig";

const TEAL = "#10A37F";

function StatTile(props: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        flex: "1 1 200px",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        bgcolor: "rgba(255,255,255,0.02)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
        {props.icon}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {props.label}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {props.value}
      </Typography>
      {props.hint ? (
        <Typography variant="caption" color="text.secondary">
          {props.hint}
        </Typography>
      ) : null}
    </Paper>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = React.useState(true);
  const [metrics, setMetrics] = React.useState<AdminMetrics | null>(null);
  const [offers, setOffers] = React.useState<JobOffer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { getMyProfile, isUnauthorizedError } = await import("@/lib/api");
      try {
        const { profile } = await getMyProfile();
        if (!alive) return;
        if (!isAdminEmail(profile?.email)) {
          router.replace("/chat");
          return;
        }
        setChecking(false);
      } catch (e) {
        if (!alive) return;
        if (isUnauthorizedError(e)) router.replace("/connexion");
        else router.replace("/chat");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getAdminMetrics, listJobOffers } = await import("@/lib/api");
      const [metricsOut, offersOut] = await Promise.all([getAdminMetrics(), listJobOffers()]);
      setMetrics(metricsOut.metrics);
      setOffers(offersOut.offers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!checking) refresh();
  }, [checking, refresh]);

  async function handleDelete(offer: JobOffer) {
    if (!window.confirm(`Supprimer l'offre "${offer.title}" (${offer.company}) ?`)) return;
    setDeletingId(offer.id);
    setError(null);
    try {
      const { deleteJobOffer } = await import("@/lib/api");
      await deleteJobOffer(offer.id);
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  }

  if (checking) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={32} sx={{ color: TEAL }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 960, mx: "auto" }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Tableau de bord admin
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Suivi de l&apos;usage global d&apos;ApexAI et modération des offres d&apos;emploi.
        </Typography>
      </Box>

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} sx={{ color: TEAL }} />
        </Box>
      ) : metrics ? (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <StatTile
              icon={<UsersIcon style={{ width: 18, height: 18 }} />}
              label="Utilisateurs"
              value={metrics.users_total}
              hint={`+${metrics.users_new_last_7d} cette semaine`}
            />
            <StatTile
              icon={<ChatBubbleLeftRightIcon style={{ width: 18, height: 18 }} />}
              label="Conversations"
              value={metrics.conversations_total}
              hint={`${metrics.messages_total} messages au total`}
            />
            <StatTile
              icon={<BriefcaseIcon style={{ width: 18, height: 18 }} />}
              label="Offres actives"
              value={metrics.job_offers_active}
              hint="Expirent après 60 jours"
            />
            <StatTile
              icon={<DocumentTextIcon style={{ width: 18, height: 18 }} />}
              label="Documents générés"
              value={
                metrics.documents.cv_fr +
                metrics.documents.cv_en +
                metrics.documents.letter_fr +
                metrics.documents.letter_en
              }
              hint={`CV: ${metrics.documents.cv_fr} FR / ${metrics.documents.cv_en} EN — Lettres: ${metrics.documents.letter_fr} FR / ${metrics.documents.letter_en} EN`}
            />
          </Box>

          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
              Modération des offres d&apos;emploi
            </Typography>
            {offers.length === 0 ? (
              <Paper
                elevation={0}
                sx={{ p: 3, textAlign: "center", bgcolor: "rgba(255,255,255,0.02)", borderStyle: "dashed" }}
              >
                <Typography variant="body2" color="text.secondary">
                  Aucune offre publiée pour l&apos;instant.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {offers.map((offer) => (
                  <Paper
                    key={offer.id}
                    elevation={0}
                    sx={{ p: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {offer.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {offer.company}
                        {offer.location ? ` — ${offer.location}` : ""}
                        {offer.country ? `, ${offer.country}` : ""}
                      </Typography>
                      <Chip
                        icon={<MapPinIcon style={{ width: 13, height: 13 }} />}
                        label={offer.contract_type}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.75, fontWeight: 600, fontSize: 12, "& .MuiChip-icon": { color: "inherit" } }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      aria-label="Supprimer cette offre"
                      onClick={() => handleDelete(offer)}
                      disabled={deletingId === offer.id}
                      sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                    >
                      {deletingId === offer.id ? (
                        <CircularProgress size={16} />
                      ) : (
                        <TrashIcon style={{ width: 16, height: 16 }} />
                      )}
                    </IconButton>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
