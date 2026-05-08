"use client";

import type { StudentProfile } from "./api";

export type ProfileUI = {
  fullName: string;
  headline: string;
  tags: string[];
  careerObjective: string;
  documents: { name: string; updatedLabel: string }[];
  skills: { label: string; percent: number; chips?: string[] }[];
};

type CvMeta = {
  headline?: string;
  tags?: string[];
  careerObjective?: string;
  documents?: { name: string; updatedLabel: string }[];
  skills?: { label: string; percent: number; chips?: string[] }[];
};

const DEFAULT_UI: ProfileUI = {
  fullName: "ApexAI",
  headline: "",
  tags: [],
  careerObjective: "",
  documents: [],
  skills: []
};

export function toUI(p: StudentProfile | null): ProfileUI {
  if (!p) return DEFAULT_UI;

  const fullName = p.full_name ?? "";
  const loc = [p.city, p.country].filter(Boolean).join(", ");
  const headline = [p.target_role, loc].filter(Boolean).join(" • ");

  let meta: CvMeta = {};
  if (p.cv_text) {
    try {
      const parsed = JSON.parse(p.cv_text) as CvMeta;
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      // ignore
    }
  }

  return {
    fullName: fullName || "ApexAI",
    headline: meta.headline ?? headline,
    tags: meta.tags ?? [],
    careerObjective: meta.careerObjective ?? "",
    documents: meta.documents ?? [],
    skills: meta.skills ?? []
  };
}

export function toPatchFromUI(ui: Partial<ProfileUI>): Partial<StudentProfile> {
  // On stocke les champs “riches” dans cv_text en JSON (temporaire, sans migration SQL).
  const meta: CvMeta = {};
  if (ui.headline !== undefined) meta.headline = ui.headline;
  if (ui.tags) meta.tags = ui.tags;
  if (ui.careerObjective !== undefined) meta.careerObjective = ui.careerObjective;
  if (ui.documents) meta.documents = ui.documents;
  if (ui.skills) meta.skills = ui.skills;

  return {
    full_name: ui.fullName,
    cv_text: JSON.stringify(meta)
  };
}

