"""
Source : senjob.com (multi-pays : SN, CI, BF, ML, TG, BJ).
Stratégie : boucle sur les chemins pays (/sn/, /ci/, …), listes statiques BS4,
pagination jusqu’à épuisement des cartes.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import time
from datetime import date
from typing import Optional

import requests

from db import close_scraper_run, insert_job, log_scraper_run
from utils import clean_text, get_page, make_absolute

BASE = "https://www.senjob.com"
SOURCE = "senjob.com"

COUNTRY_PATHS: dict[str, tuple[str, str]] = {
    "/sn/": ("SN", "Afrique de l'Ouest"),
    "/ci/": ("CI", "Afrique de l'Ouest"),
    "/bf/": ("BF", "Afrique de l'Ouest"),
    "/ml/": ("ML", "Afrique de l'Ouest"),
    "/tg/": ("TG", "Afrique de l'Ouest"),
    "/bj/": ("BJ", "Afrique de l'Ouest"),
}


def _list_url(path: str, page: int) -> str:
    p = path.rstrip("/")
    if page <= 1:
        return f"{BASE}{path}"
    return f"{BASE}{path}page/{page}/"


def _extract_cards(soup, list_url: str) -> list[tuple[str, str, str, str]]:
    cards = (
        soup.select(".job-item")
        or soup.select(".offre")
        or soup.select("article")
        or soup.select(".job-listing")
        or soup.select(".post")
    )
    out: list[tuple[str, str, str, str]] = []
    for c in cards:
        a = c.select_one("a[href]")
        if not a:
            continue
        url = make_absolute(a.get("href", ""), list_url)
        title = clean_text(a.get_text(), 500)
        company_el = c.select_one(".company, .employer, .societe")
        loc_el = c.select_one(".location, .lieu")
        company = clean_text(company_el.get_text() if company_el else "", 300)
        loc = clean_text(loc_el.get_text() if loc_el else "", 300)
        if title and url:
            out.append((url, title, company, loc))
    if not out:
        for a in soup.select("a[href*='emploi'], a[href*='job'], a[href*='offre']"):
            url = make_absolute(a.get("href", ""), list_url)
            t = clean_text(a.get_text(), 500)
            if t and url:
                out.append((url, t, "", ""))
    seen: set[str] = set()
    deduped = []
    for row in out:
        if row[0] in seen:
            continue
        seen.add(row[0])
        deduped.append(row)
    return deduped


def scrape(run_by: str = "default_owner") -> None:
    run_id = log_scraper_run(SOURCE, run_by)
    inserted = skipped = found = 0
    status = "completed"
    err_msg: Optional[str] = None
    session = requests.Session()

    try:
        for path, (country, region) in COUNTRY_PATHS.items():
            page = 1
            while page <= 100:
                url = _list_url(path, page)
                soup = get_page(url, session=session)
                if not soup:
                    break
                cards = _extract_cards(soup, url)
                if not cards:
                    break
                found += len(cards)

                for job_url, title, company, location in cards:
                    card_soup = get_page(job_url, session=session)
                    desc = ""
                    if card_soup:
                        d = (
                            card_soup.select_one(".job-description")
                            or card_soup.select_one(".entry-content")
                            or card_soup.select_one("article")
                        )
                        desc = clean_text(d.get_text() if d else card_soup.get_text(), 8000)
                    if len(desc) < 100:
                        time.sleep(1.0)
                        soup2 = get_page(job_url, session=session)
                        if soup2:
                            desc = clean_text(soup2.get_text(), 8000)

                    job = {
                        "source": SOURCE,
                        "scraped_by": run_by,
                        "url": job_url,
                        "title": title,
                        "company": company or None,
                        "location": location or None,
                        "country": country,
                        "region": region,
                        "sector": None,
                        "contract_type": None,
                        "raw_description": desc or clean_text(title, 3000),
                        "date_posted": str(date.today()),
                    }
                    if insert_job(job):
                        inserted += 1
                        print(f"✅ [{inserted}] {title[:55]}")
                    else:
                        skipped += 1
                    time.sleep(1.0)

                page += 1
                time.sleep(2.0)
    except Exception as e:
        status = "error"
        err_msg = str(e)
        raise
    finally:
        close_scraper_run(run_id, inserted, skipped, status, err_msg, jobs_found=found)


if __name__ == "__main__":
    scrape()
