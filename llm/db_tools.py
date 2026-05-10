import json
from datetime import datetime, timezone

# ── Platform → badge color ────────────────────────────────────────────────────
_PLATFORM_COLORS: dict[str, str] = {
    "COURSERA": "#6366F1",
    "UDEMY": "#A435F0",
    "YOUTUBE": "#EF4444",
    "KAGGLE": "#10A37F",
    "GOOGLE": "#4285F4",
    "MICROSOFT": "#00A4EF",
    "AWS": "#FF9900",
    "LINKEDIN": "#0077B5",
    "DATACAMP": "#03EF62",
    "EDX": "#1F4068",
    "PLURALSIGHT": "#F15B2A",
    "FREECODECAMP": "#0A0A23",
    "META": "#0668E1",
    "IBM": "#006699",
    "OPENAI": "#10A37F",
    "DEEPLEARNING": "#E45C30",
    "UDACITY": "#02B3E4",
}
_DEFAULT_COLOR = "#6366F1"


def _platform_color(platform: str) -> str:
    return _PLATFORM_COLORS.get(platform.upper().strip(), _DEFAULT_COLOR)


def _item_to_card(item: dict) -> dict:
    platform = str(item.get("platform", "")).upper().strip() or "COURS"
    cost = item.get("cost", "free")
    cost_label = {"free": "Gratuit", "paid": "Payant", "audit": "Gratuit (audit)"}.get(str(cost), "Gratuit")
    duration_hours = int(item.get("duration_hours", 0))
    is_cert = bool(item.get("is_certification", False))
    url = str(item.get("url", "")).strip() or None
    return {
        "badge": platform,
        "badgeColor": _platform_color(platform),
        "title": str(item.get("title", "")),
        "url": url,
        "duration": f"{duration_hours} h",
        "costLabel": cost_label,
        "highlightRight": bool(item.get("highlight", False)),
        "heroImage": is_cert,
        "heroSubtitle": str(item.get("certification_subtitle", "")) if is_cert else None,
    }


def _exercise_to_card(item: dict) -> dict:
    platform = str(item.get("platform", "")).upper().strip()
    return {
        "title": str(item.get("title", "")),
        "platform": platform,
        "badgeColor": _platform_color(platform),
        "url": str(item.get("url", "")).strip(),
        "description": str(item.get("description", "")),
        "difficulty": str(item.get("difficulty", "intermediaire")),
    }


def _project_to_card(item: dict) -> dict:
    return {
        "title": str(item.get("title", "")),
        "description": str(item.get("description", "")),
        "skills_used": [str(s) for s in (item.get("skills_used") or [])],
        "difficulty": str(item.get("difficulty", "intermediaire")),
        "inspiration_url": str(item.get("inspiration_url", "")).strip() or None,
    }


def get_student_context(student_id: str) -> str:
    """Récupère le profil complet de l'étudiant depuis Supabase."""
    from supabase_client import get_supabase
    try:
        sb = get_supabase()

        profile_res = sb.table("student_profiles").select("*").eq("id", student_id).limit(1).execute()
        rows = profile_res.data or []
        profile = rows[0] if rows else {}

        skills_res = (
            sb.table("student_skills")
            .select("skill,level,source,confirmed")
            .eq("student_id", student_id)
            .execute()
        )
        skills = skills_res.data or []

        gap_res = (
            sb.table("gap_reports")
            .select("*")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        gap = gap_res.data[0] if gap_res.data else None

        return json.dumps(
            {"profile": profile, "skills": skills, "latest_gap_report": gap},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


def save_cv_skills(
    student_id: str,
    hard_skills: list = None,
    soft_skills: list = None,
    tools: list = None,
    target_role: str = None,
    field_of_study: str = None,
    graduation_year: int = None,
) -> str:
    """Sauvegarde les compétences extraites du CV dans student_skills et met à jour le profil."""
    from supabase_client import get_supabase
    try:
        sb = get_supabase()
        upserted = 0

        def _upsert(skill_list: list, source: str) -> None:
            nonlocal upserted
            for raw in (skill_list or []):
                skill = str(raw).strip()
                if not skill:
                    continue
                sb.table("student_skills").upsert(
                    {"student_id": student_id, "skill": skill, "source": source, "confirmed": False},
                    on_conflict="student_id,skill",
                ).execute()
                upserted += 1

        _upsert(hard_skills, "cv_hard")
        _upsert(soft_skills, "cv_soft")
        _upsert(tools, "cv_tool")

        patch: dict = {}
        if target_role:
            patch["target_role"] = target_role
        if field_of_study:
            patch["field_of_study"] = field_of_study
        if graduation_year:
            patch["graduation_year"] = int(graduation_year)
        if patch:
            sb.table("student_profiles").update(patch).eq("id", student_id).execute()

        return json.dumps(
            {"ok": True, "skills_saved": upserted, "profile_updated": bool(patch)},
            ensure_ascii=False,
        )
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


def get_skills_market(domain: str = None, limit: int = 10) -> str:
    """Récupère les compétences tendance du marché depuis la base de données."""
    from supabase_client import get_supabase
    try:
        sb = get_supabase()
        query = sb.table("skills_market").select(
            "skill,domain,demand_level,growth_rate,top_roles,avg_salary_xof,is_trending"
        )
        if domain:
            query = query.eq("domain", domain)
        res = query.order("frequency", desc=True).limit(min(int(limit), 20)).execute()
        return json.dumps({"skills": res.data or []}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


def save_gap_analysis(
    student_id: str,
    global_score: int,
    missing_skills: list = None,
    weak_skills: list = None,
    strong_skills: list = None,
    estimated_weeks: int = None,
    target_role: str = None,
) -> str:
    """Sauvegarde une analyse d'écart dans la base de données."""
    from supabase_client import get_supabase
    try:
        sb = get_supabase()
        res = sb.table("gap_reports").insert({
            "student_id": student_id,
            "target_role": target_role,
            "global_score": int(global_score),
            "missing_skills": missing_skills or [],
            "weak_skills": weak_skills or [],
            "strong_skills": strong_skills or [],
            "estimated_weeks": int(estimated_weeks) if estimated_weeks else None,
        }).execute()
        report = res.data[0] if res.data else {}
        return json.dumps({"ok": True, "report_id": report.get("id")}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


# ── Groq tool definitions ─────────────────────────────────────────────────────

DB_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_student_context",
            "description": (
                "Récupère le profil complet de l'étudiant depuis la base de données : "
                "informations personnelles, compétences enregistrées et dernière analyse de parcours. "
                "À utiliser pour personnaliser les conseils ou vérifier ce qu'on sait déjà de l'étudiant."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_cv_skills",
            "description": (
                "Extrait et sauvegarde les compétences du CV de l'étudiant dans la base de données. "
                "À appeler après avoir analysé le texte du CV de l'étudiant."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "hard_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Competences techniques (Python, SQL, React, etc.)",
                    },
                    "soft_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Competences comportementales (leadership, communication, etc.)",
                    },
                    "tools": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Outils et logiciels (Excel, Figma, VS Code, etc.)",
                    },
                    "target_role": {"type": "string", "description": "Poste ou role cible detecte dans le CV"},
                    "field_of_study": {"type": "string", "description": "Domaine d etudes"},
                    "graduation_year": {"type": "integer", "description": "Annee de diplome"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_skills_market",
            "description": (
                "Consulte la base de données des compétences du marché africain : "
                "niveaux de demande, taux de croissance, salaires moyens, rôles associés. "
                "À utiliser pour comparer le profil de l'étudiant aux besoins du marché."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "domain": {
                        "type": "string",
                        "description": "Domaine à filtrer (ex: 'tech', 'finance', 'marketing'). Laisser vide pour tout.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Nombre maximum de résultats (défaut: 10, max: 20)",
                        "default": 10,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_gap_analysis",
            "description": (
                "Sauvegarde une analyse d'écart dans la base de données après avoir évalué le profil. "
                "À appeler une fois l'analyse complète : score global, compétences manquantes/faibles/fortes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "global_score": {"type": "integer", "description": "Score global de 0 a 100"},
                    "missing_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Competences manquantes a acquerir",
                    },
                    "weak_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Competences a renforcer",
                    },
                    "strong_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Points forts identifies",
                    },
                    "estimated_weeks": {
                        "type": "integer",
                        "description": "Semaines estimees pour combler les lacunes",
                    },
                    "target_role": {"type": "string", "description": "Role cible pour cette analyse"},
                },
                "required": ["global_score"],
            },
        },
    },
]

def generate_roadmap(
    student_id: str,
    target_role: str,
    profile_basis: str,
    prep_index_pct: int,
    total_duration_hours: int,
    quick_wins: list = None,
    core_skills: list = None,
    long_term: list = None,
    hard_skills_targeted: list = None,
    soft_skills_targeted: list = None,
    certifications_recommended: list = None,
    exercises: list = None,
    projects: list = None,
) -> tuple[str, dict | None]:
    """Génère une roadmap AiRoadmapV1, la sauvegarde dans Supabase et retourne le SSE side-effect."""
    from supabase_client import get_supabase

    roadmap_v1 = {
        "version": 1,
        "source": "stored",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "targetRole": str(target_role),
        "profileBasis": str(profile_basis),
        "prepIndexPct": max(0, min(100, int(prep_index_pct))),
        "totalHoursRecommended": int(total_duration_hours),
        "hardSkills": list(hard_skills_targeted or []),
        "softSkills": list(soft_skills_targeted or []),
        "certifications": list(certifications_recommended or []),
        "columns": [
            {
                "key": "quick_wins",
                "title": "Quick Wins",
                "icon": "bolt",
                "accent": "#10A37F",
                "items": [_item_to_card(i) for i in (quick_wins or [])],
            },
            {
                "key": "core",
                "title": "Core Skills",
                "icon": "target",
                "accent": "#6366F1",
                "items": [_item_to_card(i) for i in (core_skills or [])],
            },
            {
                "key": "long_term",
                "title": "Long Term",
                "icon": "rocket",
                "accent": "#F59E0B",
                "items": [_item_to_card(i) for i in (long_term or [])],
            },
        ],
        "exercises": [_exercise_to_card(e) for e in (exercises or [])],
        "projects": [_project_to_card(p) for p in (projects or [])],
    }

    # Persist in Supabase if available
    try:
        sb = get_supabase()
        sb.table("student_profiles").update({"roadmap_json": roadmap_v1}).eq("id", student_id).execute()
    except Exception:
        pass

    result = json.dumps({"ok": True}, ensure_ascii=False)
    return result, {"type": "roadmap", "data": roadmap_v1}


# ── generate_roadmap tool definition ─────────────────────────────────────────

_ROADMAP_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "platform": {
            "type": "string",
            "description": "Nom de la plateforme en MAJUSCULES : COURSERA, UDEMY, YOUTUBE, KAGGLE, GOOGLE, MICROSOFT, AWS, LINKEDIN, DATACAMP, EDX, FREECODECAMP, META, IBM, UDACITY, DEEPLEARNING, PLURALSIGHT ou autre",
        },
        "title": {"type": "string", "description": "Titre exact du cours ou de la certification"},
        "url": {
            "type": "string",
            "description": "URL directe et reelle du cours (ex: https://www.coursera.org/learn/machine-learning). OBLIGATOIRE — ne pas inventer.",
        },
        "duration_hours": {"type": "integer", "description": "Duree estimee en heures"},
        "cost": {
            "type": "string",
            "enum": ["free", "paid", "audit"],
            "description": "free = gratuit, paid = payant, audit = gratuit en mode audit",
        },
        "is_certification": {
            "type": "boolean",
            "description": "True si c'est une certification reconnue (affichage special)",
        },
        "certification_subtitle": {
            "type": "string",
            "description": "Sous-titre affiche sur la carte certification (ex: 'Reconnue internationalement')",
        },
        "highlight": {"type": "boolean", "description": "Mettre en evidence avec un bord vert (recommandations prioritaires)"},
    },
    "required": ["platform", "title", "url", "duration_hours", "cost"],
}

_EXERCISE_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Nom de la ressource ou du set d'exercices"},
        "platform": {
            "type": "string",
            "description": "Plateforme en MAJUSCULES : LEETCODE, EXERCISM, HACKERRANK, CODEWARS, FREECODECAMP, KAGGLE, PROJECTEULER, FRONTENDMENTOR, CSSBATTLE, etc.",
        },
        "url": {"type": "string", "description": "URL directe et reelle vers les exercices. OBLIGATOIRE."},
        "description": {"type": "string", "description": "Ce que l'etudiant va pratiquer concretement (1-2 phrases specifiques)"},
        "difficulty": {
            "type": "string",
            "enum": ["debutant", "intermediaire", "avance"],
            "description": "Niveau de difficulte de l'exercice",
        },
    },
    "required": ["title", "platform", "url", "description", "difficulty"],
}

_PROJECT_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Titre court et accrocheur du projet"},
        "description": {
            "type": "string",
            "description": "Description detaillee : ce que le projet fait, les etapes principales, ce qu'il apporte (3-5 phrases)",
        },
        "skills_used": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Competences techniques mises en pratique dans ce projet",
        },
        "difficulty": {
            "type": "string",
            "enum": ["debutant", "intermediaire", "avance"],
            "description": "Niveau de difficulte du projet",
        },
        "inspiration_url": {
            "type": "string",
            "description": "URL d'inspiration ou de tutoriel associe (roadmap.sh, GitHub, article, etc.) — optionnel mais recommande",
        },
    },
    "required": ["title", "description", "skills_used", "difficulty"],
}

DB_TOOLS.append({
    "type": "function",
    "function": {
        "name": "generate_roadmap",
        "description": (
            "Genere et sauvegarde une roadmap de formation personnalisee et detaillee. "
            "A appeler quand l'etudiant a confirme vouloir une roadmap et que tu as suffisamment d'informations. "
            "REGLES IMPORTANTES : "
            "(1) Chaque cours DOIT avoir une URL reelle et valide — ne jamais inventer une URL. "
            "(2) Inclure une section 'exercises' avec des liens vers des plateformes de pratique (LeetCode, Exercism, etc.). "
            "(3) Inclure une section 'projects' avec 2-4 projets concrets a realiser pour le portfolio. "
            "(4) S'inspirer de roadmap.sh pour la structure des competences a maitriser. "
            "Ressources mondiales uniquement : Coursera, Udemy, YouTube, freeCodeCamp, Kaggle, Google, Microsoft, etc. "
            "Apres l'appel, informe l'etudiant que sa roadmap est visible dans l'onglet 'Progression'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target_role": {"type": "string", "description": "Titre du poste cible (ex: Data Analyst, Developpeur Full-Stack)"},
                "profile_basis": {
                    "type": "string",
                    "description": "1-2 phrases resumant le profil de l'etudiant",
                },
                "prep_index_pct": {
                    "type": "integer",
                    "description": "Niveau de preparation de 0 a 100 (0=debutant, 100=pret)",
                },
                "total_duration_hours": {
                    "type": "integer",
                    "description": "Duree totale estimee de la formation en heures",
                },
                "hard_skills_targeted": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Competences techniques a acquerir dans l'ordre logique (Python, SQL, Docker...)",
                },
                "soft_skills_targeted": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Competences comportementales a developper",
                },
                "certifications_recommended": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Certifications recommandees (Google Data Analytics, AWS Cloud Practitioner...)",
                },
                "quick_wins": {
                    "type": "array",
                    "items": _ROADMAP_ITEM_SCHEMA,
                    "description": "2-4 ressources courtes (<15h) pour demarrer rapidement. URL reelle OBLIGATOIRE pour chaque item.",
                },
                "core_skills": {
                    "type": "array",
                    "items": _ROADMAP_ITEM_SCHEMA,
                    "description": "3-5 formations fondamentales de niveau intermediaire. URL reelle OBLIGATOIRE pour chaque item.",
                },
                "long_term": {
                    "type": "array",
                    "items": _ROADMAP_ITEM_SCHEMA,
                    "description": "2-3 certifications avancees pour le long terme. URL reelle OBLIGATOIRE pour chaque item.",
                },
                "exercises": {
                    "type": "array",
                    "items": _EXERCISE_ITEM_SCHEMA,
                    "description": (
                        "3-5 ressources de pratique avec exercices. "
                        "Exemples : LeetCode (algo), Exercism (langages), HackerRank, Codewars, freeCodeCamp challenges, "
                        "Kaggle competitions, Frontend Mentor (frontend). URL reelle OBLIGATOIRE."
                    ),
                },
                "projects": {
                    "type": "array",
                    "items": _PROJECT_ITEM_SCHEMA,
                    "description": (
                        "2-4 projets concrets a realiser pour construire le portfolio. "
                        "Chaque projet doit etre specifique, realisable et pertinent pour le role cible. "
                        "S'inspirer de roadmap.sh/projects ou project-based-learning sur GitHub."
                    ),
                },
            },
            "required": ["target_role", "profile_basis", "prep_index_pct", "total_duration_hours"],
        },
    },
})

# Map name → function for dispatch
DB_TOOL_FUNCTIONS = {
    "get_student_context": get_student_context,
    "save_cv_skills": save_cv_skills,
    "get_skills_market": get_skills_market,
    "save_gap_analysis": save_gap_analysis,
    "generate_roadmap": generate_roadmap,
}
