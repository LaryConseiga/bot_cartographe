from pathlib import Path
import inspect
import json
import os
import re

def _manual_load_dotenv(path: Path, *, override: bool) -> bool:
    """Lit KEY=VALUE sans dépendre de python-dotenv (UTF-8 avec BOM supporté)."""
    if not path.is_file():
        return False
    try:
        raw = path.read_text(encoding="utf-8-sig")
    except OSError:
        return False
    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if "=" not in s:
            continue
        key, _, val = s.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if not key:
            continue
        if not override and os.environ.get(key, "").strip():
            continue
        os.environ[key] = val
    return True


def _load_env_files() -> None:
    here = Path(__file__).resolve().parent
    root = here.parent
    loaded: list[str] = []
    for path, override in ((root / ".env", False), (here / ".env", True)):
        if _manual_load_dotenv(path, override=override):
            loaded.append(str(path))
    try:
        from dotenv import load_dotenv
        for path, override in ((root / ".env", False), (here / ".env", True)):
            if path.is_file():
                load_dotenv(path, override=override)
    except ImportError:
        pass
    if loaded:
        print("[env] .env chargés :", " puis ".join(loaded))
    elif not (root / ".env").is_file() and not (here / ".env").is_file():
        print("[env] Aucun .env à la racine du repo ni dans llm/ — ajoute GROQ_API_KEY dans l'un des deux.")


_load_env_files()


def _read_groq_key() -> str:
    for name in ("GROQ_API_KEY", "GROQ_KEY", "GROQ_TOKEN"):
        v = os.environ.get(name, "").strip()
        if v:
            return v
    return ""

from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from groq import Groq
from tavily import TavilyClient

from cv_pdf.render import render_tex, render_letter_tex, compile_pdf, CvPdfCompileError
from cv_match_core import run_cv_match

# ── Supabase DB tools (optionnel — désactivé si supabase n'est pas installé) ──
try:
    from db_tools import DB_TOOLS, DB_TOOL_FUNCTIONS
    from supabase_client import get_supabase
    DB_TOOLS_AVAILABLE = True
except ImportError:
    DB_TOOLS = []
    DB_TOOL_FUNCTIONS = {}
    DB_TOOLS_AVAILABLE = False
    print("[env] supabase non installé — outils DB désactivés. Lance : pip install supabase>=2.0")

app = Flask(__name__)

_cors_raw = os.environ.get(
    "FLASK_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
)
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
CORS(app, resources={r"/*": {"origins": _cors_origins or "*"}})

GROQ_API_KEY = _read_groq_key()
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "").strip()

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

# === Loader de skills ===
SKILLS_DIR = Path(__file__).parent / "skills"
SKILLS_CACHE = {}


def load_skill(name: str) -> str:
    if name in SKILLS_CACHE:
        return SKILLS_CACHE[name]
    path = SKILLS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Skill introuvable : {path}")
    raw = path.read_text(encoding="utf-8")
    body = re.sub(r"^---\s*\n.*?\n---\s*\n", "", raw, count=1, flags=re.DOTALL).strip()
    SKILLS_CACHE[name] = body
    return body


def list_skills() -> list:
    if not SKILLS_DIR.exists():
        return []
    return sorted(p.stem for p in SKILLS_DIR.glob("*.md"))


# === Outils Groq ===

_TAVILY_TOOL = {
    "type": "function",
    "function": {
        "name": "tavily_search",
        "description": (
            "Recherche des informations à jour sur le web. "
            "À utiliser pour : données salariales locales en Afrique de l'Ouest, "
            "offres d'emploi actuelles, formations certifiantes, vérification "
            "d'informations sur entreprises/écoles africaines, statistiques marché emploi. "
            "Ne pas utiliser pour les conversations générales."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Requête de recherche en français, précise et ciblée.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Nombre de résultats (entre 3 et 8, défaut 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
}


def _build_tools() -> list:
    tools = []
    if tavily_client:
        tools.append(_TAVILY_TOOL)
    if DB_TOOLS_AVAILABLE:
        tools.extend(DB_TOOLS)
    return tools


TOOLS = _build_tools()


def execute_tool_call(tool_name: str, arguments: dict, student_id: str = "") -> tuple[str, dict | None]:
    """
    Exécute un appel d'outil.
    Retourne (result_json_string, sse_side_effect_or_None).
    Le side-effect sera émis comme événement SSE supplémentaire avant de continuer la boucle.
    """
    if tool_name == "tavily_search":
        if not tavily_client:
            return json.dumps({"error": "Recherche web non configurée (TAVILY_API_KEY)."}, ensure_ascii=False), None
        query = arguments.get("query", "")
        max_results = min(max(arguments.get("max_results", 5), 3), 8)
        try:
            response = tavily_client.search(
                query=query,
                max_results=max_results,
                search_depth="basic",
                include_answer=True,
            )
            results = [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", "")[:500],
                }
                for r in response.get("results", [])
            ]
            return json.dumps({"answer": response.get("answer", ""), "results": results}, ensure_ascii=False), None
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False), None

    if tool_name in DB_TOOL_FUNCTIONS:
        if not DB_TOOLS_AVAILABLE:
            return json.dumps({"error": "Outils base de données non disponibles."}, ensure_ascii=False), None
        fn = DB_TOOL_FUNCTIONS[tool_name]
        if "student_id" in inspect.signature(fn).parameters and student_id:
            arguments = {**(arguments if isinstance(arguments, dict) else {}), "student_id": student_id}
        try:
            result = fn(**arguments)
            # generate_roadmap returns (str, dict|None); other tools return str
            if isinstance(result, tuple):
                return result
            return result, None
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False), None

    return json.dumps({"error": f"Outil inconnu : {tool_name}"}, ensure_ascii=False), None


def _build_student_context_block(student_id: str) -> str:
    """Charge le contexte étudiant depuis Supabase et le formate pour le system prompt."""
    if not DB_TOOLS_AVAILABLE or not student_id:
        return ""
    try:
        from db_tools import get_student_context
        raw = get_student_context(student_id)
        ctx = json.loads(raw)
        if "error" in ctx:
            return ""
        profile = ctx.get("profile") or {}
        skills = ctx.get("skills") or []
        gap = ctx.get("latest_gap_report")

        lines = ["\n---", "Contexte étudiant (base de données) :"]
        if profile.get("full_name"):
            lines.append(f"Nom : {profile['full_name']}")
        if profile.get("country"):
            lines.append(f"Pays : {profile['country']}")
        if profile.get("city"):
            lines.append(f"Ville : {profile['city']}")
        if profile.get("field_of_study"):
            lines.append(f"Domaine d'études : {profile['field_of_study']}")
        if profile.get("school"):
            lines.append(f"École : {profile['school']}")
        if profile.get("graduation_year"):
            lines.append(f"Année de diplôme : {profile['graduation_year']}")
        if profile.get("target_role"):
            lines.append(f"Poste ciblé : {profile['target_role']}")
        if profile.get("target_country"):
            lines.append(f"Pays cible : {profile['target_country']}")
        if profile.get("target_sector"):
            lines.append(f"Secteur cible : {profile['target_sector']}")

        if skills:
            hard = [s["skill"] for s in skills if s.get("source") == "cv_hard"]
            soft = [s["skill"] for s in skills if s.get("source") == "cv_soft"]
            tools_list = [s["skill"] for s in skills if s.get("source") == "cv_tool"]
            if hard:
                lines.append(f"Compétences techniques : {', '.join(hard)}")
            if soft:
                lines.append(f"Compétences comportementales : {', '.join(soft)}")
            if tools_list:
                lines.append(f"Outils maîtrisés : {', '.join(tools_list)}")

        if gap:
            lines.append(f"Dernière analyse — score : {gap.get('global_score')}/100")
            if gap.get("missing_skills"):
                lines.append(f"Lacunes identifiées : {', '.join(gap['missing_skills'])}")

        if len(lines) <= 2 and not profile.get("cv_text"):
            return ""

        if profile.get("cv_text"):
            lines.append(f"CV importé (texte complet) :\n{profile['cv_text'][:12000]}")

        lines.append("---\n")
        return "\n".join(lines)
    except Exception:
        return ""


# === Routes ===

@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/skills", methods=["GET"])
def skills_endpoint():
    return jsonify({"skills": list_skills()})


def _groq_completion_kwargs(messages, *, stream: bool):
    kw = dict(model=MODEL, messages=messages, temperature=0.7, max_tokens=1024, stream=stream)
    if TOOLS:
        kw["tools"] = TOOLS
        kw["tool_choice"] = "auto"
    return kw


_DB_TOOL_STATUS = {
    "get_student_context": "Apex consulte ton profil…",
    "save_cv_skills": "Apex enregistre tes compétences…",
    "get_skills_market": "Apex consulte les tendances du marché…",
    "save_gap_analysis": "Apex sauvegarde ton analyse…",
    "generate_roadmap": "Apex génère ta roadmap personnalisée…",
    "list_job_offers": "Apex consulte les offres publiées…",
    "match_cv_to_offer": "Apex compare ton profil à l'offre…",
    "generate_cv_document": "Apex met en forme ton CV…",
}


@app.route("/chat", methods=["POST"])
def chat():
    """
    Body : {
      "messages": [{"role":"user|assistant","content":"..."}],
      "stream": true,
      "skill": "apex_conversationalist",
      "cvText": "...",
      "student_id": "uuid-de-l-etudiant"
    }
    """
    try:
        if not groq_client:
            return jsonify({
                "error": (
                    "GROQ_API_KEY manquant. Ajoute GROQ_API_KEY=gsk_... dans bot_cartographe/.env "
                    "ou llm/.env, puis redémarre Flask."
                )
            }), 503

        data = request.get_json()
        messages = data.get("messages", [])
        skill_name = data.get("skill", "apex_conversationalist")
        cv_text = data.get("cvText") or data.get("cv_text") or ""
        student_id = (data.get("student_id") or "").strip()

        if not messages:
            return jsonify({"error": "Le champ 'messages' est requis"}), 400

        try:
            system_prompt = load_skill(skill_name)
        except FileNotFoundError as e:
            return jsonify({"error": str(e)}), 400

        # Injecter le contexte étudiant depuis Supabase (si student_id connu) — inclut le CV complet,
        # récupéré à chaque tour (pas seulement au moment de l'upload) pour qu'Apex ne "l'oublie" jamais.
        student_context_block = _build_student_context_block(student_id)
        cv_already_in_context = "CV importé (texte complet)" in student_context_block

        # Filet de sécurité : si le CV fourni dans la requête n'est pas déjà couvert par le contexte DB
        # (ex. student_id absent, ou écriture en base pas encore visible), on l'injecte quand même.
        if isinstance(cv_text, str) and cv_text.strip() and not cv_already_in_context:
            excerpt = cv_text.strip()[:12000]
            system_prompt = (
                system_prompt
                + "\n\n---\nContexte CV récent (extrait) :\n"
                + excerpt
                + "\n---\n"
            )

        if student_context_block:
            system_prompt = system_prompt + student_context_block

        # Injecter l'offre sélectionnée (bouton "Postuler") pour un grounding déterministe
        offer_context = data.get("offer_context")
        if isinstance(offer_context, dict) and offer_context.get("offerId"):
            system_prompt = system_prompt + (
                "\n\n---\nContexte offre sélectionnée par l'étudiant :\n"
                f"ID : {offer_context.get('offerId')}\n"
                f"Titre : {offer_context.get('title', '')}\n"
                f"Entreprise : {offer_context.get('company', '')}\n"
                f"Description : {str(offer_context.get('description', ''))[:3000]}\n"
                "---\n"
            )

        full_messages = [{"role": "system", "content": system_prompt}] + list(messages)

        def generate():
            current_messages = full_messages.copy()
            max_iterations = 5
            iteration = 0

            while iteration < max_iterations:
                iteration += 1

                try:
                    completion = groq_client.chat.completions.create(
                        **_groq_completion_kwargs(current_messages, stream=False)
                    )
                except Exception as e:
                    msg = str(e)
                    # Si Groq rejette l'appel d'outil (format invalide / unicode mal encodé)
                    # → retry en texte simple sans outils
                    if "tool_use_failed" in msg or "failed_generation" in msg:
                        try:
                            plain_stream = groq_client.chat.completions.create(
                                model=MODEL, messages=current_messages,
                                temperature=0.7, max_tokens=1024, stream=True
                            )
                            for chunk in plain_stream:
                                delta = chunk.choices[0].delta.content
                                if delta:
                                    yield f"data: {json.dumps({'token': delta})}\n\n"
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            return
                        except Exception:
                            pass
                    err = (
                        "Clé Groq invalide. Génère une nouvelle clé dans Groq et mets GROQ_API_KEY à jour."
                        if "invalid_api_key" in msg or "Invalid API Key" in msg
                        else (msg or "Erreur Groq")
                    )
                    yield f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    return

                resp_msg = completion.choices[0].message
                tool_calls = resp_msg.tool_calls or []

                if not tool_calls:
                    try:
                        final_stream = groq_client.chat.completions.create(
                            **_groq_completion_kwargs(current_messages, stream=True)
                        )
                        for chunk in final_stream:
                            delta = chunk.choices[0].delta.content
                            if delta:
                                yield f"data: {json.dumps({'token': delta})}\n\n"
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return
                    except Exception as e:
                        msg = str(e)
                        err = (
                            "Clé Groq invalide. Génère une nouvelle clé dans Groq et mets GROQ_API_KEY à jour."
                            if "invalid_api_key" in msg or "Invalid API Key" in msg
                            else (msg or "Erreur Groq")
                        )
                        yield f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n"
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return

                # Notifier le frontend du type d'outil utilisé
                for tc in tool_calls:
                    status_msg = _DB_TOOL_STATUS.get(
                        tc.function.name,
                        "Apex consulte les informations du marché…"
                    )
                    yield f"data: {json.dumps({'type': 'status', 'phase': 'search', 'message': status_msg}, ensure_ascii=False)}\n\n"

                # Ajouter le message assistant avec les tool_calls
                current_messages.append({
                    "role": "assistant",
                    "content": resp_msg.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ],
                })

                # Exécuter chaque outil
                for tc in tool_calls:
                    try:
                        parsed = json.loads(tc.function.arguments or "{}")
                        args = parsed if isinstance(parsed, dict) else {}
                    except (json.JSONDecodeError, TypeError):
                        args = {}
                    result_str, sse_side_effect = execute_tool_call(tc.function.name, args, student_id=student_id)
                    if sse_side_effect:
                        yield f"data: {json.dumps(sse_side_effect, ensure_ascii=False)}\n\n"
                    current_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_str,
                    })

            _sorry = json.dumps({"token": "Désolé, je n'ai pas pu finaliser ma réponse."}, ensure_ascii=False)
            yield f"data: {_sorry}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/summarize", methods=["POST"])
def summarize():
    try:
        if not groq_client:
            return jsonify({
                "error": (
                    "GROQ_API_KEY manquant. Ajoute GROQ_API_KEY=gsk_... dans bot_cartographe/.env "
                    "ou llm/.env, puis redémarre Flask."
                )
            }), 503

        data = request.get_json()
        messages = data.get("messages", [])
        skill_name = data.get("skill", "apex_summarizer")

        if not messages:
            return jsonify({"error": "Le champ 'messages' est requis"}), 400

        system_prompt = load_skill(skill_name)
        conversation_text = "\n".join(
            f"{m['role'].upper()} : {m['content']}" for m in messages
        )

        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Voici la conversation à résumer :\n\n{conversation_text}"},
            ],
            temperature=0.3,
            max_tokens=512,
        )
        return jsonify({"summary": response.choices[0].message.content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", (text or "").strip()).strip("_")
    return slug or "cv"


def _log_document_generation(student_id, doc_type: str, lang: str) -> None:
    """Log best-effort pour le dashboard admin — ne doit jamais faire échouer la génération du PDF."""
    if not DB_TOOLS_AVAILABLE or not student_id:
        return
    try:
        sb = get_supabase()
        sb.table("document_generations").insert({
            "student_id": student_id,
            "doc_type": doc_type,
            "lang": lang,
        }).execute()
    except Exception as e:
        print(f"[document_generations] log ignoré: {e}")


@app.route("/cv-match", methods=["POST"])
def cv_match():
    try:
        if not groq_client:
            return jsonify({
                "error": (
                    "GROQ_API_KEY manquant. Ajoute GROQ_API_KEY=gsk_... dans bot_cartographe/.env "
                    "ou llm/.env, puis redémarre Flask."
                )
            }), 503

        data = request.get_json() or {}
        cv_text = (data.get("cvText") or "").strip()
        job_offer_text = (data.get("jobOfferText") or "").strip()

        if not cv_text:
            return jsonify({"error": "Le champ 'cvText' est requis"}), 400
        if not job_offer_text:
            return jsonify({"error": "Le champ 'jobOfferText' est requis"}), 400

        try:
            parsed = run_cv_match(groq_client, MODEL, load_skill, cv_text, job_offer_text)
        except json.JSONDecodeError:
            return jsonify({
                "error": "Réponse du modèle invalide, réessaie."
            }), 502

        return jsonify({"match": parsed})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/generate-cv-pdf", methods=["POST"])
def generate_cv_pdf():
    try:
        data = request.get_json() or {}
        cv = data.get("cv")
        lang = data.get("lang")
        student_id = data.get("student_id")

        if lang not in ("fr", "en"):
            return jsonify({"error": "Le champ 'lang' doit être 'fr' ou 'en'"}), 400
        if not isinstance(cv, dict):
            return jsonify({"error": "Le champ 'cv' est requis"}), 400

        try:
            tex_source = render_tex(cv, lang)
            pdf_bytes = compile_pdf(tex_source)
        except CvPdfCompileError as e:
            print(f"[cv-pdf] échec de compilation: {e}\n{e.stderr_tail}")
            return jsonify({"error": str(e)}), 500

        _log_document_generation(student_id, "cv", lang)

        full_name = ((cv.get("personal_info") or {}).get("full_name")) or "cv"
        filename = f"CV_{_slugify(full_name)}_{lang}.pdf"

        return Response(
            pdf_bytes,
            mimetype="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/generate-letter-pdf", methods=["POST"])
def generate_letter_pdf():
    try:
        data = request.get_json() or {}
        personal_info = data.get("personal_info")
        company = data.get("company")
        location = data.get("location")
        paragraphs = data.get("paragraphs")
        lang = data.get("lang")
        student_id = data.get("student_id")

        if lang not in ("fr", "en"):
            return jsonify({"error": "Le champ 'lang' doit être 'fr' ou 'en'"}), 400
        if not isinstance(personal_info, dict):
            return jsonify({"error": "Le champ 'personal_info' est requis"}), 400
        if not isinstance(paragraphs, list) or not paragraphs:
            return jsonify({"error": "Le champ 'paragraphs' est requis"}), 400

        try:
            tex_source = render_letter_tex(personal_info, company, location, paragraphs, lang)
            pdf_bytes = compile_pdf(tex_source)
        except CvPdfCompileError as e:
            print(f"[letter-pdf] échec de compilation: {e}\n{e.stderr_tail}")
            return jsonify({"error": str(e)}), 500

        _log_document_generation(student_id, "letter", lang)

        full_name = personal_info.get("full_name") or "lettre"
        filename = f"Lettre_{_slugify(full_name)}_{lang}.pdf"

        return Response(
            pdf_bytes,
            mimetype="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "skills": list_skills(),
        "groq_configured": groq_client is not None,
        "tavily_configured": tavily_client is not None,
        "supabase_configured": DB_TOOLS_AVAILABLE,
        "model": MODEL,
    })


if __name__ == "__main__":
    _here = Path(__file__).resolve().parent
    _root = _here.parent
    print(f"[skills] Dossier : {SKILLS_DIR}")
    print(f"[skills] Disponibles : {list_skills()}")
    print(f"[tools] {[t['function']['name'] for t in TOOLS]}")
    if groq_client:
        print(f"[env] Groq OK — modèle {MODEL}")
    else:
        print(
            "[env] ERREUR : aucune clé Groq (GROQ_API_KEY / GROQ_KEY / GROQ_TOKEN). "
            "POST /chat → 503.",
        )
    if not tavily_client:
        print("[env] Tavily absent — recherche web désactivée.")
    if DB_TOOLS_AVAILABLE:
        print("[env] Supabase OK — outils DB activés.")
    else:
        print("[env] Supabase absent — lance : pip install supabase>=2.0")
    port = int(os.environ.get("PORT", 8007))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
