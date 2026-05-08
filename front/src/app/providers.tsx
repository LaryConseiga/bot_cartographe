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
      primary: { main: "#10A37F" }, // ChatGPT green
      background: {
        default: isDark ? "#0B0F14" : "#F7F7F8",
        paper: isDark ? "#0F172A" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#E5E7EB" : "#111827",
        secondary: isDark ? "#9CA3AF" : "#4B5563",
      },
      divider: isDark ? "rgba(255,255,255,0.10)" : "rgba(17,24,39,0.10)",
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
    // Fallback anciens navigateurs
    // @ts-expect-error legacy API
    mql.addListener(onChange);
    // @ts-expect-error legacy API
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

