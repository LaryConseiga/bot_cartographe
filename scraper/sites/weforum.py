"""
Source : rapport PDF du Forum économique mondial (WEF).
Stratégie : téléchargement du PDF public, extraction pages 10–100 via pdfplumber,
comptage de mots-clés compétences prédéfinis, UPSERT direct dans skills_market
(sans passer par raw_jobs).
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import os
import re
import tempfile
from datetime import datetime, timezone
from typing import Optional

import pdfplumber
import requests

from db import close_scraper_run, log_scraper_run, upsert_skill

SOURCE = "weforum_pdf"

# Rapport public type « Future of Jobs » (à ajuster si l’URL change).
WEF_PDF_URL = (
    "https://www3.weforum.org/docs/WEF_Future_of_Jobs_Report_2023.pdf"
)

# ~30 compétences → domaine WEF-like agrégé
SKILL_DOMAIN: list[tuple[str, str]] = [
    ("machine learning", "Data & IA"),
    ("artificial intelligence", "Data & IA"),
    ("big data", "Data & IA"),
    ("data analysis", "Data & IA"),
    ("cloud computing", "Data & IA"),
    ("programming", "Data & IA"),
    ("software", "Data & IA"),
    ("cybersecurity", "Data & IA"),
    ("digital literacy", "Data & IA"),
    ("project management", "Management"),
    ("leadership", "Management"),
    ("people management", "Management"),
    ("resource management", "Management"),
    ("quality control", "Management"),
    ("networking", "Communication"),
    ("communication", "Communication"),
    ("customer service", "Communication"),
    ("sales", "Communication"),
    ("marketing", "Communication"),
    ("negotiation", "Communication"),
    ("critical thinking", "Pensée critique"),
    ("problem solving", "Pensée critique"),
    ("analytical thinking", "Pensée critique"),
    ("creativity", "Pensée critique"),
    ("resilience", "Pensée critique"),
    ("curiosity", "Pensée critique"),
    ("renewable energy", "Green skills"),
    ("environmental stewardship", "Green skills"),
    ("climate change", "Green skills"),
    ("sustainability", "Green skills"),
    ("green", "Green skills"),
]


def _demand_level(count: int) -> str:
    if count >= 8:
        return "high"
    if count >= 3:
        return "medium"
    return "low"


def _download_pdf(url: str, dest: str) -> None:
    r = requests.get(url, timeout=120, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)


def _extract_text_pages(path: str, start: int, end: int) -> str:
    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        n = len(pdf.pages)
        hi = min(end, n)
        lo = max(1, start)
        for i in range(lo - 1, hi):
            try:
                t = pdf.pages[i].extract_text() or ""
            except Exception:
                t = ""
            parts.append(t)
    return "\n".join(parts)


def _count_skills(text: str) -> dict[str, int]:
    lower = text.lower()
    counts: dict[str, int] = {}
    for phrase, _domain in SKILL_DOMAIN:
        # comptage non chevauchant simplifié : occurrences du sous-texte
        pattern = re.escape(phrase)
        counts[phrase] = len(re.findall(pattern, lower))
    return counts


def scrape(run_by: str = "default_owner") -> None:
    run_id = log_scraper_run(SOURCE, run_by)
    inserted = skipped = 0
    status = "completed"
    err_msg: Optional[str] = None
    jobs_found = 0

    try:
        tmp_dir = tempfile.gettempdir()
        pdf_path = os.path.join(tmp_dir, "wef_future_of_jobs.pdf")
        _download_pdf(WEF_PDF_URL, pdf_path)
        raw_text = _extract_text_pages(pdf_path, 10, 100)
        counts = _count_skills(raw_text)
        jobs_found = sum(1 for v in counts.values() if v > 0)
        now = datetime.now(timezone.utc).isoformat()

        for phrase, domain in SKILL_DOMAIN:
            c = counts.get(phrase, 0)
            if c == 0:
                skipped += 1
                continue
            skill_key = phrase
            payload = {
                "skill": skill_key,
                "normalized_name": phrase.title(),
                "domain": domain,
                "frequency": c,
                "demand_level": _demand_level(c),
                "growth_rate": None,
                "top_roles": None,
                "regions": None,
                "is_trending": c >= 8,
                "last_updated": now,
            }
            upsert_skill(payload)
            inserted += 1
            print(f"✅ skill_market upsert: {skill_key[:40]} (n={c})")
    except Exception as e:
        status = "error"
        err_msg = str(e)
        raise
    finally:
        close_scraper_run(run_id, inserted, skipped, status, err_msg, jobs_found=jobs_found)


if __name__ == "__main__":
    scrape()
