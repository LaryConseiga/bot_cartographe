"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";

const DRAWER_WIDTH = 280;

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_MAIN: NavItem[] = [
  { label: "Analyse CV", href: "/chat/analyse-cv", icon: <AssessmentOutlinedIcon fontSize="small" /> },
  { label: "Progression", href: "/chat/progression", icon: <TimelineRoundedIcon fontSize="small" /> },
  { label: "Offres d'emploi", href: "/chat/offres-emploi", icon: <WorkOutlineRoundedIcon fontSize="small" /> },
  { label: "Tendances marché", href: "/chat/tendances-marche", icon: <TrendingUpRoundedIcon fontSize="small" /> },
];

const NAV_FOOTER: NavItem[] = [
  { label: "Profil", href: "/chat/profil", icon: <Avatar sx={{ width: 18, height: 18, bgcolor: "rgba(255,255,255,0.12)", fontSize: 10 }}>A</Avatar> },
  { label: "Paramètres", href: "/chat/parametres", icon: <SettingsRoundedIcon fontSize="small" /> },
  { label: "Aide", href: "/chat/aide", icon: <HelpOutlineRoundedIcon fontSize="small" /> },
];

function getTitle(pathname: string) {
  const all = [...NAV_MAIN, ...NAV_FOOTER];
  const found = all.find((x) => pathname === x.href || pathname.startsWith(x.href + "/"));
  if (pathname === "/chat" || pathname.startsWith("/chat/c/")) return "ApexAI";
  return found?.label ?? "Apex AI";
}

function SidebarContent(props: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const [recents, setRecents] = React.useState<Array<{ id: string; title: string }>>([]);

  React.useEffect(() => {
    let alive = true;
    import("@/lib/api")
      .then(async ({ listMyChats }) => {
        try {
          const out = await listMyChats();
          if (!alive) return;
          setRecents(
            (out.chats || []).map((c) => ({
              id: c.id,
              title: c.session_ref || "Chat"
            }))
          );
        } catch {
          if (!alive) return;
          setRecents([]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.2 }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: 1.25,
            overflow: "hidden",
            flex: "0 0 auto",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <Image src={LOGO_SRC} alt="ApexAI" width={26} height={26} />
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, opacity: 0.9 }}>
          ApexAI
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.65 }}>
          AI Career Assistant
        </Typography>
      </Box>

      <Box sx={{ px: 2, pb: 1.5 }}>
        <Button
          fullWidth
          startIcon={<AddRoundedIcon />}
          component={NextLink}
          href="/chat"
          variant="contained"
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2.5,
          }}
        >
          Nouveau chat
        </Button>
      </Box>

      <List dense sx={{ px: 1 }}>
        {NAV_MAIN.map((item) => {
          const selected = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <ListItemButton
              key={item.href}
              component={NextLink}
              href={item.href}
              selected={selected}
              onClick={props.onNavigate}
              sx={{
                borderRadius: 2,
                mx: 1,
                my: 0.25,
                "&.Mui-selected": {
                  bgcolor: "rgba(255,255,255,0.08)",
                },
                "&.Mui-selected:hover": {
                  bgcolor: "rgba(255,255,255,0.10)",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: "inherit", opacity: 0.9 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: { fontSize: 13, fontWeight: selected ? 700 : 600 }
                  }
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700, letterSpacing: 0.2 }}>
          Récents
        </Typography>
      </Box>
      <List dense sx={{ px: 1 }}>
        {recents.slice(0, 12).map((c) => {
          const href = `/chat/c/${c.id}`;
          const selected = pathname === href || pathname.startsWith(href + "/");
          return (
            <ListItemButton
              key={c.id}
              component={NextLink}
              href={href}
              selected={selected}
              onClick={props.onNavigate}
              sx={{
                borderRadius: 2,
                mx: 1,
                my: 0.15,
                py: 0.6,
                "&.Mui-selected": { bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              <ListItemText
                primary={c.title}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: { fontSize: 12.5, fontWeight: selected ? 700 : 600 }
                  }
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />

      <Divider sx={{ opacity: 0.15 }} />

      <List dense sx={{ px: 1, py: 1 }}>
        {NAV_FOOTER.map((item) => {
          const selected = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <ListItemButton
              key={item.href}
              component={NextLink}
              href={item.href}
              selected={selected}
              onClick={props.onNavigate}
              sx={{ borderRadius: 2, mx: 1, my: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: "inherit", opacity: 0.9 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: { fontSize: 13, fontWeight: selected ? 700 : 600 }
                  }
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

export default function AppShell(props: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (isMobile) setOpen(false);
  }, [pathname, isMobile]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? open : true}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              bgcolor: "#0B0F14",
              color: "#E5E7EB",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            },
          }}
        >
          <SidebarContent onNavigate={() => setOpen(false)} />
        </Drawer>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "background.default",
            color: "text.primary",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              {getTitle(pathname)}
            </Typography>

            <Tooltip title="Partager">
              <IconButton aria-label="Partager">
                <IosShareRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Télécharger">
              <IconButton aria-label="Télécharger">
                <DownloadRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Compte">
              <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main" }}>A</Avatar>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 3 },
          }}
        >
          {props.children}
        </Box>
      </Box>
    </Box>
  );
}

