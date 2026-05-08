"use client";

export type ProfileData = {
  fullName: string;
  headline: string; // ex: "Senior Product Designer • Paris, FR"
  tags: string[];
  careerObjective: string;
  documents: { name: string; updatedLabel: string }[];
  skills: { label: string; percent: number; chips?: string[] }[];
};

const STORAGE_KEY = "apexai-profile";

export const DEFAULT_PROFILE: ProfileData = {
  fullName: "Jean-Luc Dubois",
  headline: "Senior Product Designer • Paris, FR",
  tags: ["Product Strategy", "SaaS Expertise", "Design Systems"],
  careerObjective:
    "Transitionner vers un rôle de Head of Design au sein d’une scale-up technologique orientée vers l’impact social d’ici 12 mois. Focus sur le management d’équipes pluridisciplinaires et l’intégration de l’IA dans les flux de conception.",
  documents: [{ name: "CV_JeanLuc_Dubois_2024.pdf", updatedLabel: "Mis à jour il y a 2 jours" }],
  skills: [
    { label: "Design technique", percent: 92, chips: ["Figma", "Auto Layout", "Prototyping"] },
    { label: "Leadership & management", percent: 78, chips: ["Agile", "Mentoring", "Public speaking"] },
    { label: "Stratégie IA", percent: 65, chips: ["Prompt engineering", "AI integration"] },
  ],
};

export function loadProfile(): ProfileData {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<ProfileData>;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(next: ProfileData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

