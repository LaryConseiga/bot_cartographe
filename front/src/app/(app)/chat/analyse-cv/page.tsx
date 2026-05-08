import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export default function AnalyseCvPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 4 },
          borderStyle: "dashed",
          borderWidth: 1,
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Importez votre CV
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Glissez-déposez votre fichier ou cliquez pour analyser vos compétences avec ApexAI.
        </Typography>
        <Button variant="contained" sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}>
          Parcourir les fichiers
        </Button>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Analyse terminée. Voici les points clés de votre profil par rapport aux exigences du marché…
        </Typography>
      </Paper>
    </Box>
  );
}

