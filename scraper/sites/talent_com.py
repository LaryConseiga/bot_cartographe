"""
Source : fr.talent.com (recherche multi-pays BF, SN, CI, ML, TG, BJ).
Stratégie : BeautifulSoup sur résultats de recherche par pays ; délai strict de 4 s
entre les pages pour limiter le risque de rate-limit.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import time
import urllib.parse
from datetime import date
from typing import Optional

import requests

from db import close_scraper_run, insert_job, log_scraper_run
from utils import clean_text, get_page, make_absolute

BASE = "https://fr.talent.com"
SOURCE = "fr.talent.com"

COUNTRY_QUERIES: dict[str, tuple[str, str]] = {
    "Burkina Faso": ("BF", "Afrique de l'Ouest"),
    "Sénégal": ("SN", "Afrique de l'Ouest"),
    "Côte d'ivoire": ("CI", "Afrique de l'Ouest"),
    "Mali": ("ML", "Afrique de l'Ouest"),
    "Togo": ("TG", "Afrique de l'Ouest"),
    "Bénin": ("BJ", "Afrique de l'Ouest"),
}


def _extract_cards(soup, list_url: str) -> list[tuple[str, str, str, str]]:
    cards = (
        soup.select(".job-item")
        or soup.select(".card__job")
        or soup.select("article")
        or soup.select("[data-testid='job-card']")
        or soup.select(".joblist__item")
    )
    out: list[tuple[str, str, str, str]] = []
    for c in cards:
        a = c.select_one("a[href]")
        if not a:
            continue
        url = make_absolute(a.get("href", ""), list_url)
        title = clean_text(a.get_text(), 500)
        company_el = c.select_one(".card__company, .company, [class*='company']")
        loc_el = c.select_one(".card__location, .location, [class*='location']")
        company = clean_text(company_el.get_text() if company_el else "", 300)
        loc = clean_text(loc_el.get_text() if loc_el else "", 300)
        if title and url and ("/job/" in url or "jobid" in url.lower() or "view" in url.lower()):
            out.append((url, title, company, loc))
        elif title and url and "talent.com" in url:
            out.append((url, title, company, loc))
    if not out:
        for a in soup.select("a[href*='job'], a[href*='offre']"):
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
        for place, (country, region) in COUNTRY_QUERIES.items():
            l_param = urllib.parse.quote(place)
            page = 1
            while page <= 60:
                list_url = f"{BASE}/jobs?l={l_param}&p={page}"
                soup = get_page(list_url, session=session)
                if not soup:
                    break
                cards = _extract_cards(soup, list_url)
                if not cards:
                    break
                found += len(cards)

                for job_url, title, company, location in cards:
                    card_soup = get_page(job_url, session=session)
                    desc = ""
                    if card_soup:
                        d = (
                            card_soup.select_one(".job-description")
                            or card_soup.select_one(".description")
                            or card_soup.select_one("section")
                        )
                        desc = clean_text(d.get_text() if d else card_soup.get_text(), 8000)
                    if len(desc) < 100:
                        time.sleep(1.0)
                        s2 = get_page(job_url, session=session)
                        if s2:
                            desc = clean_text(s2.get_text(), 8000)

                    job = {
                        "source": SOURCE,
                        "scraped_by": run_by,
                        "url": job_url,
                        "title": title,
                        "company": company or None,
                        "location": location or place,
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
                time.sleep(4.0)
    except Exception as e:
        status = "error"
        err_msg = str(e)
        raise
    finally:
        close_scraper_run(run_id, inserted, skipped, status, err_msg, jobs_found=found)


if __name__ == "__main__":
    scrape()
