"""
Source : emploi.bf (Burkina Faso).
Stratégie : pages HTML statiques via requests + BeautifulSoup, pagination par paramètre
ou liens « suivant », sélecteurs multiples avec repli pour cartes d’offres.
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

BASE = "https://www.emploi.bf"
SOURCE = "emploi.bf"


def _extract_card_links(soup, list_url: str) -> list[tuple[str, str, str, str]]:
    """Retourne (url, title, company, location) pour chaque carte détectée."""
    cards = (
        soup.select(".job-item")
        or soup.select(".offre")
        or soup.select("article")
        or soup.select(".job-listing")
        or soup.select(".listing-item")
        or soup.select("div.job")
    )
    out: list[tuple[str, str, str, str]] = []
    for c in cards:
        a = c.select_one("a[href]")
        if not a:
            continue
        href = a.get("href", "")
        url = make_absolute(href, list_url)
        if not url or url == list_url:
            continue
        title = clean_text(a.get_text(), 500)
        company_el = c.select_one(".company, .employer, .societe, [class*='company']")
        loc_el = c.select_one(".location, .lieu, .place, [class*='location']")
        company = clean_text(company_el.get_text() if company_el else "", 300)
        loc = clean_text(loc_el.get_text() if loc_el else "", 300)
        if title:
            out.append((url, title, company, loc))
    # Fallback : liens contenant /offre ou /job
    if not out:
        for a in soup.select("a[href*='offre'], a[href*='job'], a[href*='emploi']"):
            href = a.get("href", "")
            url = make_absolute(href, list_url)
            title = clean_text(a.get_text(), 500)
            if title and url:
                out.append((url, title, "", ""))
    # Dédupliquer par URL
    seen: set[str] = set()
    deduped: list[tuple[str, str, str, str]] = []
    for row in out:
        if row[0] in seen:
            continue
        seen.add(row[0])
        deduped.append(row)
    return deduped


def _fetch_description(url: str, session: requests.Session) -> str:
    soup = get_page(url, session=session)
    if not soup:
        return ""
    desc_el = (
        soup.select_one(".job-description")
        or soup.select_one(".description")
        or soup.select_one("article")
        or soup.select_one(".content")
    )
    if desc_el:
        return clean_text(desc_el.get_text(), 8000)
    return clean_text(soup.get_text(), 8000)


def scrape(run_by: str = "default_owner") -> None:
    run_id = log_scraper_run(SOURCE, run_by)
    inserted = skipped = found = 0
    status = "completed"
    err_msg: Optional[str] = None
    session = requests.Session()

    try:
        page = 1
        while page <= 80:
            list_urls = [
                f"{BASE}/?post_type=noo_job&s=&paged={page}",
                f"{BASE}/offres-emploi/page/{page}/",
                f"{BASE}/jobs/page/{page}/",
            ]
            list_url = list_urls[0]
            soup = get_page(list_url, session=session)
            if not soup and page > 1:
                break
            if not soup:
                for alt in list_urls[1:]:
                    soup = get_page(alt, session=session)
                    if soup:
                        list_url = alt
                        break
            if not soup:
                break

            cards = _extract_card_links(soup, list_url)
            if not cards:
                break
            found += len(cards)

            for url, title, company, location in cards:
                desc = ""
                card_soup = get_page(url, session=session)
                if card_soup:
                    desc_el = (
                        card_soup.select_one(".job-description")
                        or card_soup.select_one(".description")
                        or card_soup.select_one("article")
                    )
                    desc = clean_text(desc_el.get_text() if desc_el else card_soup.get_text(), 8000)
                if len(desc) < 100:
                    time.sleep(1.0)
                    desc = _fetch_description(url, session)

                job = {
                    "source": SOURCE,
                    "scraped_by": run_by,
                    "url": url,
                    "title": title,
                    "company": company or None,
                    "location": location or None,
                    "country": "BF",
                    "region": "Afrique de l'Ouest",
                    "sector": None,
                    "contract_type": None,
                    "raw_description": desc or clean_text(title, 3000),
                    "date_posted": str(date.today()),
                }
                ok = insert_job(job)
                if ok:
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
