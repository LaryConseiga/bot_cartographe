"""
Agrégateur : parcourt structured_jobs, compte les compétences (hard_skills + tools),
calcule demand_level et is_trending relatifs, UPSERT dans skills_market.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from collections import Counter
from datetime import datetime, timezone

from db import fetch_all_structured_jobs, upsert_skill


def _normalize_skill(name: str) -> str:
    return " ".join(name.strip().lower().split())


def run_aggregator() -> None:
    rows = fetch_all_structured_jobs()
    counter: Counter[str] = Counter()

    for row in rows:
        for key in ("hard_skills", "tools"):
            vals = row.get(key) or []
            if not isinstance(vals, list):
                continue
            for s in vals:
                if not s:
                    continue
                key_skill = _normalize_skill(str(s))
                if key_skill:
                    counter[key_skill] += 1

    total = sum(counter.values())
    if total == 0:
        print("Aucune compétence à agréger.")
        return

    now = datetime.now(timezone.utc).isoformat()

    for skill, freq in counter.items():
        ratio = freq / total
        if ratio > 0.25:
            demand = "high"
        elif ratio > 0.08:
            demand = "medium"
        else:
            demand = "low"
        trending = ratio > 0.20

        payload = {
            "skill": skill,
            "normalized_name": skill.title(),
            "domain": "Marché agrégé",
            "frequency": freq,
            "demand_level": demand,
            "growth_rate": None,
            "top_roles": None,
            "regions": ["Afrique de l'Ouest"],
            "is_trending": trending,
            "last_updated": now,
        }
        upsert_skill(payload)
        print(f"✅ upsert skill: {skill[:50]} freq={freq} demand={demand}")


if __name__ == "__main__":
    run_aggregator()
