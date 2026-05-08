"""
Client Supabase (service_role) : insertions raw_jobs, structured_jobs,
skills_market et journalisation des exécutions scraper.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans l’environnement.")
        _client = create_client(url, key)
    return _client


def _is_unique_violation(err: Exception) -> bool:
    msg = str(err).lower()
    if "23505" in msg or "duplicate" in msg or "unique" in msg:
        return True
    code = getattr(err, "code", None)
    if code == "23505":
        return True
    details = getattr(err, "details", None)
    if details and "23505" in str(details):
        return True
    return False


def insert_job(job: dict) -> bool:
    """
    Insère une ligne dans raw_jobs. Retourne True si insert OK, False si URL dupliquée.
    """
    client = get_client()
    payload = {k: v for k, v in job.items() if v is not None}
    try:
        client.table("raw_jobs").insert(payload).execute()
        return True
    except Exception as e:
        if _is_unique_violation(e):
            return False
        raise


def get_pending_jobs(limit: int = 50) -> list[dict[str, Any]]:
    client = get_client()
    res = (
        client.table("raw_jobs")
        .select("*")
        .eq("processed", False)
        .limit(limit)
        .execute()
    )
    return list(res.data or [])


def mark_processed(job_id: str) -> None:
    client = get_client()
    client.table("raw_jobs").update({"processed": True}).eq("id", job_id).execute()


def insert_structured(data: dict) -> None:
    client = get_client()
    client.table("structured_jobs").insert(data).execute()


def upsert_skill(data: dict) -> None:
    client = get_client()
    client.table("skills_market").upsert(data, on_conflict="skill").execute()


def log_scraper_run(source: str, run_by: str) -> str:
    client = get_client()
    row = {
        "source": source,
        "run_by": run_by,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "jobs_found": 0,
        "jobs_inserted": 0,
        "jobs_skipped": 0,
    }
    res = client.table("scraper_runs").insert(row).execute()
    if not res.data:
        raise RuntimeError("Impossible de créer scraper_runs")
    return str(res.data[0]["id"])


def close_scraper_run(
    run_id: str,
    inserted: int,
    skipped: int,
    status: str,
    error: Optional[str] = None,
    jobs_found: Optional[int] = None,
) -> None:
    client = get_client()
    update: dict[str, Any] = {
        "jobs_inserted": inserted,
        "jobs_skipped": skipped,
        "status": status,
        "error_message": error,
    }
    if jobs_found is not None:
        update["jobs_found"] = jobs_found
    update["finished_at"] = datetime.now(timezone.utc).isoformat()
    client.table("scraper_runs").update(update).eq("id", run_id).execute()


def fetch_all_structured_jobs() -> list[dict[str, Any]]:
    """Récupère toutes les lignes structured_jobs (pagination par tranches)."""
    client = get_client()
    page_size = 1000
    offset = 0
    out: list[dict[str, Any]] = []
    while True:
        res = (
            client.table("structured_jobs")
            .select("hard_skills, tools")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        chunk = res.data or []
        out.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return out
