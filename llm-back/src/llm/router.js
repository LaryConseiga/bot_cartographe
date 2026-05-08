/**
 * Task type detection — decides which LLM to call based on message content.
 */

const TaskType = { CHAT: "chat", EXTRACTION: "extraction", SYNTHESIS: "synthesis" };

function detectTaskType(message, context) {
  if (context?.cvJustUploaded === true) return TaskType.EXTRACTION;

  const msg = String(message || "").toLowerCase();
  const triggers = [
    "génère mon pathway",
    "genere mon pathway",
    "génère ma roadmap",
    "genere ma roadmap",
    "analyse mon profil",
    "synthétise",
    "synthetise",
    "compare mes compétences",
    "compare mes competences",
    "plan de formation",
    "gap analysis",
    "quel est mon score",
    "crée mon plan",
    "cree mon plan",
    "montre mes lacunes",
    "génère mon plan",
    "genere mon plan"
  ];
  if (triggers.some((t) => msg.includes(t))) return TaskType.SYNTHESIS;

  return TaskType.CHAT;
}

function computeProfileCompleteness(history, profile) {
  let total = 0;
  if (profile?.cv_text) total += 20;
  if (profile?.target_role) total += 15;
  if (profile?.country) total += 10;

  const joined = (Array.isArray(history) ? history : [])
    .map((m) => String(m?.content || ""))
    .join(" ")
    .toLowerCase();

  const hasAny = (arr) => arr.some((k) => joined.includes(k));
  if (hasAny(["fintech", "tech", "ong", "telecom", "banque", "sante", "santé", "education"])) total += 15;
  if (hasAny(["burkina", "sénégal", "senegal", "maroc", "ivoire", "côte d’ivoire", "mali", "remote", "togo"])) total += 10;
  if (hasAny(["mois", "an", "semaine", "bientôt", "bientot", "urgent", "horizon"])) total += 10;
  if (hasAny(["important", "compte", "valeur", "aime", "passion", "impact", "sens"])) total += 10;
  if (hasAny(["difficile", "problème", "probleme", "bloqué", "bloque", "manque", "peur", "incertain"])) total += 10;

  return Math.min(total, 100);
}

module.exports = {
  TaskType,
  detectTaskType,
  computeProfileCompleteness
};

