from pathlib import Path
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


# Racine du repo → llm/.env (ce dernier peut surcharger). Fonctionne même sans python-dotenv.
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
        print("[env] Aucun .env à la racine du repo ni dans llm/ — ajoute GROQ_API_KEY dans l’un des deux.")


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

app = Flask(__name__)

# Origines autorisées pour le front (Next) qui appelle /chat directement.
_cors_raw = os.environ.get(
    "FLASK_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
)
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
CORS(app, resources={r"/*": {"origins": _cors_origins or "*"}})

# === Clés API (variables d’environnement — ne pas committer de secrets) ===
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


# === Outils Groq (recherche web) — uniquement si Tavily est configuré ===
def _build_tools():
    if not tavily_client:
        return []
    return [
        {
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
                            "description": "Requête de recherche en français, précise et ciblée. "
                            "Ex: 'salaire data analyst Dakar Sénégal junior 2026'",
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
    ]


TOOLS = _build_tools()


def execute_tool_call(tool_name: str, arguments: dict) -> str:
    """Exécute un appel d'outil et renvoie le résultat sous forme de string JSON."""
    if tool_name == "tavily_search":
        if not tavily_client:
            return json.dumps({"error": "Recherche web non configurée (TAVILY_API_KEY)."}, ensure_ascii=False)
        query = arguments.get("query", "")
        max_results = min(max(arguments.get("max_results", 5), 3), 8)
        try:
            response = tavily_client.search(
                query=query,
                max_results=max_results,
                search_depth="basic",
                include_answer=True,
            )
            results = []
            for r in response.get("results", []):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", "")[:500],  # tronqué pour économiser tokens
                })
            return json.dumps({
                "answer": response.get("answer", ""),
                "results": results,
            }, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)
    return json.dumps({"error": f"Outil inconnu : {tool_name}"}, ensure_ascii=False)


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


@app.route("/chat", methods=["POST"])
def chat():
    """
    Body : {
      "messages": [{"role":"user|assistant","content":"..."}],
      "stream": true,
      "skill": "apex_conversationalist",
      "cvText": "..." (optionnel, injecté dans le prompt système)
    }
    """
    try:
        if not groq_client:
            return jsonify(
                {
                    "error": (
                        "GROQ_API_KEY manquant. Ajoute GROQ_API_KEY=gsk_... dans bot_cartographe/.env "
                        "ou llm/.env, puis redémarre Flask. Vérifie : pip install python-dotenv"
                    )
                }
            ), 503

        data = request.get_json()
        messages = data.get("messages", [])
        skill_name = data.get("skill", "apex_conversationalist")
        cv_text = data.get("cvText") or data.get("cv_text") or ""

        if not messages:
            return jsonify({"error": "Le champ 'messages' est requis"}), 400

        try:
            system_prompt = load_skill(skill_name)
        except FileNotFoundError as e:
            return jsonify({"error": str(e)}), 400

        if isinstance(cv_text, str) and cv_text.strip():
            excerpt = cv_text.strip()[:12000]
            system_prompt = (
                system_prompt
                + "\n\n---\nContexte CV récent (extrait) :\n"
                + excerpt
                + "\n---\n"
            )

        full_messages = [{"role": "system", "content": system_prompt}] + list(messages)

        def generate():
            """
            Boucle d'orchestration :
            1. Appel non-streaming pour détecter d'éventuels tool_calls
            2. Si tool_calls : exécuter, ajouter au contexte, recommencer
            3. Sinon (ou après exécution) : appel streaming pour générer la réponse finale
            """
            current_messages = full_messages.copy()
            max_iterations = 3  # garde-fou contre les boucles infinies
            iteration = 0

            while iteration < max_iterations:
                iteration += 1

                # Étape 1 : appel non-streaming pour voir si le LLM veut un outil
                try:
                    completion = groq_client.chat.completions.create(
                        **_groq_completion_kwargs(current_messages, stream=False)
                    )
                except Exception as e:
                    msg = str(e)
                    if "invalid_api_key" in msg or "Invalid API Key" in msg:
                        yield f"data: {json.dumps({'error': 'Clé Groq invalide (invalid_api_key). Génère une nouvelle clé dans Groq, mets GROQ_API_KEY à jour, puis redémarre llm.'}, ensure_ascii=False)}\n\n"
                    else:
                        yield f"data: {json.dumps({'error': msg or 'Erreur Groq'}, ensure_ascii=False)}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    return
                msg = completion.choices[0].message
                tool_calls = msg.tool_calls or []

                # Pas de tool call : on stream la réponse finale
                if not tool_calls:
                    # Si on a déjà du contenu généré, on peut le streamer artificiellement
                    # ou refaire un appel en streaming pour la fluidité
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
                        if "invalid_api_key" in msg or "Invalid API Key" in msg:
                            yield f"data: {json.dumps({'error': 'Clé Groq invalide (invalid_api_key). Génère une nouvelle clé dans Groq, mets GROQ_API_KEY à jour, puis redémarre llm.'}, ensure_ascii=False)}\n\n"
                        else:
                            yield f"data: {json.dumps({'error': msg or 'Erreur Groq'}, ensure_ascii=False)}\n\n"
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return

                # Tool call détecté : on notifie le frontend, on exécute, on reboucle
                yield f"data: {json.dumps({'type': 'status', 'phase': 'search', 'message': 'Apex consulte les informations du marché…'}, ensure_ascii=False)}\n\n"

                # Ajouter le message assistant avec les tool_calls au contexte
                current_messages.append({
                    "role": "assistant",
                    "content": msg.content or "",
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

                # Exécuter chaque tool call et ajouter les résultats
                for tc in tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                    result = execute_tool_call(tc.function.name, args)
                    current_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })

            # Si on sort de la boucle sans réponse finale
            yield f"data: {json.dumps({'token': 'Désolé, je n''ai pas pu finaliser la recherche.'})}\n\n"
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
            return jsonify(
                {
                    "error": (
                        "GROQ_API_KEY manquant. Ajoute GROQ_API_KEY=gsk_... dans bot_cartographe/.env "
                        "ou llm/.env, puis redémarre Flask. Vérifie : pip install python-dotenv"
                    )
                }
            ), 503

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


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "skills": list_skills(),
            "groq_configured": groq_client is not None,
            "tavily_configured": tavily_client is not None,
            "model": MODEL,
        }
    )


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
            "POST /chat → 503. Fichiers attendus :",
            _root / ".env",
            "ou",
            _here / ".env",
        )
    if not tavily_client:
        print("[env] Tavily absent (TAVILY_API_KEY) — recherche web désactivée, normal si non utilisé.")
    app.run(host="0.0.0.0", port=8007, debug=True)