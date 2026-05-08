"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

export default function ChatHomePage() {
  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        pb: { xs: 10, sm: 12 },
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 800, textAlign: "center" }}>
        Sur quoi travaillez-vous ?
      </Typography>

      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 720,
          p: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderRadius: 999,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <IconButton aria-label="Ajouter" size="small" sx={{ ml: 0.25 }}>
          <AddRoundedIcon fontSize="small" />
        </IconButton>
        <TextField
          placeholder="Ask anything"
          variant="standard"
          fullWidth
          slotProps={{ input: { disableUnderline: true } }}
          sx={{
            "& input": { fontSize: 15 },
            "& .MuiInput-root:before": { borderBottom: "none !important" },
            "& .MuiInput-root:after": { borderBottom: "none !important" },
            "& .MuiInput-root:hover:not(.Mui-disabled):before": { borderBottom: "none !important" },
          }}
        />
        <IconButton aria-label="Micro" size="small">
          <MicNoneRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label="Audio"
          onClick={async () => {
            try {
              const { createMyChat } = await import("@/lib/api");
              const out = await createMyChat();
              window.location.href = `/chat/c/${out.chat.id}`;
            } catch {
              // ignore
            }
          }}
          sx={{
            mr: 0.25,
            bgcolor: "#0B0F14",
            color: "white",
            "&:hover": { bgcolor: "#111827" },
            width: 40,
            height: 40,
          }}
        >
          <GraphicEqRoundedIcon fontSize="small" />
        </IconButton>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", maxWidth: 680 }}>
        ApexAI peut commettre des erreurs. Vérifiez les informations importantes.
      </Typography>
    </Box>
  );
}

