"""
Extraction structurée : lit raw_jobs non traités, envoie la description à Mistral
via LangChain, insère structured_jobs et met à jour raw_jobs (secteur, type de contrat).
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_mistralai.chat_models import ChatMistralAI

from db import get_client, get_pending_jobs, insert_structured, mark_processed

load_dotenv()

SYSTEM_INSTRUCTION = """Tu es un extracteur de données pour offres d'emploi.
Réponds UNIQUEMENT avec un objet JSON valide UTF-8, sans markdown, sans texte avant ou après.
Clés obligatoires : hard_skills (tableau de chaînes), soft_skills (tableau), tools (tableau),
certifications (tableau), experience_years (chaîne ou null), education_level (chaîne ou null),
contract_type (chaîne ou null), sector (chaîne ou null).
Les tableaux vides sont autorisés. Utilise le français pour les libellés quand c'est naturel."""


def _parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Extraction défensive : récupérer le premier objet JSON { ... } si du texte parasite apparaît
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise
        return json.loads(m.group(0))


def run_extractor(batch_limit: int = 50) -> None:
    mistral_key = os.environ.get("MISTRAL_API_KEY")
    hf_token = os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    hf_model = os.environ.get("HF_MODEL_ID") or "mistralai/Mistral-7B-Instruct-v0.3"

    llm = None
    hf_client = None

    if mistral_key:
        llm = ChatMistralAI(
            api_key=mistral_key,
            model="mistral-small",
            temperature=0,
        )
    elif hf_token:
        hf_client = InferenceClient(token=hf_token)
    else:
        raise RuntimeError("Configurez MISTRAL_API_KEY ou HUGGINGFACEHUB_API_TOKEN (et optionnellement HF_MODEL_ID).")

    pending = get_pending_jobs(limit=batch_limit)
    client = get_client()

    for job in pending:
        jid = job["id"]
        title = (job.get("title") or "")[:45]
        desc = job.get("raw_description") or ""
        desc = desc[:2500]

        user_content = (
            f"Titre: {job.get('title')}\n"
            f"Entreprise: {job.get('company')}\n"
            f"Lieu: {job.get('location')}\n"
            f"Description:\n{desc}"
        )

        try:
            if llm is not None:
                msg = llm.invoke(
                    [
                        SystemMessage(content=SYSTEM_INSTRUCTION),
                        HumanMessage(content=user_content),
                    ]
                )
                raw_out = msg.content if hasattr(msg, "content") else str(msg)
            else:
                # Hugging Face Inference API (chat completions)
                assert hf_client is not None
                resp = hf_client.chat_completion(
                    model=hf_model,
                    messages=[
                        {"role": "system", "content": SYSTEM_INSTRUCTION},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=0,
                    max_tokens=700,
                )
                raw_out = resp.choices[0].message.content
            data = _parse_json_object(raw_out)
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            print(f"⚠️ JSON invalide pour job {jid}: {e}")
            mark_processed(jid)
            continue
        except Exception as e:
            print(f"⚠️ Erreur LLM job {jid}: {e}")
            mark_processed(jid)
            continue

        hard = data.get("hard_skills") or []
        soft = data.get("soft_skills") or []
        tools = data.get("tools") or []
        certs = data.get("certifications") or []
        if not isinstance(hard, list):
            hard = []
        if not isinstance(soft, list):
            soft = []
        if not isinstance(tools, list):
            tools = []
        if not isinstance(certs, list):
            certs = []

        structured = {
            "raw_job_id": jid,
            "hard_skills": [str(x) for x in hard],
            "soft_skills": [str(x) for x in soft],
            "tools": [str(x) for x in tools],
            "certifications": [str(x) for x in certs],
            "experience_years": data.get("experience_years"),
            "education_level": data.get("education_level"),
            "extracted_by": ("mistral-small" if mistral_key else f"hf:{hf_model}"),
        }

        insert_structured(structured)

        update_payload: dict[str, Any] = {}
        if data.get("sector"):
            update_payload["sector"] = str(data["sector"])
        if data.get("contract_type"):
            update_payload["contract_type"] = str(data["contract_type"])
        if update_payload:
            client.table("raw_jobs").update(update_payload).eq("id", jid).execute()

        mark_processed(jid)
        print(f"✅ {title} → {len(structured['hard_skills'])} hard skills")


if __name__ == "__main__":
    run_extractor()
