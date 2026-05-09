"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

import {
  PlusIcon,
  Bars3Icon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  PresentationChartLineIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

const LOGO_SRC = "/ChatGPT Image May 7, 2026, 01_41_46 PM.png";
const DRAWER_WIDTH = 272;
const ICON_SM = { width: 18, height: 18 } as const;

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_MAIN: NavItem[] = [
  { label: "Analyse CV",       href: "/chat/analyse-cv",      icon: <ChartBarIcon style={ICON_SM} /> },
  { label: "Progression",      href: "/chat/progression",     icon: <PresentationChartLineIcon style={ICON_SM} /> },
  { label: "Offres d'emploi",  href: "/chat/offres-emploi",   icon: <BriefcaseIcon style={ICON_SM} /> },
  { label: "Tendances marché", href: "/chat/tendances-marche",icon: <ArrowTrendingUpIcon style={ICON_SM} /> },
];

const NAV_FOOTER: NavItem[] = [
  { label: "Profil",     href: "/chat/profil",     icon: <UserCircleIcon style={ICON_SM} /> },
  { label: "Paramètres", href: "/chat/parametres", icon: <Cog6ToothIcon style={ICON_SM} /> },
  { label: "Aide",       href: "/chat/aide",        icon: <QuestionMarkCircleIcon style={ICON_SM} /> },
];

function getTitle(pathname: string) {
  const all = [...NAV_MAIN, ...NAV_FOOTER];
  const found = all.find((x) => pathname === x.href || pathname.startsWith(x.href + "/"));
  if (pathname === "/chat" || pathname.startsWith("/chat/c/")) return "ApexAI";
  return found?.label ?? "ApexAI";
}

function NavButton({
  item,
  selected,
  onNavigate,
}: {
  item: NavItem;
  selected: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ListItemButton
      component={NextLink}
      href={item.href}
      selected={selected}
      onClick={onNavigate}
      sx={{
        borderRadius: 2,
        mx: 0.75,
        my: 0.2,
        px: 1.25,
        py: 0.75,
        position: "relative",
        "&.Mui-selected": {
          bgcolor: "rgba(16,163,127,0.12)",
          color: "primary.main",
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: "22%",
            bottom: "22%",
            width: 3,
            borderRadius: "0 3px 3px 0",
            background: "#10A37F",
          },
        },
        "&.Mui-selected:hover": { bgcolor: "rgba(16,163,127,0.16)" },
        "&.Mui-selected .MuiListItemIcon-root": { color: "primary.main" },
        "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 32, color: "inherit", opacity: selected ? 1 : 0.7 }}>
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{
          primary: {
            sx: { fontSize: 13.5, fontWeight: selected ? 700 : 500, letterSpacing: 0.1 },
          },
        }}
      />
    </ListItemButton>
  );
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
              title: c.session_ref || "Chat",
            }))
          );
        } catch {
          if (!alive) return;
          setRecents([]);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.75, display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            overflow: "hidden",
            flex: "0 0 auto",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 0 12px rgba(16,163,127,0.15)",
          }}
        >
          <Image src={LOGO_SRC} alt="ApexAI" width={28} height={28} />
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            ApexAI
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.5, lineHeight: 1, fontSize: 10.5 }}>
            Career Assistant
          </Typography>
        </Box>
      </Box>

      {/* Nouveau chat */}
      <Box sx={{ px: 1.5, pb: 1.5, flexShrink: 0 }}>
        <Button
          fullWidth
          component={NextLink}
          href="/chat"
          variant="outlined"
          startIcon={<PlusIcon style={{ width: 16, height: 16 }} />}
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            fontSize: 13.5,
            borderColor: "rgba(255,255,255,0.12)",
            color: "text.primary",
            "&:hover": {
              borderColor: "primary.main",
              color: "primary.main",
              bgcolor: "rgba(16,163,127,0.06)",
            },
          }}
        >
          Nouveau chat
        </Button>
      </Box>

      <Divider sx={{ opacity: 0.12, mx: 1.5 }} />

      {/* Navigation principale */}
      <List dense sx={{ px: 0.5, pt: 1, flexShrink: 0 }}>
        {NAV_MAIN.map((item) => {
          const selected = pathname === item.href || pathname.startsWith(item.href + "/");
          return <NavButton key={item.href} item={item} selected={selected} onNavigate={props.onNavigate} />;
        })}
      </List>

      {/* Récents */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
        <Typography
          variant="caption"
          sx={{ opacity: 0.45, fontWeight: 700, letterSpacing: 0.8, fontSize: 10.5, textTransform: "uppercase" }}
        >
          Récents
        </Typography>
      </Box>
      <List
        dense
        sx={{
          px: 0.5,
          flex: 1,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.08)", borderRadius: 4 },
        }}
      >
        {recents.length === 0 ? (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.35, fontSize: 12 }}>
              Aucun chat pour l'instant
            </Typography>
          </Box>
        ) : (
          recents.slice(0, 12).map((c) => {
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
                  mx: 0.75,
                  my: 0.1,
                  py: 0.55,
                  px: 1.25,
                  "&.Mui-selected": { bgcolor: "rgba(16,163,127,0.10)", color: "primary.main" },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 26, opacity: 0.45, color: "inherit" }}>
                  <ChatBubbleLeftIcon style={{ width: 13, height: 13 }} />
                </ListItemIcon>
                <ListItemText
                  primary={c.title}
                  slotProps={{
                    primary: {
                      noWrap: true,
                      sx: { fontSize: 12.5, fontWeight: selected ? 700 : 500 },
                    },
                  }}
                />
              </ListItemButton>
            );
          })
        )}
      </List>

      <Divider sx={{ opacity: 0.12, mx: 1.5 }} />

      {/* Footer nav */}
      <List dense sx={{ px: 0.5, py: 1, flexShrink: 0 }}>
        {NAV_FOOTER.map((item) => {
          const selected = pathname === item.href || pathname.startsWith(item.href + "/");
          return <NavButton key={item.href} item={item} selected={selected} onNavigate={props.onNavigate} />;
        })}
      </List>
    </Box>
  );
}

export default function AppShell(props: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    import("@/lib/api")
      .then(async ({ getMyProfile }) => {
        try {
          await getMyProfile();
        } catch {
          if (!alive) return;
          router.replace("/connexion");
        }
      })
      .catch(() => router.replace("/connexion"));
    return () => { alive = false; };
  }, [router]);

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
              bgcolor: "#080C11",
              color: "#E5E7EB",
              borderRight: "1px solid rgba(255,255,255,0.06)",
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
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 60 } }}>
            {isMobile && (
              <IconButton
                type="button"
                edge="start"
                onClick={() => setOpen(true)}
                aria-label="Ouvrir le menu"
                size="small"
              >
                <Bars3Icon style={{ width: 20, height: 20 }} />
              </IconButton>
            )}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, fontSize: 15 }}>
              {getTitle(pathname)}
            </Typography>

            <Tooltip title="Partager">
              <IconButton type="button" aria-label="Partager" size="small" sx={{ opacity: 0.65 }}>
                <ShareIcon style={{ width: 18, height: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Télécharger">
              <IconButton type="button" aria-label="Télécharger" size="small" sx={{ opacity: 0.65 }}>
                <ArrowDownTrayIcon style={{ width: 18, height: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mon compte">
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  bgcolor: "primary.main",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                A
              </Avatar>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}
        >
          {props.children}
        </Box>
      </Box>
    </Box>
  );
}
