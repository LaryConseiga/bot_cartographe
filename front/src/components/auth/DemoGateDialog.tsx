"use client";

import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

const TEAL = "#10A37F";

export default function DemoGateDialog(props: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Crée ton compte pour continuer</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Tu utilises un accès démo. Pour discuter avec Apex et profiter de toutes les fonctionnalités
          (analyse de CV, offres d&apos;emploi, CV et lettres de motivation personnalisés…), crée ton compte
          gratuitement — ça prend une minute.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={props.onClose} sx={{ textTransform: "none", color: "text.secondary" }}>
          Plus tard
        </Button>
        <Button
          variant="contained"
          onClick={() => router.push("/inscription")}
          sx={{ textTransform: "none", fontWeight: 700, bgcolor: TEAL, "&:hover": { bgcolor: "#0d8f6a" }, boxShadow: "none" }}
        >
          S&apos;inscrire
        </Button>
      </DialogActions>
    </Dialog>
  );
}
