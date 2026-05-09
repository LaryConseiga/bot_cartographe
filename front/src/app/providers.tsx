"use client";

import React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";

type ColorMode = "light" | "dark";

function getSystemMode(): ColorMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function buildTheme(mode: ColorMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: "#10A37F" },
      background: {
        default: isDark ? "#0B0F14" : "#F7F7F8",
        paper: isDark ? "#0F172A" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#E5E7EB" : "#111827",
        secondary: isDark ? "#9CA3AF" : "#4B5563",
      },
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.10)",
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: "var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Roboto, Arial",
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(17,24,39,0.08)",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 10,
            ...(ownerState.variant === "contained" && ownerState.color === "primary"
              ? {
                  background: "linear-gradient(135deg, #10A37F 0%, #0d8a6b 100%)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #0d8a6b 0%, #0b7560 100%)",
                  },
                }
              : {}),
          }),
        },
      },
      MuiTextField: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 10,
              "& fieldset": {
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(17,24,39,0.15)",
              },
              "&:hover fieldset": {
                borderColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(17,24,39,0.30)",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#10A37F",
                borderWidth: 1.5,
              },
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "background-color 0.15s ease",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: 14,
          },
        },
      },
    },
  });
}

export default function Providers(props: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ColorMode>("dark");

  React.useEffect(() => {
    setMode(getSystemMode());
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;

    const onChange = () => setMode(mql.matches ? "dark" : "light");
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  const theme = React.useMemo(() => buildTheme(mode), [mode]);

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {props.children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
