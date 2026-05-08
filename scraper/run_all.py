"""
Orchestrateur : lance les scrapers selon le développeur (CLI), puis extractor puis aggregator.
Planification APScheduler : chaque lundi 6h00.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import argparse
from typing import Callable

from apscheduler.schedulers.blocking import BlockingScheduler

from pipeline.aggregator import run_aggregator
from pipeline.extractor import run_extractor
from sites import afrique_it, cd_emploi, emploi_bf, emploi_ci, malivore, senjob, talent_com, weforum

ScraperFn = Callable[[str], None]

SCRAPERS: dict[str, list[ScraperFn]] = {
    "mathieu": [
        afrique_it.scrape,
        talent_com.scrape,
        weforum.scrape,
    ],
    "coequipier": [
        emploi_bf.scrape,
        senjob.scrape,
        emploi_ci.scrape,
        cd_emploi.scrape,
        malivore.scrape,
    ],
}


def run_pipeline(owner: str) -> None:
    key = owner.strip().lower()
    scrapers = SCRAPERS.get(key)
    if not scrapers:
        print(f"Propriétaire inconnu: {owner}. Utilisez: {', '.join(SCRAPERS)}")
        sys.exit(1)

    for fn in scrapers:
        try:
            fn(key)
        except Exception as e:
            print(f"⚠️ Scraper {fn.__module__} en erreur (poursuite du pipeline): {e}")

    try:
        run_extractor()
    except Exception as e:
        print(f"⚠️ Extractor en erreur: {e}")

    try:
        run_aggregator()
    except Exception as e:
        print(f"⚠️ Aggregator en erreur: {e}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pipeline Cartographe — scrapers + LLM + agrégation")
    parser.add_argument("owner", help="mathieu ou coequipier")
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Activer le cron hebdomadaire (lundi 6h) au lieu d’un seul run immédiat",
    )
    args = parser.parse_args()

    if args.schedule:
        sched = BlockingScheduler()
        sched.add_job(
            lambda: run_pipeline(args.owner),
            trigger="cron",
            day_of_week="mon",
            hour=6,
            minute=0,
        )
        print("Scheduler démarré : chaque lundi 6h00.")
        sched.start()
    else:
        run_pipeline(args.owner)


if __name__ == "__main__":
    main()
