"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { BriefcaseIcon, MapPinIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { JobOffer } from "@/lib/api";

const TEAL = "#10A37F";

const CONTRACT_TYPES: JobOffer["contract_type"][] = ["stage", "alternance", "emploi", "CDI", "CDD"];

function contractLabel(type: JobOffer["contract_type"]): string {
  return type;
}

const emptyForm = {
  title: "",
  company: "",
  contract_type: "stage" as JobOffer["contract_type"],
  location: "",
  country: "",
  description: ""
};

export default function OffresEmploiPage() {
  const router = useRouter();
  const [offers, setOffers] = React.useState<JobOffer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [myId, setMyId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [applyingId, setApplyingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const { listJobOffers } = await import("@/lib/api");
      const { offers: rows } = await listJobOffers();
      setOffers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les offres.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        const { getMyProfile } = await import("@/lib/api");
        const { profile } = await getMyProfile();
        setMyId(profile?.id ?? null);
      } catch {
        setMyId(null);
      }
    })();
    refresh();
  }, []);

  async function handleCreate() {
    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { createJobOffer } = await import("@/lib/api");
      await createJobOffer({
        title: form.title.trim(),
        company: form.company.trim(),
        contract_type: form.contract_type,
        location: form.location.trim() || null,
        country: form.country.trim() || null,
        description: form.description.trim()
      });
      setDialogOpen(false);
      setForm(emptyForm);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publication impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(offer: JobOffer) {
    if (!window.confirm(`Supprimer l'offre "${offer.title}" ?`)) return;
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

  async function handleApply(offer: JobOffer) {
    setApplyingId(offer.id);
    setError(null);
    try {
      const { createMyChat } = await import("@/lib/api");
      const out = await createMyChat();
      sessionStorage.setItem(
        `apex_init_msg_${out.chat.id}`,
        `Je veux postuler à cette offre : ${offer.title} chez ${offer.company}.`
      );
      sessionStorage.setItem(
        `apex_init_offer_${out.chat.id}`,
        JSON.stringify({
          offerId: offer.id,
          title: offer.title,
          company: offer.company,
          description: offer.description
        })
      );
      router.push(`/chat/c/${out.chat.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer la conversation.");
      setApplyingId(null);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 860, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Offres d&apos;emploi
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Stages, alternances et emplois publiés par la communauté ApexAI.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PlusIcon style={{ width: 16, height: 16 }} />}
          onClick={() => setDialogOpen(true)}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, bgcolor: TEAL, "&:hover": { bgcolor: "#0d8f6a" }, boxShadow: "none" }}
        >
          Publier une offre
        </Button>
      </Box>

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} sx={{ color: TEAL }} />
        </Box>
      ) : offers.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            bgcolor: "rgba(255,255,255,0.02)",
            borderStyle: "dashed"
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "14px",
              bgcolor: "rgba(99,102,241,0.10)",
              border: "1px solid rgba(99,102,241,0.20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <BriefcaseIcon style={{ width: 24, height: 24, color: "#6366F1" }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Aucune offre pour l&apos;instant
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            Sois le premier à publier un stage, une alternance ou un emploi pour la communauté.
          </Typography>
        </Paper>
      ) : (
        offers.map((offer) => (
          <Paper key={offer.id} elevation={0} sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {offer.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {offer.company}
                  {offer.location ? ` — ${offer.location}` : ""}
                  {offer.country ? `, ${offer.country}` : ""}
                </Typography>
              </Box>
              {myId && offer.posted_by === myId ? (
                <IconButton
                  size="small"
                  aria-label="Supprimer cette offre"
                  onClick={() => handleDelete(offer)}
                  disabled={deletingId === offer.id}
                  sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                >
                  {deletingId === offer.id ? <CircularProgress size={16} /> : <TrashIcon style={{ width: 16, height: 16 }} />}
                </IconButton>
              ) : null}
            </Box>

            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              <Chip
                icon={<MapPinIcon style={{ width: 13, height: 13 }} />}
                label={contractLabel(offer.contract_type)}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: 12, "& .MuiChip-icon": { color: "inherit" } }}
              />
            </Box>

            <Typography variant="body2" sx={{ fontSize: 13.5, color: "text.secondary" }}>
              {offer.description.length > 220 ? `${offer.description.slice(0, 220)}…` : offer.description}
            </Typography>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleApply(offer)}
                disabled={applyingId === offer.id}
                startIcon={applyingId === offer.id ? <CircularProgress size={14} /> : null}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Postuler
              </Button>
            </Box>
          </Paper>
        ))
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Publier une offre</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Titre du poste"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="Entreprise"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            select
            label="Type de contrat"
            value={form.contract_type}
            onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value as JobOffer["contract_type"] }))}
            fullWidth
            size="small"
          >
            {CONTRACT_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Lieu"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Pays"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            fullWidth
            required
            multiline
            minRows={5}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.title.trim() || !form.company.trim() || !form.description.trim()}
            sx={{ textTransform: "none", fontWeight: 700, bgcolor: TEAL, "&:hover": { bgcolor: "#0d8f6a" }, boxShadow: "none" }}
          >
            {submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Publier"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
