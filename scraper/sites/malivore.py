"""
Source : malivore.com (Mali).
Stratégie : site petit — détection défensive des liens via JOB_LINK_KEYWORDS,
peu de sélecteurs spécifiques, pauses respectueuses.
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

BASE = "https://malivore.com"
SOURCE = "malivore.com"

JOB_LINK_KEYWORDS = (
    "emploi",
    "job",
    "offre",
    "recrutement",
    "career",
    "carriere",
    "stage",
    "annonce",
)


def _is_job_link(href: str, text: str) -> bool:
    h = href.lower()
    t = text.lower()
    return any(k in h or k in t for k in JOB_LINK_KEYWORDS)


def _extract_cards(soup, list_url: str) -> list[tuple[str, str, str, str]]:
    cards = (
        soup.select(".job-item")
        or soup.select(".offre")
        or soup.select("article")
        or soup.select(".post")
    )
    out: list[tuple[str, str, str, str]] = []
    for c in cards:
        a = c.select_one("a[href]")
        if not a:
            continue
        href = a.get("href", "")
        if not _is_job_link(href, a.get_text()):
            continue
        url = make_absolute(href, list_url)
        title = clean_text(a.get_text(), 500)
        if title and url:
            out.append((url, title, "", ""))
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if not _is_job_link(href, a.get_text()):
            continue
        url = make_absolute(href, list_url)
        title = clean_text(a.get_text(), 500)
        if title and len(url) > 10:
            out.append((url, title, "", ""))
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
        page = 1
        while page <= 50:
            list_urls = [
                f"{BASE}/",
                f"{BASE}/page/{page}/",
                f"{BASE}/category/emploi/page/{page}/",
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
            if not cards and page > 1:
                break
            if not cards:
                page += 1
                time.sleep(2.0)
                continue
            found += len(cards)

            for job_url, title, company, location in cards:
                card_soup = get_page(job_url, session=session)
                desc = ""
                if card_soup:
                    d = (
                        card_soup.select_one(".entry-content")
                        or card_soup.select_one(".content")
                        or card_soup.select_one("article")
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
                    "location": location or None,
                    "country": "ML",
                    "region": "Afrique de l'Ouest",
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
