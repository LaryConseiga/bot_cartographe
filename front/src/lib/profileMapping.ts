"use client";

import type { StudentProfile } from "./api";

export type ProfileUI = {
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  targetRole: string;
  targetCountry: string;
  targetSector: string;
  city: string;
  country: string;
  hasCv: boolean;
  cvUpdatedAt: string | null;
};

const DEFAULT_UI: ProfileUI = {
  fullName: "ApexAI",
  email: "",
  phone: "",
  linkedin: "",
  portfolio: "",
  targetRole: "",
  targetCountry: "",
  targetSector: "",
  city: "",
  country: "",
  hasCv: false,
  cvUpdatedAt: null
};

export function toUI(p: StudentProfile | null): ProfileUI {
  if (!p) return DEFAULT_UI;

  return {
    fullName: p.full_name || "ApexAI",
    email: p.email ?? "",
    phone: p.phone ?? "",
    linkedin: p.linkedin ?? "",
    portfolio: p.portfolio ?? "",
    targetRole: p.target_role ?? "",
    targetCountry: p.target_country ?? "",
    targetSector: p.target_sector ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    hasCv: Boolean(p.cv_text && p.cv_text.trim()),
    cvUpdatedAt: p.updated_at ?? null
  };
}

/** Ne touche jamais à cv_text — le texte de CV importé est géré exclusivement par l'upload (chat). */
export function toPatchFromUI(ui: Partial<ProfileUI>): Partial<StudentProfile> {
  const patch: Partial<StudentProfile> = {};
  if (ui.fullName !== undefined) patch.full_name = ui.fullName || null;
  if (ui.email !== undefined) patch.email = ui.email || null;
  if (ui.phone !== undefined) patch.phone = ui.phone || null;
  if (ui.linkedin !== undefined) patch.linkedin = ui.linkedin || null;
  if (ui.portfolio !== undefined) patch.portfolio = ui.portfolio || null;
  if (ui.targetRole !== undefined) patch.target_role = ui.targetRole || null;
  if (ui.targetCountry !== undefined) patch.target_country = ui.targetCountry || null;
  if (ui.targetSector !== undefined) patch.target_sector = ui.targetSector || null;
  return patch;
}
