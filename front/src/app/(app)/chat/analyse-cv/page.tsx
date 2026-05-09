"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function AnalyseCvPage() {
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  function handleFile(f: File) {
    setFile(f);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 760, mx: "auto" }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          Analyse de CV
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Importez votre CV pour obtenir un score de compatibilité et un plan d'amélioration personnalisé.
        </Typography>
      </Box>

      {/* Zone de dépôt */}
      <Paper
        elevation={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) handleFile(dropped);
        }}
        sx={{
          p: { xs: 4, sm: 6 },
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: dragging ? "primary.main" : file ? "primary.main" : "divider",
          bgcolor: dragging
            ? "rgba(16,163,127,0.06)"
            : file
            ? "rgba(16,163,127,0.04)"
            : "background.paper",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s, background-color 0.2s",
          "&:hover": { borderColor: "primary.main", bgcolor: "rgba(16,163,127,0.04)" },
        }}
        onClick={() => {
          const input = document.getElementById("cv-upload") as HTMLInputElement;
          input?.click();
        }}
      >
        <input
          id="cv-upload"
          type="file"
          accept=".pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {file ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <CheckCircleIcon style={{ width: 44, height: 44, color: "#10A37F" }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DocumentTextIcon style={{ width: 18, height: 18, color: "#9CA3AF" }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {file.name}
              </Typography>
            </Box>
            <Chip
              icon={<XMarkIcon style={{ width: 13, height: 13 }} />}
              label="Changer de fichier"
              size="small"
              variant="outlined"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              sx={{ fontSize: 12, cursor: "pointer" }}
            />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "16px",
                bgcolor: "rgba(16,163,127,0.10)",
                border: "1px solid rgba(16,163,127,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUpTrayIcon style={{ width: 26, height: 26, color: "#10A37F" }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Glissez-déposez votre CV ici
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                ou cliquez pour parcourir vos fichiers
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
              PDF, DOC, DOCX — max 10 Mo
            </Typography>
          </Box>
        )}
      </Paper>

      {file && (
        <Button
          variant="contained"
          size="large"
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, alignSelf: "flex-start", px: 4 }}
        >
          Analyser avec ApexAI
        </Button>
      )}

      {/* Résultats placeholder */}
      <Paper
        elevation={0}
        sx={{ p: 3, bgcolor: "rgba(255,255,255,0.02)", borderStyle: "dashed", borderColor: "divider" }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Résultats de l'analyse
        </Typography>
        <Typography variant="body2" color="text.secondary">
          L'analyse de votre CV apparaîtra ici — score de compatibilité, lacunes de compétences identifiées, et recommandations personnalisées pour le marché africain.
        </Typography>
      </Paper>
    </Box>
  );
}
