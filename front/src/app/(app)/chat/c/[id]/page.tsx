"use client";

import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [messages, setMessages] = React.useState<Array<{ id: string; role: string; content: string }>>([]);
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    import("@/lib/api")
      .then(async ({ listMessages }) => {
        try {
          const out = await listMessages(sessionId);
          if (!alive) return;
          setMessages(out.messages || []);
        } catch {
          if (!alive) return;
          setMessages([]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sessionId]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 64px)" }}>
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5, maxWidth: 900, width: "100%", mx: "auto" }}>
        {messages.length === 0 ? (
          <Paper elevation={0} sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Aucun message pour le moment.
            </Typography>
          </Paper>
        ) : (
          messages.map((m) => (
            <Paper key={m.id} elevation={0} sx={{ p: 2, bgcolor: m.role === "user" ? "rgba(255,255,255,0.03)" : "rgba(16,163,127,0.08)" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                {m.role}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {m.content}
              </Typography>
            </Paper>
          ))
        )}
      </Box>

      <Box sx={{ position: "sticky", bottom: 0, pt: 2, pb: 2, bgcolor: "background.default" }}>
        <Box sx={{ maxWidth: 900, width: "100%", mx: "auto" }}>
          <Paper
            elevation={0}
            sx={{
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
              value={text}
              onChange={(e) => setText(e.target.value)}
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
                const content = text.trim();
                if (!content) return;
                setText("");
                try {
                  const { sendMessage } = await import("@/lib/api");
                  const out = await sendMessage(sessionId, content);
                  setMessages((prev) => [...prev, out.message]);
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
        </Box>
      </Box>
    </Box>
  );
}

