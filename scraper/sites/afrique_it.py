"""
Source : afrique-it.net (annonces IT pan-africaines).
Stratégie : BS4 sur listes et fiches ; pays et région via guess_country() sur
titre + description (fallback Afrique si indéterminé).
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
from utils import clean_text, get_page, guess_country, make_absolute

BASE = "https://www.afrique-it.net"
SOURCE = "afrique-it.net"


def _extract_cards(soup, list_url: str) -> list[tuple[str, str, str, str]]:
    cards = (
        soup.select(".job-item")
        or soup.select(".offre")
        or soup.select("article")
        or soup.select(".post")
        or soup.select(".listing")
    )
    out: list[tuple[str, str, str, str]] = []
    for c in cards:
        a = c.select_one("a[href]")
        if not a:
            continue
        url = make_absolute(a.get("href", ""), list_url)
        title = clean_text(a.get_text(), 500)
        company_el = c.select_one(".company, .employer, .author")
        loc_el = c.select_one(".location, .lieu")
        company = clean_text(company_el.get_text() if company_el else "", 300)
        loc = clean_text(loc_el.get_text() if loc_el else "", 300)
        if title and url:
            out.append((url, title, company, loc))
    if not out:
        for a in soup.select("a[href*='emploi'], a[href*='job'], a[href*='offre'], a[href*='recrut']"):
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
        for page in range(1, 100):
            list_urls = [
                f"{BASE}/page/{page}/",
                f"{BASE}/jobs/page/{page}/",
                f"{BASE}/?paged={page}",
            ]
            soup = None
            list_url = list_urls[0]
            for candidate in list_urls:
                soup = get_page(candidate, session=session)
                if soup:
                    list_url = candidate
                    break
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
                        card_soup.select_one(".entry-content")
                        or card_soup.select_one(".job-description")
                        or card_soup.select_one("article")
                    )
                    desc = clean_text(d.get_text() if d else card_soup.get_text(), 8000)
                if len(desc) < 100:
                    time.sleep(1.0)
                    s2 = get_page(job_url, session=session)
                    if s2:
                        desc = clean_text(s2.get_text(), 8000)

                blob = f"{title} {location} {desc}"
                country, region = guess_country(blob)
                if not country:
                    country = None
                if not region:
                    region = "Afrique"

                job = {
                    "source": SOURCE,
                    "scraped_by": run_by,
                    "url": job_url,
                    "title": title,
                    "company": company or None,
                    "location": location or None,
                    "country": country,
                    "region": region,
                    "sector": "IT",
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

            time.sleep(2.0)
    except Exception as e:
        status = "error"
        err_msg = str(e)
        raise
    finally:
        close_scraper_run(run_id, inserted, skipped, status, err_msg, jobs_found=found)


if __name__ == "__main__":
    scrape()
