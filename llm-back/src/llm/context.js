/**
 * Builds the student context string injected into every prompt.
 * Queries Supabase for profile, skills, and latest gap report.
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function truncate(s, n) {
  const str = String(s || "");
  if (str.length <= n) return str;
  return str.slice(0, n - 1) + "…";
}

async function buildStudentContext(studentId) {
  try {
    const [{ data: profile }, { data: skills }, { data: gaps }] = await Promise.all([
      supabase.from("student_profiles").select("*").eq("id", studentId).maybeSingle(),
      supabase.from("student_skills").select("*").eq("student_id", studentId).limit(20),
      supabase.from("gap_reports").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1)
    ]);

    const p = profile || {};
    const sk = Array.isArray(skills) ? skills : [];
    const lastGap = Array.isArray(gaps) && gaps.length ? gaps[0] : null;

    const name = p.full_name || "Étudiant";
    const loc = [p.city, p.country].filter(Boolean).join(", ") || "non précisé";
    const field = p.field_of_study || "non précisé";
    const target = p.target_role || "non précisé";

    const byLevel = { mastered: [], learning: [], toLearn: [] };
    for (const s of sk) {
      const lvl = String(s?.level || "").toLowerCase();
      const item = s?.skill;
      if (!item) continue;
      if (lvl.includes("maîtr") || lvl.includes("maitr") || lvl.includes("expert")) byLevel.mastered.push(item);
      else if (lvl.includes("cours") || lvl.includes("inter")) byLevel.learning.push(item);
      else byLevel.toLearn.push(item);
    }

    const gapLine = lastGap
      ? `Dernier gap_report: score=${lastGap.global_score ?? "?"} | missing_skills(top3)=${(lastGap.missing_skills || []).slice(0, 3).join(", ")}`
      : "Dernier gap_report: aucun";

    const cvSnippet = p.cv_text ? truncate(p.cv_text, 500) : "";

    const out =
      `
Nom: ${name}
Localisation: ${loc}
Domaine d'étude: ${field}
Rôle cible: ${target}
Compétences (maîtrisé): ${(byLevel.mastered || []).slice(0, 8).join(", ") || "—"}
Compétences (en cours): ${(byLevel.learning || []).slice(0, 8).join(", ") || "—"}
Compétences (à apprendre): ${(byLevel.toLearn || []).slice(0, 8).join(", ") || "—"}
${gapLine}
CV (extrait): ${cvSnippet || "—"}
`.trim() || "";

    return truncate(out, 2000);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[context] buildStudentContext error:", e?.message || e);
    return "Contexte étudiant indisponible.";
  }
}

module.exports = {
  supabase,
  buildStudentContext
};

